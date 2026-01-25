
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
    const session = await auth();

    // Bootstrap mode: Allow access if no roles exist yet
    const roleCount = await prisma.customRole.count();
    const isBootstrap = roleCount === 0;

    if (!isBootstrap && !session?.user?.permissions?.includes(PERMISSIONS.ROLES_MANAGE)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const roles = await prisma.customRole.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(roles);
    } catch {
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.permissions?.includes(PERMISSIONS.ROLES_MANAGE)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, displayName, permissions } = body;

        const role = await prisma.customRole.create({
            data: {
                name,
                displayName,
                permissions: permissions || []
            }
        });
        return NextResponse.json(role);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
    }
}
