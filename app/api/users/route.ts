import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { PERMISSIONS } from "../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";

export async function GET() {
    try {
        const user = await getRequestUser();

        // Bootstrap mode: Allow access if no users exist yet
        const userCount = await prisma.user.count();
        const isBootstrap = userCount === 0;

        if (!isBootstrap && !user?.permissions.includes(PERMISSIONS.USERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                displayName: true,
                phoneNumber: true,
                role: true,
                permissions: true,
                facilityId: true,
                createdAt: true,
                updatedAt: true,
                roles: {
                    select: { id: true, name: true, displayName: true, description: true, permissions: true }
                }
            }
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
import { newPasswordSchema } from '@/lib/password-policy';

import { z } from "zod";

const userSchema = z.object({
    username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
    password: newPasswordSchema,
    displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    phoneNumber: z.string().regex(/^\d{10,15}$/, "رقم الهاتف غير صحيح").optional().or(z.literal('')),
    role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "USER"]).optional(),
    facilityId: z.string().optional().nullable(),
    roleIds: z.array(z.string()).optional(),
});



export async function POST(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.USERS_ADD)) {
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
        if (user.role !== "ADMIN" && (
            (body.role !== undefined && body.role !== "USER") ||
            (body.roleIds?.length ?? 0) > 0 ||
            (body.facilityId && body.facilityId !== user.facilityId)
        )) {
            return NextResponse.json({ error: "Only administrators can assign roles." }, { status: 403 });
        }
        const hashedPassword = await bcrypt.hash(body.password, 12);

        const newUser = await prisma.user.create({
            data: {
                username: body.username,
                displayName: body.displayName,
                phoneNumber: body.phoneNumber || null,
                role: body.role || 'USER',
                facilityId: body.facilityId || null,
                password: hashedPassword,
                mustChangePassword: true,
                roles: body.roleIds ? {
                    connect: body.roleIds.map((id: string) => ({ id }))
                } : undefined
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                phoneNumber: true,
                role: true,
                permissions: true,
                facilityId: true,
                createdAt: true,
                updatedAt: true,
                roles: {
                    select: { id: true, name: true, displayName: true, description: true, permissions: true }
                }
            }
        });
        return NextResponse.json(newUser);
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
