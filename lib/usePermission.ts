import { useSession } from "next-auth/react";

export function usePermission() {
    const { data: session } = useSession();

    const hasPermission = (permission: string) => {
        if (!session?.user) return false;

        const user = session.user;
        const userPerms = user.permissions || [];
        return userPerms.includes(permission);
    };

    return { hasPermission, user: session?.user };
}
