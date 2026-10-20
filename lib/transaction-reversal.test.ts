/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {
    transaction: { findUnique: jest.fn(), aggregate: jest.fn(), create: jest.fn() },
    order: { updateMany: jest.fn() }, $queryRaw: jest.fn(), $executeRaw: jest.fn(), $transaction: jest.fn(),
} }));
jest.mock('@/lib/request-user', () => ({ canAccessOrderFacility: jest.fn(() => true) }));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn() }));

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { canAccessOrderFacility } from '@/lib/request-user';
import { writeAudit } from '@/lib/audit';
import { reverseTransaction } from './transaction-reversal';
import { ORDER_STATUS } from './constants';

const user = { id: 'actor', username: 'actor', role: 'ACCOUNTANT', facilityId: 'shop', permissions: [PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_REVERSE, PERMISSIONS.ORDERS_VIEW_FINANCIALS], sessionVersion: 0, mustChangePassword: false };
const original = { id: 'source', type: 'INCOME', amount: new Prisma.Decimal('70.10'), category: 'SALES', reversalOfId: null, orderId: 'order', facilityId: 'shop', customerId: null,
    order: { id: 'order', factoryId: 'factory', shopId: 'shop', status: ORDER_STATUS.REGISTERED, paidAmount: new Prisma.Decimal('70.10'), remainingAmount: new Prisma.Decimal('29.90') } };
const reason = 'Correct a duplicate historical entry';
const key = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
    jest.clearAllMocks();
    (canAccessOrderFacility as jest.Mock).mockReturnValue(true);
    (prisma.$transaction as jest.Mock).mockImplementation(callback => callback(prisma));
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? original : null);
    (prisma.transaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: original.amount } });
    (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.transaction.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'reverse', ...data }));
});

it('appends an exact negative entry and restores the order balance without modifying the original', async () => {
    const result = await reverseTransaction(user, 'source', reason, key);
    expect(result.amount.toString()).toBe('-70.1');
    expect(result.type).toBe('INCOME');
    expect(result.reversalOfId).toBe('source');
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { paidAmount: { decrement: original.amount }, remainingAmount: { increment: original.amount } } }));
    expect(writeAudit).toHaveBeenCalledTimes(3);
    expect(original.amount.toString()).toBe('70.1');
});

it('replays the same key and reason without a second write or audit', async () => {
    const replay = { ...original, id: 'reverse', amount: original.amount.negated(), reversalOfId: 'source', reversalReason: reason };
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? original : where.idempotencyKey ? replay : null);
    expect((await reverseTransaction(user, 'source', reason, key)).id).toBe('reverse');
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
});

it('rejects reuse of a key with another reason', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? original : { ...original, reversalOfId: 'source', reversalReason: 'another reason' });
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});

it('denies an actor without the separate reversal permission before any lookup', async () => {
    await expect(reverseTransaction({ ...user, permissions: [PERMISSIONS.TRANSACTIONS_VIEW] }, 'source', reason, key)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
});

it('denies an out-of-scope original before looking up an idempotency key', async () => {
    (canAccessOrderFacility as jest.Mock).mockReturnValue(false);
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.transaction.findUnique).toHaveBeenCalledTimes(1);
});

it('does not reverse an existing reversal or an already reversed source', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? { ...original, reversalOfId: 'earlier', amount: original.amount.negated() } : null);
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'REVERSAL_OF_REVERSAL' });
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? original : where.reversalOfId ? { id: 'previous' } : null);
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
});

it('rejects an unreconciled ledger before touching the order', async () => {
    (prisma.transaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: new Prisma.Decimal('60') } });
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'LEDGER_MISMATCH' });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
});

it('rejects a competing order balance change without creating a row or audit', async () => {
    (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await expect(reverseTransaction(user, 'source', reason, key)).rejects.toMatchObject({ code: 'CONCURRENT_CHANGE' });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
});

it('negates a general expense within its original facility and category', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockImplementation(({ where }) => where.id ? { ...original, type: 'EXPENSE', orderId: null, order: null } : null);
    const result = await reverseTransaction(user, 'source', reason, key);
    expect(result.type).toBe('EXPENSE'); expect(result.amount.toString()).toBe('-70.1');
    expect(prisma.order.updateMany).not.toHaveBeenCalled(); expect(writeAudit).toHaveBeenCalledTimes(2);
});
