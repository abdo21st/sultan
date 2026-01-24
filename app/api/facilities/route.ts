import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const facilities = await prisma.facility.findMany();
        return NextResponse.json(facilities);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch facilities" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const facility = await prisma.facility.create({
            data: {
                name: body.name,
                type: body.type, // 'FACTORY' or 'SHOP'
                location: body.location,
            },
        });
        return NextResponse.json(facility);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to create facility" },
            { status: 500 }
        );
    }
}
