import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";
import { PERMISSIONS } from "../../../lib/permissions";

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
            where: {
                NOT: { username: 'master' }
            },
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

import { z } from "zod";

const userSchema = z.object({
    username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    phoneNumber: z.string().regex(/^\d{10,15}$/, "رقم الهاتف غير صحيح").optional().or(z.literal('')),
    role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "USER"]).optional(),
    facilityId: z.string().optional().nullable(),
    roleIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.USERS_ADD)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const json = await request.json();
        const result = userSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const hashedPassword = await bcrypt.hash(body.password, 10);

        const user = await prisma.user.create({
            data: {
                username: body.username,
                displayName: body.displayName,
                phoneNumber: body.phoneNumber || null,
                role: (body.role as any) || 'USER',
                facilityId: body.facilityId || null,
                password: hashedPassword,
                roles: body.roleIds ? {
                    connect: body.roleIds.map((id: string) => ({ id }))
                } : undefined
            },
            include: { roles: true }
        });
        return NextResponse.json(user);
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json(
                { error: "اسم المستخدم موجود بالفعل" },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: "فشل إنشاء المستخدم" },
            { status: 500 }
        );
    }
}
