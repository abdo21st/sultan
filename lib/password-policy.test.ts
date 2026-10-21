/** @jest-environment node */
import { newPasswordSchema } from './password-policy';
import { MIN_PASSWORD_LENGTH, PASSWORD_MINIMUM_MESSAGE } from './password-constraints';

it('requires the requested six-character minimum', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    const result = newPasswordSchema.safeParse('A1!b2');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(PASSWORD_MINIMUM_MESSAGE);
});

it.each(['A1!b2c', '123456', 'حروفست', 'longer-password'])('accepts a valid password with at least six characters: %s', value => {
    expect(newPasswordSchema.safeParse(value).success).toBe(true);
});

it('accepts exactly 72 UTF-8 bytes', () => {
    expect(newPasswordSchema.safeParse('ض'.repeat(36)).success).toBe(true);
});

it('rejects over 72 UTF-8 bytes without silently truncating', () => {
    expect(newPasswordSchema.safeParse('ض'.repeat(37)).success).toBe(false);
    expect(newPasswordSchema.safeParse('a'.repeat(73)).success).toBe(false);
});
