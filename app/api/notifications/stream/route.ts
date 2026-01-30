import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session) return new Response("Unauthorized", { status: 401 });
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Keep-alive heartbeat
            const timer = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': keep-alive\n\n'));
                } catch {
                    clearInterval(timer);
                }
            }, 30000);

            // Poll for new notifications for this user
            const poll = setInterval(async () => {
                try {
                    const unreadNotifications = await prisma.notification.findMany({
                        where: {
                            userId: session.user.id,
                            read: false,
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    });

                    if (unreadNotifications.length > 0) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(unreadNotifications)}\n\n`));

                        // We mark them as "delivered" or just let the client handle it.
                        // For simplicity in this SSE mock, we just send them.
                    }
                } catch (e) {
                    console.error("SSE Polling Error:", e);
                    clearInterval(poll);
                    clearInterval(timer);
                    try {
                        controller.close();
                    } catch {
                        // Ignore if already closed
                    }
                }
            }, 5000); // Poll every 5 seconds for simulation of "real-time"

            // Clean up on close
            return () => {
                clearInterval(timer);
                clearInterval(poll);
            };
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
