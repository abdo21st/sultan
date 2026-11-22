import { randomUUID } from 'node:crypto';

const appPassword = process.env.QA_APP_DB_PASSWORD;
const sourceDatabaseUrl = process.env.DATABASE_URL;
if (!sourceDatabaseUrl || !appPassword || !/^[a-f0-9]{64}$/.test(appPassword)) {
  throw new Error('The login attempt check requires the isolated QA database settings.');
}
const databaseUrl = new URL(sourceDatabaseUrl);
if (databaseUrl.hostname !== 'sultan-db' || databaseUrl.pathname !== '/sultan_mobile_acceptance') {
  throw new Error('The login attempt check may only use the isolated QA database.');
}
databaseUrl.username = 'sultan_mobile_runtime';
databaseUrl.password = appPassword;
process.env.DATABASE_URL = databaseUrl.href;

async function verifyLoginAttemptProtection() {
  const [{ buildLoginAttemptBuckets, isLoginAttemptBlocked, recordFailedLogin }, { prisma }] = await Promise.all([
    import('../lib/login-attempts'),
    import('../lib/prisma'),
  ]);

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
}

void verifyLoginAttemptProtection();
