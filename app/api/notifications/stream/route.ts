import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const user = await getRequestUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const encoder = new TextEncoder();
    let cleanup: (() => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let polling = false;
            let cursor: { createdAt: Date; id: string } | null = null;
            const timers: ReturnType<typeof setInterval>[] = [];

            const close = () => {
                if (closed) return;
                closed = true;
                timers.forEach(clearInterval);
                request.signal.removeEventListener('abort', abort);
                try { controller.close(); } catch { /* Stream already closed. */ }
            };
            cleanup = close;
            const abort = () => close();

            const poll = async () => {
                if (closed || polling) return;
                polling = true;
                try {
                    const current = await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true, mustChangePassword: true } });
                    if (!current || current.mustChangePassword || current.sessionVersion !== user.sessionVersion) { close(); return; }
                    if (cursor === null) {
                        const latest = await prisma.notification.findFirst({
                            where: { userId: user.id },
                            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                            select: { id: true, createdAt: true },
                        });
                        cursor = latest ?? { id: '', createdAt: new Date(Date.now() - 1000) };
                    }

                    const notifications = await prisma.notification.findMany({
                        where: {
                            userId: user.id,
                            read: false,
                            OR: [
                                { createdAt: { gt: cursor.createdAt } },
                                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                            ],
                        },
                        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                        take: 20,
                        select: { id: true, title: true, message: true, link: true, createdAt: true },
                    });

                    if (closed) return;
                    if (notifications.length > 0) {
                        const last = notifications[notifications.length - 1];
                        cursor = { createdAt: last.createdAt, id: last.id };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(notifications)}\n\n`));
                    }
                } catch {
                    close();
                } finally {
                    polling = false;
                }
            };

            request.signal.addEventListener('abort', abort, { once: true });
            timers.push(setInterval(() => {
                if (!closed) {
                    try { controller.enqueue(encoder.encode(': keep-alive\n\n')); } catch { close(); }
                }
            }, 25_000));
            timers.push(setInterval(() => { void poll(); }, 15_000));
            void poll();
        },
        cancel() {
            cleanup?.();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
