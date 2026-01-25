import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
    try {
        const session = await auth();

        // Bootstrap mode: Allow access if no users exist yet
        const userCount = await prisma.user.count();
        const isBootstrap = userCount === 0;

        if (!isBootstrap && !session?.user?.permissions?.includes(PERMISSIONS.USERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            include: { roles: true }
        });
        return NextResponse.json(users);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.USERS_ADD)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const body = await request.json();

        const hashedPassword = await bcrypt.hash(body.password, 10);

        const user = await prisma.user.create({
            data: {
                username: body.username,
                displayName: body.displayName,
                phoneNumber: body.phoneNumber,
                role: body.role || 'USER', // Kept for legacy compatibility
                facilityId: body.facilityId || null,
                password: hashedPassword,
                roles: body.roleIds ? {
                    connect: body.roleIds.map((id: string) => ({ id }))
                } : undefined
            },
            include: { roles: true }
        });
        return NextResponse.json(user);
    } catch {
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}
