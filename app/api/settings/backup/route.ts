
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();
    // Check permissions
    if (!session?.user ||
        (session.user.role !== 'ADMIN' && !(session.user as { permissions?: string[] }).permissions?.includes(PERMISSIONS.SETTINGS_MANAGE))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [
            users,
            roles,
            facilities,
            orders,
            transactions,
            notifications,
            settings
        ] = await Promise.all([
            prisma.user.findMany(),
            prisma.customRole.findMany(),
            prisma.facility.findMany(),
            prisma.order.findMany(),
            prisma.transaction.findMany(),
            prisma.notification.findMany(),
            prisma.systemSettings.findMany()
        ]);

        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                users,
                roles,
                facilities,
                orders,
                transactions,
                notifications,
                settings
            }
        };

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="sultan_backup_${new Date().toISOString().split('T')[0]}.json"`
            }
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
