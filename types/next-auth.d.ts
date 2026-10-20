import { type DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            facilityId: string | null;
            permissions: string[];
            username: string | null;
            displayName: string | null;
            mustChangePassword: boolean;
            sessionVersion: number;
        } & DefaultSession["user"]
    }

    interface User {
        role: string;
        facilityId: string | null;
        permissions: string[];
        username: string | null;
        displayName: string | null;
        mustChangePassword: boolean;
        sessionVersion: number;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        facilityId?: string | null;
        permissions?: string[];
        username?: string | null;
        displayName?: string | null;
        mustChangePassword?: boolean;
        sessionVersion?: number;
    }
}

// توسيع نوع User في @auth/core لأن useSession يستخدمه داخلياً
declare module "@auth/core/types" {
    interface User {
        role: string;
        facilityId: string | null;
        permissions: string[];
        username: string | null;
        displayName: string | null;
        mustChangePassword: boolean;
        sessionVersion: number;
    }

    interface Session {
        user: {
            id: string;
            role: string;
            facilityId: string | null;
            permissions: string[];
            username: string | null;
            displayName: string | null;
            mustChangePassword: boolean;
            sessionVersion: number;
        } & DefaultSession["user"]
    }
}
