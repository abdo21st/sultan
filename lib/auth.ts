import NextAuth, { type User } from "next-auth"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import { DEFAULT_ROLES } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { z } from "zod"
import {
    buildLoginAttemptBuckets,
    clearSuccessfulAccountFailures,
    isLoginAttemptBlocked,
    recordFailedLogin,
} from "@/lib/login-attempts"

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
    events: {
        async signOut(message) {
            // The credentials provider uses JWT sessions. Bump the server-side
            // version so a copied token stops working after the user signs out.
            const token = 'token' in message ? message.token : null;
            if (!token?.sub || typeof token.sessionVersion !== 'number' || !Number.isSafeInteger(token.sessionVersion)) return;
            try {
                await prisma.user.updateMany({
                    where: { id: token.sub, sessionVersion: token.sessionVersion },
                    data: { sessionVersion: { increment: 1 } },
                });
            } catch {
                // Do not log token or user data. The cookie is still cleared by Auth.js.
                console.warn('Could not revoke the authentication session on sign-out.');
            }
        },
    },
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
            async authorize(credentials, request) {
                const parsedCredentials = z
                    .object({ username: z.string().min(1).max(120), password: z.string().min(6).max(128) })
                    .safeParse(credentials);
                const attemptedUsername = typeof credentials?.username === 'string'
                    ? credentials.username.slice(0, 120)
                    : '<invalid>';
                const buckets = buildLoginAttemptBuckets(
                    attemptedUsername,
                    request.headers.get('x-real-ip'),
                    process.env.AUTH_SECRET ?? '',
                );

                try {
                    if (await isLoginAttemptBlocked(buckets)) return null;
                } catch {
                    console.warn('Login attempt protection is unavailable; rejecting the credential request.');
                    return null;
                }

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    const user = await getUser(username);
                    if (user && await bcrypt.compare(password, user.password)) {
                        try {
                            await clearSuccessfulAccountFailures(buckets[0].bucketHash);
                        } catch {
                            console.warn('Could not clear the login attempt record after authentication.');
                            return null;
                        }
                        return user as User;
                    }
                }

                try {
                    await recordFailedLogin(buckets);
                } catch {
                    console.warn('Could not record the failed credential request.');
                }
                return null;
            },
        },
    ],
})
