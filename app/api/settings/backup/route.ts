
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { NextResponse } from "next/server";

export async function GET() {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!user.permissions.includes(PERMISSIONS.BACKUP_MANAGE)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    try {
        const [
            users,
            roles,
            facilities,
            orders,
            transactions,
            notifications,
            settings,
            capacityRules,
            alertSettings,
            auditLogs,
            blobDeletions,
        ] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    phoneNumber: true,
                    role: true,
                    roles: { select: { id: true, name: true, displayName: true, description: true, permissions: true } },
                    permissions: true,
                    facilityId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.customRole.findMany(),
            prisma.facility.findMany(),
            prisma.order.findMany(),
            prisma.transaction.findMany(),
            prisma.notification.findMany(),
            prisma.systemSettings.findMany({
                select: {
                    id: true,
                    appName: true,
                    logoUrl: true,
                    printHeader: true,
                    printFooter: true,
                    themeColor: true,
                    whatsappAutoSend: true,
                    whatsappApiUrl: true,
                    updatedAt: true,
                },
            }),
            prisma.capacityRule.findMany(),
            prisma.alertSetting.findMany(),
            prisma.auditLog.findMany(),
            prisma.blobDeletion.findMany(),
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
                settings,
                capacityRules,
                alertSettings,
                auditLogs,
                blobDeletions,
            }
        };

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="sultan_export_${new Date().toISOString().split('T')[0]}.json"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            }
        });
    } catch {
        return NextResponse.json({ error: "Could not create the data export." }, { status: 500 });
    }
}
