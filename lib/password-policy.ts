import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, PASSWORD_MINIMUM_MESSAGE } from './password-constraints';

// bcrypt only uses the first 72 bytes. Reject longer new secrets instead of silently truncating.
export const newPasswordSchema = z.string()
    .min(MIN_PASSWORD_LENGTH, PASSWORD_MINIMUM_MESSAGE)
    .max(128)
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'كلمة المرور أطول من الحد المدعوم؛ استخدم عبارة أقصر');
