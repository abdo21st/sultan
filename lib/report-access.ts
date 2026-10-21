import type { Prisma } from '@prisma/client';
import { PERMISSIONS } from './permissions';
import { LEGACY_STATUS_MAPPING, ORDER_STATUS } from './constants';
import { canAccessAllFacilities, canViewOrderStatus, type RequestUser } from './request-user';

export function reportFacility(user: RequestUser, requested: string | null): string | null | false {
    if (canAccessAllFacilities(user)) return requested || null;
    if (!user.facilityId || (requested && requested !== user.facilityId)) return false;
    return user.facilityId;
}

export function reportStatuses(user: RequestUser): string[] | null {
    if (user.role === 'ADMIN') return null;
    return Object.values(ORDER_STATUS).filter(status => canViewOrderStatus(user, status))
        .flatMap(status => [status, LEGACY_STATUS_MAPPING[status]].filter(Boolean));
}

export function reportOrderWhere(facilityId: string | null, statuses: string[] | null): Prisma.OrderWhereInput {
    return {
        ...(facilityId ? { OR: [{ factoryId: facilityId }, { shopId: facilityId }] } : {}),
        ...(statuses ? { status: { in: statuses } } : {}),
    };
}

export function canReadFinancialReports(user: RequestUser): boolean {
    return user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && user.permissions.includes(PERMISSIONS.TRANSACTIONS_VIEW);
}
