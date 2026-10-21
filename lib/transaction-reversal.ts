import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { canAccessAllFacilities, canAccessOrderFacility, type RequestUser } from '@/lib/request-user';
import { writeAudit } from '@/lib/audit';
import { toMoneyNumber } from '@/lib/money';
import { CLOSED_ORDER_STATUSES } from './constants';

type ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'ALREADY_REVERSED' | 'REVERSAL_OF_REVERSAL' | 'IDEMPOTENCY_CONFLICT' | 'LEDGER_MISMATCH' | 'CONCURRENT_CHANGE' | 'ORDER_CLOSED';
export class ReversalError extends Error {
    constructor(public readonly code: ErrorCode) { super(code); }
}

const orderSelect = { id: true, factoryId: true, shopId: true, status: true, paidAmount: true, remainingAmount: true } as const;
const include = { order: { select: orderSelect }, adjustment: { include: { order: { select: orderSelect } } } } as const;
type RecordWithOrder = Prisma.TransactionGetPayload<{ include: typeof include }>;

function checkAccess(user: RequestUser, transaction: RecordWithOrder) {
    const linkedOrder = transaction.order ?? transaction.adjustment?.order;
    const accessible = linkedOrder
        ? canAccessOrderFacility(user, linkedOrder)
        : canAccessAllFacilities(user) || Boolean(user.facilityId && user.facilityId === transaction.facilityId);
    if (!accessible) throw new ReversalError('NOT_FOUND');
    if (linkedOrder && !user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) throw new ReversalError('FORBIDDEN');
}

function matchReplay(existing: RecordWithOrder, user: RequestUser, id: string, reason: string) {
    checkAccess(user, existing);
    if (existing.reversalOfId !== id || existing.reversalReason !== reason) throw new ReversalError('IDEMPOTENCY_CONFLICT');
    return existing;
}

export async function reverseTransaction(user: RequestUser, id: string, reason: string, idempotencyKey: string) {
    if (!user.permissions.includes(PERMISSIONS.TRANSACTIONS_VIEW) || !user.permissions.includes(PERMISSIONS.TRANSACTIONS_REVERSE)) throw new ReversalError('FORBIDDEN');
    try {
        return await prisma.$transaction(async tx => {
            // Validate scope before inspecting a caller-supplied idempotency key.
            const initial = await tx.transaction.findUnique({ where: { id }, include });
            if (!initial) throw new ReversalError('NOT_FOUND');
            checkAccess(user, initial);
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, hashtext(${idempotencyKey}))`;
            const replay = await tx.transaction.findUnique({ where: { idempotencyKey }, include });
            if (replay) return matchReplay(replay, user, id, reason);

            // All order balance writers serialize on the order row. Lock it before the source entry.
            const linkedOrderId = initial.orderId ?? initial.adjustment?.orderId;
            if (linkedOrderId) await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${linkedOrderId} FOR UPDATE`;
            await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${id} FOR UPDATE`;
            const original = await tx.transaction.findUnique({ where: { id }, include });
            if (!original) throw new ReversalError('NOT_FOUND');
            checkAccess(user, original);
            if (original.reversalOfId || !original.amount.gt(0)) throw new ReversalError('REVERSAL_OF_REVERSAL');
            if (await tx.transaction.findUnique({ where: { reversalOfId: id } })) throw new ReversalError('ALREADY_REVERSED');

            const order = original.order;
            if (order) {
                if (CLOSED_ORDER_STATUSES.includes(order.status) || await tx.orderAdjustment.findFirst({ where: { orderId: order.id, status: { in: ['REQUESTED', 'APPROVED'] } } })) throw new ReversalError('ORDER_CLOSED');
                const ledger = await tx.transaction.aggregate({ where: { orderId: order.id, type: 'INCOME' }, _sum: { amount: true } });
                if (!(ledger._sum.amount ?? new Prisma.Decimal(0)).eq(order.paidAmount)) throw new ReversalError('LEDGER_MISMATCH');
                const updated = await tx.order.updateMany({
                    where: { id: order.id, paidAmount: { gte: original.amount } },
                    data: { paidAmount: { decrement: original.amount }, remainingAmount: { increment: original.amount } },
                });
                if (updated.count !== 1) throw new ReversalError('CONCURRENT_CHANGE');
            }
            if (original.adjustment) {
                if (!user.permissions.includes(PERMISSIONS.ORDERS_REFUND)) throw new ReversalError('FORBIDDEN');
                const updated = await tx.orderAdjustment.updateMany({ where: { id: original.adjustment.id, status: 'APPROVED', refundedAmount: { gte: original.amount } }, data: { refundedAmount: { decrement: original.amount } } });
                if (updated.count !== 1) throw new ReversalError('CONCURRENT_CHANGE');
            }

            const reversal = await tx.transaction.create({ data: {
                type: original.type, amount: original.amount.negated(), category: original.category,
                description: `قيد عكسي للحركة ${original.id}`,
                orderId: original.orderId, adjustmentId: original.adjustmentId, facilityId: original.facilityId, customerId: original.customerId,
                reversalOfId: original.id, reversalReason: reason, idempotencyKey, createdBy: user.id,
            } });
            await writeAudit(tx, { actorId: user.id, entityType: 'TRANSACTION', entityId: original.id, action: 'REVERSED',
                after: { reversalTransactionId: reversal.id, amount: toMoneyNumber(reversal.amount), reason } });
            await writeAudit(tx, { actorId: user.id, entityType: 'TRANSACTION', entityId: reversal.id, action: 'REVERSAL_CREATED',
                after: { originalTransactionId: original.id, type: reversal.type, amount: toMoneyNumber(reversal.amount), reason } });
            if (order) await writeAudit(tx, { actorId: user.id, entityType: 'ORDER', entityId: order.id, action: 'PAYMENT_REVERSED',
                before: { paidAmount: toMoneyNumber(order.paidAmount), remainingAmount: toMoneyNumber(order.remainingAmount) },
                after: { paidAmount: toMoneyNumber(order.paidAmount.minus(original.amount)), remainingAmount: toMoneyNumber(order.remainingAmount.plus(original.amount)), originalTransactionId: original.id, reversalTransactionId: reversal.id, reason } });
            if (original.adjustment) await writeAudit(tx, { actorId: user.id, entityType: 'ORDER_ADJUSTMENT', entityId: original.adjustment.id, action: 'REFUND_REVERSED', after: { originalTransactionId: original.id, reversalTransactionId: reversal.id, amount: toMoneyNumber(original.amount), reason } });
            return reversal;
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const replay = await prisma.transaction.findUnique({ where: { idempotencyKey }, include });
            if (replay) return matchReplay(replay, user, id, reason);
            throw new ReversalError('ALREADY_REVERSED');
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ReversalError('CONCURRENT_CHANGE');
        throw error;
    }
}
