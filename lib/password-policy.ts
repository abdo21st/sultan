import { z } from 'zod';

// bcrypt only uses the first 72 bytes. Reject longer new secrets instead of silently truncating.
export const newPasswordSchema = z.string()
    .min(12, 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل')
    .max(128)
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'كلمة المرور أطول من الحد المدعوم؛ استخدم عبارة أقصر');
