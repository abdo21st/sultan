import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(command, args, env = process.env, input) {
  const result = spawnSync(command, args, { env, input, encoding: 'utf8', timeout: 300_000, windowsHide: true });
  if (result.status !== 0 && args[0] === 'scripts/backup-offsite.mjs') process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw new Error(`Acceptance operation failed: ${command} ${args[0] || ''}`);
  return result.stdout.trim();
}
async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}
async function healthy(base) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch { /* The isolated app may still be starting. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error('Isolated restored app did not become healthy.');
}
async function readAuthenticatedImage(base, credentials, expectedBytes) {
  const path = `${base}/api/orders/storage_acceptance_order/images/0`;
  if ((await fetch(path)).status !== 404) throw new Error('Anonymous image access was not rejected.');
  const jar = new Map();
  async function request(url, init = {}) {
    const response = await fetch(url, { ...init, headers: { ...init.headers, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') }, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async function login() {
    const { csrfToken } = await (await request(`${base}/api/auth/csrf`)).json();
    await request(`${base}/api/auth/callback/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
      body: new URLSearchParams({ username: 'storage_acceptance_admin', password: credentials.password, csrfToken, callbackUrl: base, json: 'true' }),
    });
    const session = await (await request(`${base}/api/auth/session`)).json();
    if (!session?.user?.id) throw new Error('Acceptance administrator could not authenticate.');
    return session;
  }
  const session = await login();
  if (session.user.mustChangePassword) {
    if ((await request(path)).status !== 404) throw new Error('Initial account accessed images before changing its password.');
    const replacement = randomBytes(24).toString('base64url');
    const changed = await request(`${base}/api/profile`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: credentials.password, newPassword: replacement }),
    });
    if (changed.status !== 200) throw new Error('Initial account password change failed.');
    if ((await (await request(`${base}/api/auth/session`)).json())?.user) throw new Error('Password change did not revoke the prior session.');
    credentials.password = replacement;
    if ((await login()).user.mustChangePassword) throw new Error('Initial account remained blocked after changing its password.');
  }
  const response = await request(path);
  if (response.status !== 200 || response.headers.get('content-type') !== 'image/png' || !Buffer.from(await response.arrayBuffer()).equals(expectedBytes)) {
    throw new Error('Authenticated restored image bytes did not match the source.');
  }
}
async function main() {
  const image = process.argv[2] || 'sultan-private-candidate:20261020';
  const migrator = process.argv[3] || 'sultan-production-sultan-migrate';
  const offsiteTest = process.argv.includes('--offsite-test');
  const suffix = randomBytes(6).toString('hex');
  const project = `sultan-storage-acceptance-${suffix}`;
  const temporary = await mkdtemp(join(tmpdir(), 'sultan-storage-acceptance-'));
  const composeFile = join(temporary, 'compose.json');
  const composeArgs = ['compose', '-f', composeFile];
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const databasePassword = randomBytes(24).toString('hex');
  const password = randomBytes(24).toString('base64url');
  const credentials = { password };
  const key = randomBytes(32).toString('base64');
  const imagesVolume = `${project}-images`;
  const restoredVolume = `sultan_images_${suffix}_restore_test`;
  const restoredDatabase = `sultan_${suffix}_restore_test`;
  const url = `postgresql://sultan_user:${databasePassword}@sultan-db:5432/sultan_db`;
  const env = { ...process.env, DB_BACKUP_ENCRYPTION_KEY: key, DATABASE_URL: 'postgresql://sultan_user@127.0.0.1/sultan_db', DIRECT_URL: 'postgresql://sultan_user@127.0.0.1/sultan_db' };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
  const imageFile = '12345678-1234-4123-8123-123456789abc.png';
  const compose = {
    name: project,
    services: {
      'sultan-db': { image: 'postgres:15-alpine', environment: { POSTGRES_USER: 'sultan_user', POSTGRES_DB: 'sultan_db', POSTGRES_PASSWORD: databasePassword }, volumes: ['database:/var/lib/postgresql/data'], healthcheck: { test: ['CMD-SHELL', 'pg_isready -U sultan_user -d sultan_db'], interval: '2s', timeout: '2s', retries: 30 } },
      'sultan-migrate': { image: migrator, environment: { DATABASE_URL: url, DIRECT_URL: url, INITIAL_ADMIN_USERNAME: 'storage_acceptance_admin', INITIAL_ADMIN_PASSWORD: password }, depends_on: { 'sultan-db': { condition: 'service_healthy' } } },
      'sultan-app': { image, ports: [`127.0.0.1:${port}:3000`], environment: { NODE_ENV: 'production', DATABASE_URL: url, DIRECT_URL: url, AUTH_SECRET: randomBytes(32).toString('base64url'), AUTH_TRUST_HOST: 'true', AUTH_URL: base, ORDER_IMAGE_STORAGE: 'local', ORDER_IMAGE_STORAGE_DIR: '/app/storage/order-images' }, volumes: ['images:/app/storage/order-images'], depends_on: { 'sultan-migrate': { condition: 'service_completed_successfully' } } },
    },
    volumes: { database: {}, images: { name: imagesVolume } },
  };
  let stackStarted = false;
  let restoredVolumeCreated = false;
  const mockName = `sultan-offsite-test-${suffix}`;
  let mockStarted = false;
  try {
    await writeFile(composeFile, JSON.stringify(compose), { mode: 0o600 });
    stackStarted = true;
    run('docker', [...composeArgs, 'up', '-d', 'sultan-app']);
    run('docker', [...composeArgs, 'run', '--rm', 'sultan-migrate', 'npm', 'run', 'db:seed']);
    const db = run('docker', [...composeArgs, 'ps', '-q', 'sultan-db']);
    const readFlag = () => run('docker', ['exec', db, 'psql', '-At', '-U', 'sultan_user', '-d', 'sultan_db', '-c', `SELECT "mustChangePassword" FROM "User" WHERE username = 'storage_acceptance_admin'`]);
    if (readFlag() !== 't') throw new Error('New seed did not require an initial password change.');
    run('docker', ['exec', db, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'sultan_user', '-d', 'sultan_db', '-c', `UPDATE "User" SET "mustChangePassword"=false WHERE username='storage_acceptance_admin'`]);
    const enroll = initialPassword => JSON.parse(run('docker', [...composeArgs, 'run', '--rm', '-T', 'sultan-migrate', 'node', '--import', 'tsx', 'scripts/enroll-initial-admin.ts'], process.env, JSON.stringify({ username: 'storage_acceptance_admin', initialPassword })));
    if (enroll(randomBytes(24).toString('hex')).status !== 'preserved' || readFlag() !== 'f') throw new Error('Enrollment changed an account with different credentials.');
    if (enroll(password).status !== 'enrolled' || readFlag() !== 't' || enroll(password).status !== 'already_required') throw new Error('Legacy initial password enrollment was not safe and idempotent.');
    run('docker', ['run', '--rm', '--network', 'none', '--mount', `type=volume,src=${imagesVolume},dst=/app/storage/order-images`, image, 'node', '-e', `require('fs').writeFileSync('/app/storage/order-images/${imageFile}',Buffer.from('${png.toString('base64')}','base64'),{mode:0o600})`]);
    const sql = `BEGIN; INSERT INTO "Facility" (id,name,type) VALUES ('storage_factory','Synthetic factory','FACTORY'),('storage_shop','Synthetic shop','SHOP');
      INSERT INTO "Order" (id,"customerName","customerPhone",description,"dueDate","totalAmount","paidAmount","remainingAmount",images,"factoryId","shopId","updatedAt") VALUES ('storage_acceptance_order','Synthetic customer','0910000000','Cloud storage backup acceptance',NOW()+INTERVAL '7 days',100,70,30,ARRAY['sultan-local://orders/${imageFile}'],'storage_factory','storage_shop',NOW());
      INSERT INTO "Transaction" (id,type,amount,category,"orderId","facilityId","updatedAt") VALUES ('storage_acceptance_payment','INCOME',70,'PAYMENT','storage_acceptance_order','storage_shop',NOW()); COMMIT;`;
    run('docker', ['exec', db, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'sultan_user', '-d', 'sultan_db', '-c', sql]);
    await healthy(base);
    await readAuthenticatedImage(base, credentials, png);
    const accountFingerprint = () => run('docker', ['exec', db, 'psql', '-At', '-U', 'sultan_user', '-d', 'sultan_db', '-c', `SELECT md5(password || ':' || "mustChangePassword"::text || ':' || "sessionVersion"::text) FROM "User" WHERE username = 'storage_acceptance_admin'`]);
    const beforeSeed = accountFingerprint();
    run('docker', [...composeArgs, 'run', '--rm', 'sultan-migrate', 'npm', 'run', 'db:seed']);
    if (beforeSeed !== accountFingerprint()) throw new Error('Repeated seed changed existing credentials or session flags.');
    if (enroll(password).status !== 'preserved' || beforeSeed !== accountFingerprint()) throw new Error('Enrollment changed a password already replaced by its owner.');
    const backupRoot = join(temporary, 'snapshots');
    await mkdir(backupRoot, { mode: 0o700 });
    const app = run('docker', [...composeArgs, 'ps', '-q', 'sultan-app']);
    await writeFile(join(backupRoot, '.backup-paused-app'), app, { mode: 0o600 });
    run('docker', ['pause', app]);
    run(process.execPath, ['scripts/cloud-backup.mjs', 'recover', '--root', backupRoot, '--compose', composeFile], env);
    await healthy(base);
    let snapshot = JSON.parse(run(process.execPath, ['scripts/cloud-backup.mjs', 'create', '--compose', composeFile, '--root', join(temporary, 'snapshots')], env));
    if (snapshot.imageCount !== 1 || snapshot.databaseEntries < 1) throw new Error('Snapshot did not contain the synthetic database and image.');
    const firstSnapshot = snapshot.directory;
    const unrelated = join(backupRoot, 'unrelated');
    await mkdir(unrelated);
    await writeFile(join(unrelated, 'sentinel'), 'keep this unrelated data');
    snapshot = JSON.parse(run(process.execPath, ['scripts/cloud-backup.mjs', 'create', '--compose', composeFile, '--root', backupRoot, '--keep', '1'], env));
    const firstExists = await stat(firstSnapshot).then(() => true, () => false);
    if (snapshot.expired !== 1 || snapshot.retained !== 1 || firstExists || await readFile(join(unrelated, 'sentinel'), 'utf8') !== 'keep this unrelated data') {
      throw new Error('Verified snapshot retention did not preserve its scope.');
    }
    // Authentication must still reject modified ciphertext when the untrusted checksum is updated.
    const tampered = join(temporary, 'tampered');
    await cp(snapshot.directory, tampered, { recursive: true });
    const ciphertextPath = join(tampered, 'order-images.tar.gz.aesgcm');
    const ciphertext = await readFile(ciphertextPath);
    ciphertext[24] ^= 1;
    await writeFile(ciphertextPath, ciphertext);
    const manifestPath = join(tampered, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const { createHash } = await import('node:crypto');
    manifest.images.sha256 = createHash('sha256').update(ciphertext).digest('hex');
    await writeFile(manifestPath, JSON.stringify(manifest));
    const tamperCheck = spawnSync(process.execPath, ['scripts/cloud-backup.mjs', 'verify', '--directory', tampered, '--container', db], { env, stdio: 'ignore' });
    if (tamperCheck.status === 0) throw new Error('Modified ciphertext was accepted.');
    if (offsiteTest) {
      const mockPort = await availablePort();
      const mockEndpoint = `http://127.0.0.1:${mockPort}`;
      const mockImage = 'adobe/s3mock@sha256:ab01a6946750f451ca215a47e91030695b260e4003b8a5a6201d25029b8fca92';
      run('docker', ['run', '-d', '--name', mockName, '--label', `sultan.offsite-test=${suffix}`, '--memory', '768m', '-e', 'JAVA_TOOL_OPTIONS=-Xmx384m', '-e', 'COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=sultan-acceptance', '-p', `127.0.0.1:${mockPort}:9090`, mockImage]);
      mockStarted = true;
      const deadline = Date.now() + 90_000;
      let ready = false;
      while (Date.now() < deadline) {
        try { if ((await fetch(`${mockEndpoint}/favicon.ico`, { signal: AbortSignal.timeout(1000) })).status === 200) { ready = true; break; } } catch { /* Disposable test storage is starting. */ }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      if (!ready) throw new Error('Disposable S3 test storage was not ready.');
      const config = join(temporary, 'offsite-test.env');
      await writeFile(config, `SULTAN_S3_ENDPOINT=${mockEndpoint}\nSULTAN_S3_REGION=us-east-1\nSULTAN_S3_BUCKET=sultan-acceptance\nSULTAN_S3_ACCESS_KEY_ID=${randomBytes(16).toString('hex')}\nSULTAN_S3_SECRET_ACCESS_KEY=${randomBytes(24).toString('hex')}\nSULTAN_S3_PREFIX=sultan-acceptance/\nSULTAN_S3_FORCE_PATH_STYLE=true\n`, { mode: 0o600 });
      const common = ['--config', config, '--allow-loopback-test-endpoint', '--container', db, '--state', join(temporary, 'offsite-state')];
      const upload = () => JSON.parse(run(process.execPath, ['scripts/backup-offsite.mjs', 'upload', '--directory', snapshot.directory, ...common], env));
      if (!upload().readbackMatched || !upload().authenticated) throw new Error('Offsite upload or identical retry did not verify.');
      const pending = JSON.parse(run(process.execPath, ['scripts/backup-offsite.mjs', 'upload-pending', '--root', backupRoot, ...common], env));
      if (pending.uploaded !== 0 || pending.alreadyUploaded !== 1) throw new Error('Offsite upload receipts were not idempotent.');
      const download = join(temporary, 'offsite-downloaded');
      const name = snapshot.directory.split('/').at(-1);
      const downloaded = JSON.parse(run(process.execPath, ['scripts/backup-offsite.mjs', 'download', '--snapshot', name, '--destination', download, ...common], env));
      if (!downloaded.authenticated) throw new Error('Offsite restoration download did not authenticate.');
      for (const file of ['manifest.json', 'database.dump.aesgcm', 'order-images.tar.gz.aesgcm', 'VERIFIED']) {
        if (!(await readFile(join(download, file))).equals(await readFile(join(snapshot.directory, file)))) throw new Error('Downloaded offsite bytes differ from the source.');
      }
      const signedFile = join(download, 'OFFSITE-VERIFIED.json');
      const marker = JSON.parse(await readFile(signedFile, 'utf8'));
      marker.payload.hashes['manifest.json'] = '0'.repeat(64);
      const modified = JSON.stringify(marker);
      const put = await fetch(`${mockEndpoint}/sultan-acceptance/sultan-acceptance/${name}/OFFSITE-VERIFIED.json`, { method: 'PUT', body: modified });
      if (!put.ok) throw new Error('Could not prepare the isolated offsite tamper fixture.');
      const rejectedDirectory = join(temporary, 'tampered-offsite-download');
      const rejected = spawnSync(process.execPath, ['scripts/backup-offsite.mjs', 'download', '--snapshot', name, '--destination', rejectedDirectory, ...common], { env, stdio: 'ignore' });
      if (rejected.status !== 1 || await readFile(join(rejectedDirectory, 'OFFSITE-VERIFIED.json'), 'utf8') !== modified || await stat(join(rejectedDirectory, 'database.dump.aesgcm')).then(() => true, () => false)) throw new Error('Offsite restore did not reject the changed signature before downloading database data.');
      snapshot.directory = download;
      console.log(JSON.stringify({ offsiteTransportAcceptance: true, encryptedReadbackMatched: true, authenticatedSignedManifest: true, identicalUploadRetry: true, pendingReceiptIdempotent: true, tamperedManifestRejectedBeforeDatabaseDownload: true, productionCredentialsUsed: false, actualProviderAcceptance: false }));
    }
    const restored = JSON.parse(run(process.execPath, ['scripts/cloud-backup.mjs', 'restore-images', '--directory', snapshot.directory, '--container', db, '--target-volume', restoredVolume], env));
    restoredVolumeCreated = true;
    if (restored.imageCount !== 1) throw new Error('Image restore did not contain the source image.');
    const restoredDb = JSON.parse(run(process.execPath, ['scripts/db-backup-encrypted.ts', 'restore', '--file', join(snapshot.directory, 'database.dump.aesgcm'), '--container', db, '--target-db', restoredDatabase, '--apply'], env));
    if (restoredDb.restoredCounts !== '1,1,0') throw new Error('Restored financial ledger did not match.');
    compose.services['sultan-app'].environment.DATABASE_URL = url.replace('/sultan_db', `/${restoredDatabase}`);
    compose.services['sultan-app'].environment.DIRECT_URL = compose.services['sultan-app'].environment.DATABASE_URL;
    compose.services['sultan-app'].volumes = ['restoredImages:/app/storage/order-images'];
    compose.volumes.restoredImages = { external: true, name: restoredVolume };
    await writeFile(composeFile, JSON.stringify(compose), { mode: 0o600 });
    run('docker', [...composeArgs, 'up', '-d', '--force-recreate', '--no-deps', 'sultan-app']);
    await healthy(base);
    await readAuthenticatedImage(base, credentials, png);
    console.log(JSON.stringify({ mode: 'cloud-storage-backup-acceptance', anonymousImageAccess: 404, authenticatedImageAccess: 200, encrypted: true, interruptedBackupRecovery: 'unpaused', verifiedRetentionScoped: true, tamperedCiphertextRejected: true, restoredOrders: 1, restoredTransactions: 1, ledgerMismatches: 0, restoredImages: 1, restoredImageBytesMatch: true, recreatedApplication: 'healthy', productionDataUsed: false }));
  } finally {
    if (mockStarted) {
      if (run('docker', ['inspect', '--format', '{{index .Config.Labels "sultan.offsite-test"}}', mockName]) !== suffix) throw new Error('Offsite test container ownership changed.');
      run('docker', ['rm', '-f', mockName]);
    }
    if (stackStarted) run('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans']);
    if (restoredVolumeCreated) run('docker', ['volume', 'rm', restoredVolume]);
    await rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Isolated storage acceptance failed.'); process.exitCode = 1; });
