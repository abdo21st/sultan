import { DefaultSession } from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** The user's role. */
            role: string
            /** The user's facility ID. */
            facilityId?: string | null
            /** The user's permissions. */
            permissions: string[]
            /** The user's username. */
            username?: string | null
            id: string
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        facilityId?: string | null
        permissions: string[]
        username?: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: string
        facilityId?: string | null
        permissions: string[]
        username?: string | null
    }
}
