import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { PERMISSIONS } from "../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!user.permissions.includes(PERMISSIONS.FACILITIES_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const facilities = await prisma.facility.findMany();
        return NextResponse.json(facilities);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch facilities" },
            { status: 500 }
        );
    }
}

import { z } from "zod";

const facilitySchema = z.object({
    name: z.string().min(2, "اسم المنشأة يجب أن يكون حرفين على الأقل"),
    type: z.enum(["FACTORY", "SHOP"]),
    location: z.string().min(2, "الموقع يجب أن يكون حرفين على الأقل"),
});

export async function POST(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!user.permissions.includes(PERMISSIONS.FACILITIES_ADD)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const json = await request.json();
        const result = facilitySchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const facility = await prisma.$transaction(async (tx) => {
            const created = await tx.facility.create({ data: body });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "FACILITY",
                entityId: created.id,
                action: "CREATED",
                after: body,
            });
            return created;
        });
        return NextResponse.json(facility);
    } catch {
        return NextResponse.json(
            { error: "فشل إضافة المنشأة" },
            { status: 500 }
        );
    }
}
