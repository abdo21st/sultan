import { authorizeCronRequest } from '@/lib/cron-auth';
import { processScheduledAlerts } from '@/lib/services/scheduled-alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = authorizeCronRequest(request);
    if (auth === 'unconfigured') return Response.json({ error: 'Scheduled alerts are not configured.' }, { status: 503 });
    if (auth !== 'authorized') return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    try {
        return Response.json(await processScheduledAlerts(), { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        console.error('Scheduled alerts could not run.');
        return Response.json({ error: 'Scheduled alerts could not run.' }, { status: 503 });
    }
}
