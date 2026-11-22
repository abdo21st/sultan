import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { prisma } from './prisma';

const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;
const RETENTION_HOURS = 24;

export const LOGIN_ATTEMPT_LIMITS = {
  account: 8,
  source: 25,
} as const;

export type LoginAttemptBucket = {
  bucketHash: string;
  limit: number;
};

type LoginAttemptState = { lockedUntil: Date | null };

function opaqueHash(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function buildLoginAttemptBuckets(username: string, clientIp: string | null, secret: string): LoginAttemptBucket[] {
  if (!secret) throw new Error('AUTH_SECRET must be configured for login attempt protection.');

  const normalizedUsername = username.normalize('NFKC').trim().toLowerCase().slice(0, 120) || '<empty>';
  const normalizedIp = clientIp && isIP(clientIp.trim()) ? clientIp.trim() : 'unknown';

  return [
    { bucketHash: opaqueHash(`account\0${normalizedUsername}`, secret), limit: LOGIN_ATTEMPT_LIMITS.account },
    { bucketHash: opaqueHash(`source\0${normalizedIp}`, secret), limit: LOGIN_ATTEMPT_LIMITS.source },
  ];
}

export function hasActiveLoginBlock(rows: LoginAttemptState[], now = new Date()): boolean {
  return rows.some((row) => row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime());
}

export async function isLoginAttemptBlocked(buckets: LoginAttemptBucket[], now = new Date()): Promise<boolean> {
  const rows = await prisma.loginAttempt.findMany({
    where: { bucketHash: { in: buckets.map((bucket) => bucket.bucketHash) } },
    select: { lockedUntil: true },
  });
  return hasActiveLoginBlock(rows, now);
}

export async function recordFailedLogin(buckets: LoginAttemptBucket[], now = new Date()): Promise<void> {
  const windowCutoff = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const lockUntil = new Date(now.getTime() + BLOCK_MINUTES * 60 * 1000);
  const retentionCutoff = new Date(now.getTime() - RETENTION_HOURS * 60 * 60 * 1000);

  await prisma.$transaction(async (transaction) => {
    for (const bucket of buckets) {
      await transaction.$executeRaw`
        INSERT INTO "login_attempts" ("bucket_hash", "window_started_at", "failure_count", "locked_until", "last_failure_at")
        VALUES (${bucket.bucketHash}, ${now}, 1, NULL, ${now})
        ON CONFLICT ("bucket_hash") DO UPDATE SET
          "window_started_at" = CASE
            WHEN "login_attempts"."window_started_at" <= ${windowCutoff}
              OR ("login_attempts"."locked_until" IS NOT NULL AND "login_attempts"."locked_until" <= ${now})
            THEN ${now} ELSE "login_attempts"."window_started_at" END,
          "failure_count" = CASE
            WHEN "login_attempts"."window_started_at" <= ${windowCutoff}
              OR ("login_attempts"."locked_until" IS NOT NULL AND "login_attempts"."locked_until" <= ${now})
            THEN 1 ELSE "login_attempts"."failure_count" + 1 END,
          "locked_until" = CASE
            WHEN "login_attempts"."window_started_at" <= ${windowCutoff}
              OR ("login_attempts"."locked_until" IS NOT NULL AND "login_attempts"."locked_until" <= ${now})
            THEN NULL
            WHEN "login_attempts"."failure_count" + 1 >= ${bucket.limit}
            THEN ${lockUntil}
            ELSE "login_attempts"."locked_until" END,
          "last_failure_at" = ${now}
      `;
    }

    await transaction.loginAttempt.deleteMany({
      where: { lastFailureAt: { lt: retentionCutoff }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    });
  });
}

export async function clearSuccessfulAccountFailures(accountBucketHash: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { bucketHash: accountBucketHash } });
}
