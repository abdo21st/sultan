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
        } & DefaultSession["user"]
    }

    interface User {
        role: string;
        facilityId: string | null;
        permissions: string[];
        username: string | null;
        displayName: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        facilityId?: string | null;
        permissions?: string[];
        username?: string | null;
        displayName?: string | null;
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
    }

    interface Session {
        user: {
            id: string;
            role: string;
            facilityId: string | null;
            permissions: string[];
            username: string | null;
            displayName: string | null;
        } & DefaultSession["user"]
    }
}
