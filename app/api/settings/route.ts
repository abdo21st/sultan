
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";
import { PERMISSIONS } from "../../../lib/permissions";

export async function GET() {
    try {
        let settings = await prisma.systemSettings.findFirst();

        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    appName: "سلطان",
                    themeColor: "#d97706",
                }
            });
        }

        return NextResponse.json(settings);
        return NextResponse.json(settings);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();

        const hasPermission = session?.user?.role === "ADMIN" ||
            (session?.user as { permissions?: string[] })?.permissions?.includes(PERMISSIONS.SETTINGS_MANAGE);

        if (!session?.user || !hasPermission) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Upsert acts as "Update if exists, Create if not"
        const settings = await prisma.systemSettings.upsert({
            where: { id: "default" },
            update: {
                appName: body.appName,
                logoUrl: body.logoUrl,
                printHeader: body.printHeader,
                printFooter: body.printFooter,
                themeColor: body.themeColor,
            },
            create: {
                id: "default",
                appName: body.appName || "سلطان",
                logoUrl: body.logoUrl,
                printHeader: body.printHeader,
                printFooter: body.printFooter,
                themeColor: body.themeColor,
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Settings update error:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}
