import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";
import { PERMISSIONS } from "../../../lib/permissions";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.FACILITIES_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
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
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.FACILITIES_ADD)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const json = await request.json();
        const result = facilitySchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const facility = await prisma.facility.create({
            data: {
                name: body.name,
                type: body.type,
                location: body.location,
            },
        });
        return NextResponse.json(facility);
    } catch {
        return NextResponse.json(
            { error: "فشل إضافة المنشأة" },
            { status: 500 }
        );
    }
}
