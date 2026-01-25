
import { useSession } from "next-auth/react";

export function usePermission() {
    const { data: session } = useSession();

    // Logic: 
    // 1. Admin gets everything? Maybe not hardcoded, but usually safe.
    // 2. Check user.permissions (direct override)
    // 3. Check user.role.permissions (from relation) - Wait, session might not have deep relation data unless we put it in token.
    // Ideally, we put the flattened array of permissions into the session token at login.

    // Allowing loose checking for now assuming session has it.

    const hasPermission = (permission: string) => {
        if (!session?.user) return false;

        // TODO: Ensure session.user has 'permissions' array merged from Role + Direct
        const userPerms = (session.user as any).permissions || [];

        return userPerms.includes(permission);
    };

    return { hasPermission, user: session?.user };
}
