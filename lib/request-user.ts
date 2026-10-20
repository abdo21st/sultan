import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLES } from "@/lib/permissions";
import { LEGACY_STATUS_MAPPING } from "@/lib/constants";

export type RequestUser = {
    id: string;
    username: string;
    role: string;
    facilityId: string | null;
    permissions: string[];
};

/** Reload authorization facts for sensitive server operations instead of trusting stale JWT claims. */
export async function getRequestUser(): Promise<RequestUser | null> {
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
            roles: { select: { permissions: true } },
        },
    });
    if (!user) return null;

    const permissions = new Set<string>([
        ...(DEFAULT_ROLES[user.role] ?? []),
        ...user.permissions,
        ...user.roles.flatMap((role) => role.permissions),
    ]);
    return { ...user, permissions: [...permissions] };
}

export function canAccessOrderFacility(
    user: Pick<RequestUser, "role" | "facilityId">,
    order: { factoryId: string; shopId: string },
): boolean {
    return user.role === "ADMIN" || Boolean(
        user.facilityId && (order.factoryId === user.facilityId || order.shopId === user.facilityId)
    );
}

export function orderFacilityFilter(user: Pick<RequestUser, "role" | "facilityId">) {
    if (user.role === "ADMIN") return {};
    if (!user.facilityId) return { id: "__no_assigned_facility__" };
    return { OR: [{ factoryId: user.facilityId }, { shopId: user.facilityId }] };
}

export function canViewOrderStatus(
    user: Pick<RequestUser, "role" | "permissions">,
    status: string,
): boolean {
    if (user.role === "ADMIN") return true;
    const canonicalStatus = Object.entries(LEGACY_STATUS_MAPPING)
        .find(([, legacyStatus]) => legacyStatus === status)?.[0] ?? status;
    const prefix = "orders:status:";
    if (!canonicalStatus.startsWith(prefix)) return false;
    const suffix = canonicalStatus.slice(prefix.length);
    return user.permissions.includes(`orders:status:view:${suffix}`);
}
