/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findMany: jest.fn() }, notification: { createMany: jest.fn() } } }));
import { prisma } from '@/lib/prisma';
import { ORDER_STATUS } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { createStatusChangeNotification } from './notification-service';
it('includes effective default permissions while retaining the target facility and custom grants', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'synthetic-recipient' }]);
    await createStatusChangeNotification({ id: 'order', serialNumber: 1, factoryId: 'factory', shopId: 'shop' }, ORDER_STATUS.DELIVERING_TO_FACTORY);
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.facilityId).toBe('factory');
    expect(where.OR).toContainEqual({ role: { in: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] } });
    expect(where.OR).toContainEqual({ permissions: { has: PERMISSIONS.STATUS_VIEW_PROCESSING } });
    expect(where.OR).toContainEqual({ roles: { some: { permissions: { has: PERMISSIONS.STATUS_VIEW_PROCESSING } } } });
    expect(prisma.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ userId: 'synthetic-recipient', link: '/orders/order' })] }));
});
