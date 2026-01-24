import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const existingUser = await prisma.user.findUnique({
            where: { username: "admin" },
        });

        if (existingUser) {
            return NextResponse.json({ message: "Admin user already exists." });
        }

        const hashedPassword = await bcrypt.hash("admin123", 10);

        const user = await prisma.user.create({
            data: {
                username: "admin",
                password: hashedPassword,
                displayName: "مدير النظام",
                role: "ADMIN",
            },
        });

        return NextResponse.json({ message: "Admin user created successfully", user });
    } catch (error) {
        return NextResponse.json({ error: "Failed to seed database", details: error }, { status: 500 });
    }
}
