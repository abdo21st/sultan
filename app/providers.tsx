
'use client';

import { SessionProvider } from "next-auth/react";
import NotificationListener from "./components/NotificationListener";

export function Providers({ children, session }: { children: React.ReactNode, session: any }) {
    return (
        <SessionProvider session={session}>
            <NotificationListener />
            {children}
        </SessionProvider>
    );
}
