import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { newPasswordSchema } from '@/lib/password-policy';
import { writeAudit } from "@/lib/audit";

const userUpdateSchema = z.object({
    username: z.string().trim().min(3).max(100),
    displayName: z.string().trim().min(2).max(120),
    phoneNumber: z.string().regex(/^\d{10,15}$/).optional().or(z.literal("")),
    password: newPasswordSchema.optional().or(z.literal("")),
    role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "USER"]),
    facilityId: z.string().nullable().optional(),
    roleIds: z.array(z.string().min(1).max(128)).max(20).optional(),
}).strict();

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const actor = await getRequestUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!actor.permissions.includes(PERMISSIONS.USERS_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            displayName: true,
            phoneNumber: true,
            role: true,
            facilityId: true,
            createdAt: true,
            roles: { select: { id: true, name: true, displayName: true, description: true, permissions: true } },
        },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const actor = await getRequestUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!actor.permissions.includes(PERMISSIONS.USERS_EDIT)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { id } = await params;
        const parsed = userUpdateSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user data." }, { status: 400 });
        const body = parsed.data;
        const existing = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                displayName: true,
                phoneNumber: true,
                role: true,
                facilityId: true,
                roles: { select: { id: true } },
            },
        });
        if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const requestedRoleIds = body.roleIds;
        const requestedFacilityId = body.facilityId || null;
        const isChangingAccess = body.role !== existing.role ||
            (requestedRoleIds !== undefined && requestedRoleIds.slice().sort().join(",") !== existing.roles.map((role) => role.id).sort().join(",")) ||
            requestedFacilityId !== existing.facilityId;
        if (actor.role !== "ADMIN" && isChangingAccess) {
            return NextResponse.json({ error: "Only administrators can change roles or facility access." }, { status: 403 });
        }

        const updateData = {
            username: body.username,
            displayName: body.displayName,
            phoneNumber: body.phoneNumber || null,
            role: body.role,
            facilityId: requestedFacilityId,
            ...(requestedRoleIds !== undefined ? { roles: { set: requestedRoleIds.map((roleId) => ({ id: roleId })) } } : {}),
            ...(body.password ? { password: await bcrypt.hash(body.password, 12), mustChangePassword: true } : {}),
            ...(body.password || isChangingAccess ? { sessionVersion: { increment: 1 } } : {}),
        };

        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    phoneNumber: true,
                    role: true,
                    facilityId: true,
                    roles: { select: { id: true, name: true, displayName: true, description: true, permissions: true } },
                },
            });
            await writeAudit(tx, {
                actorId: actor.id,
                entityType: "USER",
                entityId: id,
                action: "UPDATED",
                before: {
                    username: existing.username,
                    displayName: existing.displayName,
                    phoneNumber: existing.phoneNumber,
                    role: existing.role,
                    facilityId: existing.facilityId,
                    roleIds: existing.roles.map((role) => role.id),
                },
                after: {
                    username: updated.username,
                    displayName: updated.displayName,
                    phoneNumber: updated.phoneNumber,
                    role: updated.role,
                    facilityId: updated.facilityId,
                    roleIds: updated.roles.map((role) => role.id),
                    passwordChanged: Boolean(body.password),
                },
            });
            return updated;
        });
        return NextResponse.json(user);
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            return NextResponse.json({ error: "اسم المستخدم موجود بالفعل" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const actor = await getRequestUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!actor.permissions.includes(PERMISSIONS.USERS_DELETE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (id === actor.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    try {
        await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({ where: { id }, select: { id: true, username: true, role: true } });
            if (!target) throw new Error("USER_NOT_FOUND");
            await tx.user.delete({ where: { id } });
            await writeAudit(tx, {
                actorId: actor.id,
                entityType: "USER",
                entityId: id,
                action: "DELETED",
                before: { username: target.username, role: target.role },
            });
        });
        return NextResponse.json({ message: "User deleted successfully" });
    } catch (error) {
        if (error instanceof Error && error.message === "USER_NOT_FOUND") return NextResponse.json({ error: "User not found" }, { status: 404 });
        return NextResponse.json({ error: "Failed to delete user" }, { status: 409 });
    }
}
