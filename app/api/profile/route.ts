import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";
import { newPasswordSchema } from '@/lib/password-policy';

// Schema for updating basic info
const updateInfoSchema = z.object({
    displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    phoneNumber: z.string().regex(/^\d{10,15}$/, "رقم الهاتف غير صحيح").optional().or(z.literal('')),
});

// Schema for changing password
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة").max(128),
    newPassword: newPasswordSchema,
});

export async function PUT(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await request.json();

        const result = updateInfoSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const { displayName, phoneNumber } = result.data;

        const updatedUser = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: user.id },
                data: { displayName, phoneNumber: phoneNumber || null },
                select: { id: true, displayName: true, phoneNumber: true },
            });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "USER",
                entityId: user.id,
                action: "PROFILE_UPDATED",
                after: { fields: ["displayName", "phoneNumber"] },
            });
            return updated;
        });

        return NextResponse.json(updatedUser);
    } catch {
        return NextResponse.json(
            { error: "Profile update failed." },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getRequestUser({ allowPasswordChange: true });
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await request.json();
        const result = changePasswordSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = result.data;

        // Get user with password
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id },
        });

        if (!userRecord) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (userRecord.sessionVersion !== user.sessionVersion) {
            return NextResponse.json({ error: "انتهت الجلسة؛ سجّل الدخول مجدداً" }, { status: 401 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, userRecord.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "كلمة المرور الحالية غير صحيحة" },
                { status: 400 }
            );
        }

        if (await bcrypt.compare(newPassword, userRecord.password)) {
            return NextResponse.json({ error: "اختر كلمة مرور مختلفة عن الحالية" }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const changed = await prisma.$transaction(async (tx) => {
            const result = await tx.user.updateMany({
                where: { id: user.id, password: userRecord.password, sessionVersion: userRecord.sessionVersion },
                data: { password: hashedPassword, mustChangePassword: false, sessionVersion: { increment: 1 } },
            });
            if (result.count !== 1) return false;
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "USER",
                entityId: user.id,
                action: "PASSWORD_CHANGED",
                after: { initialPasswordReplaced: userRecord.mustChangePassword, sessionsRevoked: true },
            });
            return true;
        });

        if (!changed) return NextResponse.json({ error: "تغيرت بيانات الحساب أثناء الطلب؛ سجّل الدخول مجدداً" }, { status: 409 });
        return NextResponse.json({ message: "تم تغيير كلمة المرور؛ سجّل الدخول بالكلمة الجديدة", reauthenticate: true });
    } catch {
        return NextResponse.json(
            { error: "حدث خطأ أثناء تغيير كلمة المرور" },
            { status: 500 }
        );
    }
}
