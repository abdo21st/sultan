import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const users = await prisma.user.findMany();
        return NextResponse.json(users);
    } catch (_error) {
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
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
    } catch (_error) {
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}
