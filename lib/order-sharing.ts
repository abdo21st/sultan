import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { canAccessOrderFacility, canViewOrderStatus, type RequestUser } from '@/lib/request-user';
import { createOrderShareToken, readOrderShareToken } from '@/lib/order-share-token';
import { writeAudit } from '@/lib/audit';

type ShareOrder = { factoryId: string; shopId: string; status: string };

export function canManageOrderShares(user: RequestUser, order: ShareOrder, action: 'issue' | 'revoke') {
    return user.permissions.includes(PERMISSIONS.ORDERS_VIEW)
        && user.permissions.includes(action === 'issue' ? PERMISSIONS.ORDERS_SHARE : PERMISSIONS.ORDERS_REVOKE_SHARES)
        && (action === 'revoke' || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS))
        && canAccessOrderFacility(user, order) && canViewOrderStatus(user, order.status);
}

export async function issueOrderShareToken(id: string, user: RequestUser, channel: 'PRINT' | 'WHATSAPP' | 'DIRECT') {
    return prisma.$transaction(async tx => {
        // Issue and revoke use the same row lock. A concurrent revocation always invalidates earlier grants.
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
        const order = await tx.order.findUnique({
            where: { id }, select: { factoryId: true, shopId: true, status: true, shareVersion: true },
        });
        if (!order || !canManageOrderShares(user, order, 'issue')) return null;
        const token = createOrderShareToken(id, order.shareVersion);
        const claims = readOrderShareToken(token, id)!;
        await writeAudit(tx, {
            actorId: user.id, entityType: 'ORDER', entityId: id, action: 'SHARE_LINK_ISSUED',
            after: { channel, version: order.shareVersion, expiresAt: new Date(claims.exp * 1000).toISOString(), tokenFingerprint: createHash('sha256').update(token).digest('hex') },
        });
        return token;
    });
}

export async function revokeOrderShares(id: string, user: RequestUser, reason: string) {
    return prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
        const order = await tx.order.findUnique({
            where: { id }, select: { factoryId: true, shopId: true, status: true, shareVersion: true },
        });
        if (!order || !canManageOrderShares(user, order, 'revoke')) return false;
        const updated = await tx.order.update({ where: { id }, data: { shareVersion: { increment: 1 } }, select: { shareVersion: true } });
        await writeAudit(tx, {
            actorId: user.id, entityType: 'ORDER', entityId: id, action: 'SHARE_LINKS_REVOKED',
            before: { version: order.shareVersion }, after: { version: updated.shareVersion, reason },
        });
        return true;
    });
}
