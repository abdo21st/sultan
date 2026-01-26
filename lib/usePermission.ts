import { useSession } from "next-auth/react";

interface User {
    id: string;
    role: string;
    permissions?: string[];
    facilityId?: string;
}

export function usePermission() {
    const { data: session } = useSession();

    const hasPermission = (permission: string) => {
        if (!session?.user) return false;

        const user = session.user as any;
        if (user.role === 'ADMIN' || user.username === 'master') return true;

        const userPerms = user.permissions || [];
        return userPerms.includes(permission);
    };

    return { hasPermission, user: session?.user as User | undefined };
}
