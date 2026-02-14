import NextAuth, { type User } from "next-auth"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import { PERMISSIONS, DEFAULT_ROLES } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { z } from "zod"

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { roles: true }
        });

        if (!user) return null;

        // Force Absolute Access for Master
        if (user.username === 'master') {
            return {
                ...user,
                permissions: Object.values(PERMISSIONS) as string[]
            };
        }

        const allPermissions = new Set<string>(user.permissions || []);
        const defaultRolePermissions = DEFAULT_ROLES[user.role as keyof typeof DEFAULT_ROLES] || [];
        defaultRolePermissions.forEach(p => allPermissions.add(p));

        if (user.roles && user.roles.length > 0) {
            user.roles.forEach((role: { permissions: string[] }) => {
                role.permissions.forEach(p => allPermissions.add(p));
            });
        }

        return { ...user, permissions: Array.from(allPermissions) };
    } catch (error) {
        console.error('Failed to fetch user:', error);
        return null;
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        {
            id: 'credentials',
            name: 'Credentials',
            type: 'credentials',
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ username: z.string(), password: z.string().min(4) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    const user = await getUser(username);
                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) return user as User;
                }
                return null;
            },
        },
    ],
})
