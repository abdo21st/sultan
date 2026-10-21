import { z } from 'zod';
import { LEGACY_STATUS_MAPPING, ORDER_STATUS } from './constants';

export const alertSchema = z.object({
    name: z.string().trim().min(2, 'أدخل اسماً من حرفين على الأقل.').max(100),
    triggerStatus: z.string().transform(status =>
        Object.entries(LEGACY_STATUS_MAPPING).find(([, legacy]) => legacy === status)?.[0] ?? status,
    ).refine(status => (Object.values(ORDER_STATUS) as string[]).includes(status), 'اختر حالة طلب صحيحة.'),
    timingDays: z.number().int().min(-365).max(365),
    whatsappEnabled: z.boolean(),
    recipientPhones: z.array(z.string().trim().regex(/^\d{10,15}$/, 'أدخل رقم الهاتف بالصيغة الدولية.')).max(100)
        .transform(phones => [...new Set(phones)]),
}).refine(value => !value.whatsappEnabled || value.recipientPhones.length > 0, {
    path: ['recipientPhones'], message: 'أضف رقم مستلم لتفعيل تنبيه واتساب.',
});
