import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/');
            const isOnLogin = nextUrl.pathname.startsWith('/login');

            // Allow access to public assets and api routes that don't need auth (like seed)
            if (nextUrl.pathname.startsWith('/api/seed')) return true;
            if (nextUrl.pathname.startsWith('/_next')) return true;
            if (nextUrl.pathname.startsWith('/static')) return true;

            // If on login page and logged in, redirect to dashboard
            if (isOnLogin && isLoggedIn) {
                return Response.redirect(new URL('/', nextUrl));
            }

            // If on dashboard (protected) and not logged in, redirect to login
            // Note: This logic might be too aggressive if we have public pages. 
            // For now, assume everything except login is private.
            if (!isLoggedIn && !isOnLogin && !nextUrl.pathname.startsWith('/api/auth')) {
                return false; // Redirect to login
            }

            return true;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                // @ts-ignore
                session.user.role = token.role;
                // @ts-ignore
                session.user.facilityId = token.facilityId;
                // @ts-ignore
                session.user.permissions = token.permissions;
                // @ts-ignore
                session.user.username = token.username;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.role = (user as any).role;
                token.facilityId = (user as any).facilityId;
                token.permissions = (user as any).permissions;
                token.username = (user as any).username;
            }
            return token;
        }
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
