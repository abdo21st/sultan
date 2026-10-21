/** @jest-environment node */
jest.mock('@/lib/request-user', () => ({ getRequestUser: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn(), order: { findMany: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() }, facility: { findMany: jest.fn() } } }));
import { getRequestUser } from '@/lib/request-user';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GET } from './route';
beforeEach(() => jest.clearAllMocks());
it('denies analytics before reading any financial data', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue({ role: 'MANAGER' });
    expect((await GET()).status).toBe(403);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
it('aggregates months in PostgreSQL without loading individual orders', async () => {
    (getRequestUser as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ month: new Date('2026-10-01T00:00:00Z'), total: new Prisma.Decimal('0.30'), paid: new Prisma.Decimal('0.10') }]);
    (prisma.order.groupBy as jest.Mock).mockResolvedValueOnce([{ factoryId: 'f', _count: { id: 2 }, _sum: { totalAmount: new Prisma.Decimal('0.30') } }]).mockResolvedValueOnce([{ status: 'REGISTERED', _count: { status: 2 } }]);
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _count: { id: 2 }, _sum: { totalAmount: new Prisma.Decimal('0.30'), paidAmount: new Prisma.Decimal('0.10') } });
    (prisma.facility.findMany as jest.Mock).mockResolvedValue([{ id: 'f', name: 'Synthetic factory' }]);
    const response = await GET(); expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.monthlySales).toEqual([{ month: 'أكتوبر', total: 0.3, paid: 0.1 }]);
    expect(body.summary).toEqual({ totalOrders: 2, totalRevenue: 0.3, totalCollected: 0.1 });
    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect((prisma.$queryRaw as jest.Mock).mock.calls[0][0].join('')).toContain("date_trunc('month'");
});
