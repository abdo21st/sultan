import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { CLOSED_ORDER_STATUSES, ORDER_STATUS, normalizeOrderStatus } from './constants';
import { DEFAULT_ROLES, PERMISSIONS } from './permissions';
import { canAccessOrderFacility, canViewOrderStatus, type RequestUser } from './request-user';
import { writeAudit } from './audit';
import { toMoneyNumber } from './money';

export class AdjustmentError extends Error {
    constructor(message: string, public status = 409) { super(message); }
}

export function adjustmentResponse<T extends { refundAmount: Prisma.Decimal; refundedAmount: Prisma.Decimal }>(item: T, showFinancials: boolean) {
    const { refundAmount, refundedAmount, ...publicItem } = item;
    return { ...publicItem, ...(showFinancials ? { refundAmount: toMoneyNumber(refundAmount), refundedAmount: toMoneyNumber(refundedAmount), refundRemaining: toMoneyNumber(refundAmount.minus(refundedAmount)) } : {}) };
}

async function lockedOrder(tx: Prisma.TransactionClient, user: RequestUser, id: string) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || !canAccessOrderFacility(user, order) || !canViewOrderStatus(user, order.status)) throw new AdjustmentError('الطلب غير متاح.', 404);
    return order;
}

async function notifyReviewers(tx: Prisma.TransactionClient, order: { id: string; factoryId: string; shopId: string; serialNumber: number }, title: string, message: string, requester?: string) {
    const users = await tx.user.findMany({ select: { id: true, role: true, facilityId: true, permissions: true, roles: { select: { permissions: true } } } });
    const targets = users.filter(user => {
        const permissions = [...DEFAULT_ROLES[user.role], ...user.permissions, ...user.roles.flatMap(role => role.permissions)];
        return (user.id === requester || permissions.includes(PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE))
            && permissions.includes(PERMISSIONS.ORDERS_VIEW) && canAccessOrderFacility({ ...user, permissions }, order);
    });
    if (targets.length) await tx.notification.createMany({ data: targets.map(user => ({ userId: user.id, title, message, link: `/orders/${order.id}` })) });
}

export async function requestAdjustment(user: RequestUser, orderId: string, input: { kind: 'CANCEL' | 'RETURN'; reason: string; requestKey: string }) {
    if (!user.permissions.includes(PERMISSIONS.ORDERS_ADJUSTMENT_REQUEST)) throw new AdjustmentError('لا تملك صلاحية طلب الإلغاء والمرتجعات.', 403);
    return prisma.$transaction(async tx => {
        const order = await lockedOrder(tx, user, orderId);
        const replay = await tx.orderAdjustment.findUnique({ where: { requestKey: input.requestKey } });
        if (replay) {
            if (replay.orderId !== orderId || replay.kind !== input.kind || replay.reason !== input.reason || replay.requestedBy !== user.id) throw new AdjustmentError('استُخدم مفتاح العملية لطلب مختلف.');
            return replay;
        }
        if (CLOSED_ORDER_STATUSES.includes(order.status)) throw new AdjustmentError('سبق إغلاق الطلب بإلغاء أو مرتجع.');
        const completed = [ORDER_STATUS.COMPLETED, 'COMPLETED'].includes(order.status);
        if ((input.kind === 'RETURN') !== completed) throw new AdjustmentError(completed ? 'الطلب مُسلّم؛ استخدم طلب مرتجع.' : 'الطلب لم يُسلّم؛ استخدم طلب إلغاء.');
        if (await tx.orderAdjustment.findFirst({ where: { orderId, status: { in: ['REQUESTED', 'APPROVED'] } } })) throw new AdjustmentError('يوجد طلب إلغاء أو مرتجع مفتوح لهذا الطلب.');
        const item = await tx.orderAdjustment.create({ data: { orderId, ...input, requestedBy: user.id, originalStatus: order.status } });
        await tx.order.update({ where: { id: orderId }, data: { updatedAt: new Date() } });
        await writeAudit(tx, { actorId: user.id, entityType: 'ORDER_ADJUSTMENT', entityId: item.id, action: 'REQUESTED', after: item });
        await notifyReviewers(tx, order, 'طلب موافقة المدير', `طلب ${input.kind === 'CANCEL' ? 'إلغاء' : 'مرتجع'} للطلب #${order.serialNumber}: ${input.reason}`);
        return item;
    });
}

export async function reviewAdjustment(user: RequestUser, id: string, input: { decision: 'APPROVED' | 'REJECTED'; note: string }) {
    if (!user.permissions.includes(PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE) || !user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) throw new AdjustmentError('يلزم اعتماد الإلغاء والمرتجعات والاطلاع المالي.', 403);
    return prisma.$transaction(async tx => {
        const initial = await tx.orderAdjustment.findUnique({ where: { id } });
        if (!initial) throw new AdjustmentError('طلب المراجعة غير موجود.', 404);
        const order = await lockedOrder(tx, user, initial.orderId);
        const item = await tx.orderAdjustment.findUniqueOrThrow({ where: { id } });
        if (item.status !== 'REQUESTED') {
            if (item.status === input.decision && item.reviewedBy === user.id && item.reviewNote === input.note) return item;
            throw new AdjustmentError('سبق اتخاذ قرار بشأن هذا الطلب.');
        }
        if (normalizeOrderStatus(order.status) !== normalizeOrderStatus(item.originalStatus)) throw new AdjustmentError('تغيرت حالة الطلب؛ راجع البيانات قبل اتخاذ القرار.');
        const updated = await tx.orderAdjustment.update({ where: { id }, data: {
            status: input.decision, reviewedBy: user.id, reviewedAt: new Date(), reviewNote: input.note,
            refundAmount: input.decision === 'APPROVED' ? order.paidAmount : 0,
        } });
        if (input.decision === 'APPROVED') await tx.order.update({ where: { id: order.id }, data: { status: item.kind === 'CANCEL' ? ORDER_STATUS.CANCELLED : ORDER_STATUS.RETURNED, reviewRequired: false, rejectionReason: null } });
        else await tx.order.update({ where: { id: order.id }, data: { updatedAt: new Date() } });
        await writeAudit(tx, { actorId: user.id, entityType: 'ORDER_ADJUSTMENT', entityId: id, action: input.decision, before: item, after: updated });
        await writeAudit(tx, { actorId: user.id, entityType: 'ORDER', entityId: order.id, action: `ADJUSTMENT_${input.decision}`, before: { status: order.status, remainingAmount: order.remainingAmount, reviewRequired: order.reviewRequired, correctionReason: order.rejectionReason }, after: { adjustmentId: id, decision: input.decision, kind: item.kind, originalPaymentLedgerRetained: true } });
        await notifyReviewers(tx, order, input.decision === 'APPROVED' ? 'اعتماد الإلغاء أو المرتجع' : 'رفض الإلغاء أو المرتجع', `طلب #${order.serialNumber}: ${input.note}`, item.requestedBy);
        return updated;
    });
}

export async function settleRefund(user: RequestUser, id: string, input: { amount: number; note: string; idempotencyKey: string }) {
    if (![PERMISSIONS.ORDERS_REFUND, PERMISSIONS.TRANSACTIONS_ADD, PERMISSIONS.ORDERS_VIEW_FINANCIALS].every(permission => user.permissions.includes(permission))) throw new AdjustmentError('يلزم رد المبالغ وإضافة الحركات والاطلاع المالي.', 403);
    return prisma.$transaction(async tx => {
        const initial = await tx.orderAdjustment.findUnique({ where: { id } });
        if (!initial) throw new AdjustmentError('التسوية غير موجودة.', 404);
        const order = await lockedOrder(tx, user, initial.orderId);
        const item = await tx.orderAdjustment.findUniqueOrThrow({ where: { id } });
        const replay = await tx.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
            if (replay.adjustmentId !== id || !replay.amount.eq(input.amount) || replay.description !== input.note || replay.createdBy !== user.id) throw new AdjustmentError('استُخدم مفتاح العملية لتسوية مختلفة.');
            return replay;
        }
        if (item.status !== 'APPROVED') throw new AdjustmentError('لا يمكن رد مبلغ قبل موافقة المدير.');
        if (new Prisma.Decimal(input.amount).gt(item.refundAmount.minus(item.refundedAmount))) throw new AdjustmentError('المبلغ يتجاوز المتبقي المستحق للعميل.');
        const transaction = await tx.transaction.create({ data: {
            adjustmentId: id, type: 'EXPENSE', category: 'ORDER_REFUND', amount: input.amount,
            description: input.note, idempotencyKey: input.idempotencyKey, facilityId: order.shopId, createdBy: user.id,
        } });
        await tx.orderAdjustment.update({ where: { id }, data: { refundedAmount: { increment: input.amount } } });
        await writeAudit(tx, { actorId: user.id, entityType: 'ORDER_ADJUSTMENT', entityId: id, action: 'REFUND_RECORDED', after: { transactionId: transaction.id, amount: input.amount, note: input.note } });
        await writeAudit(tx, { actorId: user.id, entityType: 'TRANSACTION', entityId: transaction.id, action: 'REFUND_RECORDED', after: { adjustmentId: id, orderId: order.id, amount: input.amount } });
        return transaction;
    });
}
