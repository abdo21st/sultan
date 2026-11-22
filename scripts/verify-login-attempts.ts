import { randomUUID } from 'node:crypto';
import { buildLoginAttemptBuckets, isLoginAttemptBlocked, recordFailedLogin } from '../lib/login-attempts';
import { prisma } from '../lib/prisma';

const secret = randomUUID() + randomUUID();
const ipAddress = '192.0.2.88';
const testUser = `qa_security_${randomUUID()}`;
const cleanupHashes = new Set<string>();

try {
  const accountBuckets = buildLoginAttemptBuckets(testUser, ipAddress, secret);
  accountBuckets.forEach((bucket) => cleanupHashes.add(bucket.bucketHash));
  for (let attempt = 0; attempt < 8; attempt += 1) await recordFailedLogin(accountBuckets);
  if (!await isLoginAttemptBlocked(accountBuckets)) throw new Error('The account bucket did not lock at its configured threshold.');

  for (let attempt = 0; attempt < 17; attempt += 1) {
    const buckets = buildLoginAttemptBuckets(`qa_security_source_${attempt}_${randomUUID()}`, ipAddress, secret);
    buckets.forEach((bucket) => cleanupHashes.add(bucket.bucketHash));
    await recordFailedLogin(buckets);
  }
  const sourceBuckets = buildLoginAttemptBuckets(`qa_security_source_check_${randomUUID()}`, ipAddress, secret);
  sourceBuckets.forEach((bucket) => cleanupHashes.add(bucket.bucketHash));
  if (!await isLoginAttemptBlocked(sourceBuckets)) throw new Error('The source bucket did not lock at its configured threshold.');

  console.log('Database-backed account and source lockout checks passed.');
} finally {
  await prisma.loginAttempt.deleteMany({ where: { bucketHash: { in: [...cleanupHashes] } } });
  await prisma.$disconnect();
}
