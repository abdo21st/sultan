import { NextResponse } from 'next/server';
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";
import { PERMISSIONS } from "../../../lib/permissions";

export async function POST() {
    try {
        // 1. Create or get Super Admin role
        const adminRole = await prisma.customRole.upsert({
            where: { name: 'SUPER_ADMIN' },
            update: {
                permissions: Object.values(PERMISSIONS)
            },
            create: {
                name: 'SUPER_ADMIN',
                displayName: 'مدير النظام',
                permissions: Object.values(PERMISSIONS),
            },
        });

        // 2. Get all users
        const users = await prisma.user.findMany();

        // 3. Update each user to have admin role and all permissions
        const updates = await Promise.all(
            users.map(user =>
                prisma.user.update({
                    where: { id: user.id },
                    data: {
                        permissions: Object.values(PERMISSIONS),
                        roles: {
                            connect: { id: adminRole.id }
                        }
                    },
                    include: { roles: true }
                })
            )
        );

        return NextResponse.json({
            success: true,
            message: `تم تحديث ${updates.length} مستخدم بنجاح`,
            adminRole,
            updatedUsers: updates.map(u => ({
                username: u.username,
                displayName: u.displayName,
                roles: u.roles.map(r => r.displayName),
                permissionsCount: u.permissions.length
            }))
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({
            error: 'فشل التحديث',
            details: String(error)
        }, { status: 500 });
    }
}
