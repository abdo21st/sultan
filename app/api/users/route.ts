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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const user = await prisma.user.create({
            data: {
                username: body.username,
                displayName: body.displayName,
                roleId: body.roleId, // Assuming roleId is generic string for now
                facilityId: body.facilityId,
                password: body.password, // In a real app, hash this!
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
