import { getRequestUser } from '@/lib/request-user';
import { notificationStream } from '@/lib/notification-stream';
import type { NotificationStreamEvent } from '@/lib/notification-stream-types';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const user = await getRequestUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const encoder = new TextEncoder();
    let cleanup: (() => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            const unsubscribe: { current?: () => void } = {};
            const close = () => {
                if (closed) return;
                closed = true; unsubscribe.current?.(); request.signal.removeEventListener('abort', close);
                try { controller.close(); } catch { /* Reader already disconnected. */ }
            };
            const send = (event: NotificationStreamEvent) => {
                if (closed) return;
                if ((controller.desiredSize ?? 0) <= -8) { close(); return; }
                const packet = event.kind === 'heartbeat' ? ': keep-alive\n\n' : event.kind === 'state'
                    ? `event: state\ndata: ${JSON.stringify(event.value)}\n\n` : `data: ${JSON.stringify(event.value)}\n\n`;
                try { controller.enqueue(encoder.encode(packet)); } catch { close(); }
            };
            cleanup = close; request.signal.addEventListener('abort', close, { once: true });
            if (request.signal.aborted) { close(); return; }
            controller.enqueue(encoder.encode(': connected\n\n'));
            unsubscribe.current = notificationStream.subscribe(user, send, close);
            if (closed) unsubscribe.current();
        },
        cancel() { cleanup?.(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
