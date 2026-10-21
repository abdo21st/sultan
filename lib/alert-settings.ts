import { z } from 'zod';
import { CORRECTION_ALERT_TRIGGER, LEGACY_STATUS_MAPPING, PRIMARY_ORDER_STATUSES, normalizeOrderStatus } from './constants';

export const alertSchema = z.object({
    name: z.string().trim().min(2, 'أدخل اسماً من حرفين على الأقل.').max(100),
    triggerStatus: z.string().transform(status =>
        ['orders:status:review', 'REVIEW_NEEDED'].includes(status) ? CORRECTION_ALERT_TRIGGER : normalizeOrderStatus(Object.entries(LEGACY_STATUS_MAPPING).find(([, legacy]) => legacy === status)?.[0] ?? status),
    ).refine(status => [...PRIMARY_ORDER_STATUSES, CORRECTION_ALERT_TRIGGER].includes(status), 'اختر مرحلة الطلب أو علامة التصحيح.'),
    timingDays: z.number().int().min(-365).max(365),
    whatsappEnabled: z.boolean(),
    recipientPhones: z.array(z.string().trim().regex(/^\d{10,15}$/, 'أدخل رقم الهاتف بالصيغة الدولية.')).max(100)
        .transform(phones => [...new Set(phones)]),
}).refine(value => !value.whatsappEnabled || value.recipientPhones.length > 0, {
    path: ['recipientPhones'], message: 'أضف رقم مستلم لتفعيل تنبيه واتساب.',
});
