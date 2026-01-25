import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const users = await prisma.user.findMany();
        return NextResponse.json(users);
    } catch (error) {
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
                role: body.role || 'USER',
                facilityId: body.facilityId || null,
                password: hashedPassword,
            },
        });
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}
