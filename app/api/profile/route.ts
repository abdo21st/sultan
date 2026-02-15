import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Schema for updating basic info
const updateInfoSchema = z.object({
    displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    phoneNumber: z.string().regex(/^\d{10,15}$/, "رقم الهاتف غير صحيح").optional().or(z.literal('')),
});

// Schema for changing password
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"),
});

export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await request.json();
        console.log("Profile Update Payload:", json); // DEBUG LOG

        const result = updateInfoSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const { displayName, phoneNumber } = result.data;

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                displayName,
                phoneNumber: phoneNumber || null,
            },
            select: {
                id: true,
                displayName: true,
                phoneNumber: true,
            }
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Profile update error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) }, // EXPOSE ERROR
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
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
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "كلمة المرور الحالية غير صحيحة" },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        return NextResponse.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
        console.error("Password change error:", error);
        return NextResponse.json(
            { error: "حدث خطأ أثناء تغيير كلمة المرور" },
            { status: 500 }
        );
    }
}
