import { prisma } from '@/lib/prisma';
import { canAccessAllFacilities, getRequestUser } from '@/lib/request-user';
import { PERMISSIONS } from '@/lib/permissions';
import { parseAllowedWhatsAppApiUrl } from '@/lib/whatsapp-security';

export async function GET() {
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.ALERTS_MANAGE) || !canAccessAllFacilities(user)) return Response.json({ error: 'غير مصرح' }, { status: 403 });
    const [job, failures, settings] = await Promise.all([
        prisma.scheduledJobState.findUnique({ where: { id: 'alerts' } }),
        prisma.alertDelivery.findMany({
            where: { status: { in: ['FAILED', 'UNKNOWN', 'SENDING'] } },
            select: { id: true, channel: true, status: true, errorCode: true, updatedAt: true, alertSetting: { select: { name: true } }, order: { select: { id: true, serialNumber: true } } },
            orderBy: { updatedAt: 'desc' }, take: 20,
        }),
        prisma.systemSettings.findUnique({ where: { id: 'default' }, select: { whatsappAutoSend: true, whatsappApiUrl: true, whatsappApiKey: true } }),
    ]);
    return Response.json({ job, stale: !job?.lastSuccessAt || Date.now() - job.lastSuccessAt.getTime() > 900_000, failures, whatsappConfigured: Boolean(settings?.whatsappAutoSend && settings.whatsappApiUrl && parseAllowedWhatsAppApiUrl(settings.whatsappApiUrl) && settings.whatsappApiKey) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
