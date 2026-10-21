import NextAuth, { type User } from "next-auth"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import { DEFAULT_ROLES } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { z } from "zod"

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { roles: true }
        });

        if (!user) return null;

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
    callbacks: {
        ...authConfig.callbacks,
        async jwt(args) {
            const token = await authConfig.callbacks.jwt(args);
            if (!token.sub || !Number.isSafeInteger(token.sessionVersion)) return null;
            // Every server authentication checks revocation, including page requests.
            const current = await prisma.user.findUnique({
                where: { id: token.sub },
                select: { sessionVersion: true, mustChangePassword: true, role: true, facilityId: true, permissions: true, roles: { select: { permissions: true } } },
            });
            if (!current || current.sessionVersion !== token.sessionVersion) return null;
            token.mustChangePassword = current.mustChangePassword;
            token.role = current.role;
            token.facilityId = current.facilityId;
            token.permissions = [...new Set([...DEFAULT_ROLES[current.role], ...current.permissions, ...current.roles.flatMap(role => role.permissions)])];
            return token;
        },
    },
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
