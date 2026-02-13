import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { orderId, phone, message } = body;

        if (!orderId || !phone || !message) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Get WhatsApp settings
        const settings = await prisma.systemSettings.findFirst();

        if (!settings?.whatsappAutoSend) {
            return NextResponse.json(
                { error: "WhatsApp auto-send is disabled" },
                { status: 400 }
            );
        }

        if (!settings.whatsappApiUrl || !settings.whatsappApiKey) {
            return NextResponse.json(
                { error: "WhatsApp API not configured" },
                { status: 400 }
            );
        }

        // Send WhatsApp message using the configured API
        // This is a generic implementation - adjust based on your WhatsApp API provider
        const whatsappResponse = await fetch(settings.whatsappApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.whatsappApiKey}`,
            },
            body: JSON.stringify({
                phone: phone,
                message: message,
            }),
        });

        if (!whatsappResponse.ok) {
            const errorData = await whatsappResponse.text();
            console.error("WhatsApp API error:", errorData);
            return NextResponse.json(
                { error: "Failed to send WhatsApp message" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("WhatsApp send error:", error);
        return NextResponse.json(
            { error: "Failed to send WhatsApp message" },
            { status: 500 }
        );
    }
}
