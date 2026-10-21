import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLES, PERMISSIONS } from "@/lib/permissions";
import { CLOSED_ORDER_STATUSES, normalizeOrderStatus } from "@/lib/constants";
import type { Prisma } from '@prisma/client';

export type RequestUser = {
    id: string;
    username: string;
    role: string;
    facilityId: string | null;
    permissions: string[];
    sessionVersion: number;
    mustChangePassword: boolean;
};

/** Reload authorization facts for sensitive server operations instead of trusting stale JWT claims. */
export async function getRequestUser(options: { allowPasswordChange?: boolean } = {}): Promise<RequestUser | null> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            role: true,
            facilityId: true,
            permissions: true,
            mustChangePassword: true,
            sessionVersion: true,
            roles: { select: { permissions: true } },
        },
    });
    if (!user || user.sessionVersion !== session?.user.sessionVersion) return null;
    if (user.mustChangePassword && !options.allowPasswordChange) return null;

    const permissions = new Set<string>([
        ...(DEFAULT_ROLES[user.role] ?? []),
        ...user.permissions,
        ...user.roles.flatMap((role) => role.permissions),
    ]);
    return { ...user, permissions: [...permissions] };
}

type FacilityScopeUser = Pick<RequestUser, "role" | "facilityId"> & { permissions?: readonly string[] };

export function canAccessAllFacilities(user: { role: string; permissions?: readonly string[] }): boolean {
    return user.role === "ADMIN" || Boolean(user.permissions?.includes(PERMISSIONS.FACILITIES_VIEW_ALL));
}

export function canAccessOrderFacility(
    user: FacilityScopeUser,
    order: { factoryId: string; shopId: string },
): boolean {
    return canAccessAllFacilities(user) || Boolean(
        user.facilityId && (order.factoryId === user.facilityId || order.shopId === user.facilityId)
    );
}

export function orderFacilityFilter(user: FacilityScopeUser) {
    if (canAccessAllFacilities(user)) return {};
    if (!user.facilityId) return { id: "__no_assigned_facility__" };
    return { OR: [{ factoryId: user.facilityId }, { shopId: user.facilityId }] };
}

export function transactionFacilityWhere(facilityId: string | null): Prisma.TransactionWhereInput {
    if (!facilityId) return {};
    const scope = { OR: [{ factoryId: facilityId }, { shopId: facilityId }] };
    return { OR: [{ facilityId }, { order: { is: scope } }, { adjustment: { is: { order: { is: scope } } } }] };
}

export function transactionFacilityFilter(user: FacilityScopeUser): Prisma.TransactionWhereInput {
    if (canAccessAllFacilities(user)) return {};
    return user.facilityId ? transactionFacilityWhere(user.facilityId) : { id: '__no_assigned_facility__' };
}

export function canViewOrderStatus(
    user: Pick<RequestUser, "role" | "permissions">,
    status: string,
): boolean {
    if (user.role === "ADMIN") return true;
    if (CLOSED_ORDER_STATUSES.includes(status) && [PERMISSIONS.ORDERS_ADJUSTMENT_REQUEST, PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE, PERMISSIONS.ORDERS_REFUND].some(permission => user.permissions.includes(permission))) return true;
    const canonicalStatus = normalizeOrderStatus(status);
    const prefix = "orders:status:";
    if (!canonicalStatus.startsWith(prefix)) return false;
    const suffix = canonicalStatus.slice(prefix.length);
    return user.permissions.includes(`orders:status:view:${suffix}`);
}
