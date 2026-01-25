import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Use a global prisma instance or import from lib if available
// Assuming we can use the one from lib/prisma.ts tailored for edge if needed, 
// but for credentials usually we need standard node prisma.
// Since we are in app router, let's just make a new client or use the lib one.
import { prisma } from '@/lib/prisma'; // Ensure this path is correct

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { roles: true } // Fetch All Custom Roles
        });

        if (user && user.roles && user.roles.length > 0) {
            // Merge permissions: All Roles Permissions + User Specific Permissions
            const rolePermissions = user.roles.flatMap(role => role.permissions);
            const mergedPermissions = Array.from(new Set([
                ...rolePermissions,
                ...user.permissions
            ]));
            return { ...user, permissions: mergedPermissions };
        }

        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ username: z.string(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    const user = await getUser(username);
                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) return user;
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
