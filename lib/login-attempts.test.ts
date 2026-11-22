import { buildLoginAttemptBuckets, hasActiveLoginBlock, LOGIN_ATTEMPT_LIMITS } from './login-attempts';

jest.mock('./prisma', () => ({
  prisma: {
    loginAttempt: { findMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

describe('login attempt protection', () => {
  it('derives opaque, scope-separated account and source buckets', () => {
    const buckets = buildLoginAttemptBuckets('  Manager  ', '203.0.113.8', 'test-auth-secret');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].bucketHash).toMatch(/^[a-f0-9]{64}$/);
    expect(buckets[0].bucketHash).not.toContain('Manager');
    expect(buckets[0].bucketHash).not.toContain('203.0.113.8');
    expect(buckets[0].bucketHash).not.toBe(buckets[1].bucketHash);
    expect(buckets[0].limit).toBe(LOGIN_ATTEMPT_LIMITS.account);
    expect(buckets[1].limit).toBe(LOGIN_ATTEMPT_LIMITS.source);
  });

  it('normalizes account names but keeps source buckets independent', () => {
    const normalized = buildLoginAttemptBuckets('manager', '203.0.113.8', 'test-auth-secret');
    const equivalent = buildLoginAttemptBuckets(' MANAGER ', '203.0.113.8', 'test-auth-secret');
    const differentSource = buildLoginAttemptBuckets('manager', '203.0.113.9', 'test-auth-secret');
    expect(normalized[0].bucketHash).toBe(equivalent[0].bucketHash);
    expect(normalized[1].bucketHash).toBe(equivalent[1].bucketHash);
    expect(normalized[1].bucketHash).not.toBe(differentSource[1].bucketHash);
    expect(normalized[0].bucketHash).toBe(differentSource[0].bucketHash);
  });

  it('blocks only while the stored lock is still active', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(hasActiveLoginBlock([{ lockedUntil: new Date('2026-11-22T12:15:00Z') }], now)).toBe(true);
    expect(hasActiveLoginBlock([{ lockedUntil: new Date('2026-11-22T11:59:59Z') }], now)).toBe(false);
    expect(hasActiveLoginBlock([{ lockedUntil: null }], now)).toBe(false);
  });
});
