import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { DEFAULT_ROLES, PERMISSIONS } from '@/lib/permissions';
import { CORRECTION_ALERT_TRIGGER, CLOSED_ORDER_STATUSES, LEGACY_STATUS_MAPPING, normalizeOrderStatus } from '@/lib/constants';
import { canAccessOrderFacility, canViewOrderStatus } from '@/lib/request-user';
import { businessDateKey, businessDayBounds, shiftDateKey } from '@/lib/business-date';
import { parseAllowedWhatsAppApiUrl } from '@/lib/whatsapp-security';

export async function processScheduledAlerts() {
    const started = new Date();
    const day = businessDateKey(started);
    const scheduledDay = new Date(`${day}T00:00:00Z`);
    const deadline = Date.now() + 40_000;
    const summary = { internal: 0, whatsappSent: 0, whatsappFailed: 0, uncertain: 0, whatsappConfigured: false };
    await prisma.scheduledJobState.upsert({
        where: { id: 'alerts' }, create: { id: 'alerts', lastStartedAt: started },
        update: { lastStartedAt: started },
    });
    try {
        await prisma.alertDelivery.updateMany({
            where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 600_000) } },
            data: { status: 'UNKNOWN', errorCode: 'DELIVERY_RESULT_UNKNOWN' },
        });
        const [rules, accounts, settings] = await Promise.all([
            prisma.alertSetting.findMany({ orderBy: { id: 'asc' } }),
            prisma.user.findMany({ select: { id: true, role: true, facilityId: true, permissions: true, roles: { select: { permissions: true } } } }),
            prisma.systemSettings.findUnique({ where: { id: 'default' } }),
        ]);
        const users = accounts.map(user => ({ ...user, permissions: [...new Set([
            ...DEFAULT_ROLES[user.role], ...user.permissions, ...user.roles.flatMap(role => role.permissions),
        ])] }));
        const apiUrl = settings?.whatsappApiUrl ? parseAllowedWhatsAppApiUrl(settings.whatsappApiUrl) : null;
        const whatsappReady = Boolean(settings?.whatsappAutoSend && apiUrl && settings?.whatsappApiKey);
        summary.whatsappConfigured = whatsappReady;
        let externalBudget = 4;

        for (const rule of rules) {
            if (Date.now() > deadline) break;
            const dueDay = shiftDateKey(day, -rule.timingDays);
            const canonical = normalizeOrderStatus(rule.triggerStatus);
            const statuses = [canonical, LEGACY_STATUS_MAPPING[canonical]].filter(Boolean);
            const base = { dueDate: businessDayBounds(dueDay), ...(canonical === CORRECTION_ALERT_TRIGGER ? { reviewRequired: true, status: { notIn: [...CLOSED_ORDER_STATUSES, 'orders:status:completed', 'COMPLETED'] } } : { status: { in: statuses }, reviewRequired: false }), adjustments: { none: { status: 'REQUESTED' } } };
            const orders = await prisma.order.findMany({
                where: { ...base, alertDeliveries: { none: { alertSettingId: rule.id, scheduledDay, channel: 'INTERNAL', recipient: '*' } } },
                select: { id: true, serialNumber: true, status: true, factoryId: true, shopId: true },
                orderBy: { id: 'asc' }, take: 100,
            });
            for (const order of orders) {
                if (Date.now() > deadline) break;
                const targets = users.filter(user => user.permissions.includes(PERMISSIONS.ORDERS_VIEW)
                    && canAccessOrderFacility(user, order) && canViewOrderStatus(user, order.status));
                const created = await prisma.$transaction(async tx => {
                    const claim = await tx.alertDelivery.createMany({
                        data: [{ alertSettingId: rule.id, orderId: order.id, scheduledDay, channel: 'INTERNAL', recipient: '*', status: 'SENT' }],
                        skipDuplicates: true,
                    });
                    if (!claim.count) return 0;
                    if (targets.length) await tx.notification.createMany({ data: targets.map(user => ({
                        userId: user.id, title: rule.name,
                        message: `تذكير بالطلب #${order.serialNumber}، موعد التسليم ${dueDay}.`, link: `/orders/${order.id}`,
                    })) });
                    return targets.length;
                });
                summary.internal += created;
            }

            if (!rule.whatsappEnabled || !whatsappReady || !apiUrl) continue;
            for (const phone of new Set(rule.recipientPhones)) {
                if (externalBudget <= 0 || Date.now() > deadline) break;
                const pending = await prisma.order.findMany({
                    where: { ...base, alertDeliveries: { none: { alertSettingId: rule.id, scheduledDay, channel: 'WHATSAPP', recipient: phone } } },
                    select: { id: true, serialNumber: true }, orderBy: { id: 'asc' }, take: externalBudget,
                });
                for (const order of pending) {
                    if (externalBudget <= 0 || Date.now() > deadline) break;
                    const id = randomUUID();
                    const claimed = await prisma.alertDelivery.createMany({ data: [{
                        id, alertSettingId: rule.id, orderId: order.id, scheduledDay,
                        channel: 'WHATSAPP', recipient: phone, status: 'SENDING',
                    }], skipDuplicates: true });
                    if (!claimed.count) continue;
                    externalBudget--;
                    let status: string;
                    let errorCode: string | null = null;
                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings!.whatsappApiKey}`, 'Idempotency-Key': id },
                            body: JSON.stringify({ phone, message: `${rule.name}\nطلب رقم #${order.serialNumber}\nموعد التسليم: ${dueDay}` }),
                        });
                        status = response.ok ? 'SENT' : 'FAILED';
                        if (!response.ok) errorCode = `PROVIDER_HTTP_${response.status}`;
                        await response.body?.cancel().catch(() => undefined);
                    } catch {
                        // A timeout can occur after provider acceptance. Leave it for
                        // operator review rather than risking another message.
                        status = 'UNKNOWN';
                        errorCode = 'DELIVERY_RESULT_UNKNOWN';
                    }
                    await prisma.alertDelivery.update({ where: { id }, data: { status, errorCode } });
                    if (status === 'SENT') summary.whatsappSent++;
                    else if (status === 'FAILED') summary.whatsappFailed++;
                    else summary.uncertain++;
                }
            }
        }
        await prisma.scheduledJobState.update({ where: { id: 'alerts' }, data: { lastSuccessAt: new Date(), lastError: null } });
        return summary;
    } catch (error) {
        await prisma.scheduledJobState.update({ where: { id: 'alerts' }, data: { lastError: 'ALERT_PROCESSING_FAILED' } }).catch(() => undefined);
        throw error;
    }
}
