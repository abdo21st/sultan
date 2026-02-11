'use client';

import { SessionProvider } from "next-auth/react";
import NotificationListener from "./components/NotificationListener";

import { Session } from "next-auth";

export function Providers({ children, session }: { children: React.ReactNode, session: Session | null }) {
    return (
        <SessionProvider session={session}>
            <NotificationListener />
            {children}
        </SessionProvider>
    );
}
