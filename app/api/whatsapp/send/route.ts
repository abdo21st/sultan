import { NextResponse } from "next/server";

// This endpoint had no in-app callers and accepted caller-controlled phone numbers and
// message bodies while using the server's WhatsApp credential. Notifications are sent
// from the authenticated order-status workflow instead.
export async function POST() {
    return NextResponse.json(
        { error: "Manual WhatsApp sending is disabled; use the order status workflow." },
        { status: 410 }
    );
}
