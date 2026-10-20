import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";

// Schema for updating basic info
const updateInfoSchema = z.object({
    displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    phoneNumber: z.string().regex(/^\d{10,15}$/, "رقم الهاتف غير صحيح").optional().or(z.literal('')),
});

// Schema for changing password
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().min(12, "كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل").max(128),
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
        const user = await getRequestUser();
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

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, userRecord.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "كلمة المرور الحالية غير صحيحة" },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "USER",
                entityId: user.id,
                action: "PASSWORD_CHANGED",
            });
        });

        return NextResponse.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch {
        return NextResponse.json(
            { error: "حدث خطأ أثناء تغيير كلمة المرور" },
            { status: 500 }
        );
    }
}
