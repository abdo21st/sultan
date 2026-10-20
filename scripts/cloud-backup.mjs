import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, unlinkSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { pipeline } from 'node:stream/promises';

const magic = Buffer.from('SULTANFS1');
const names = { database: 'database.dump.aesgcm', images: 'order-images.tar.gz.aesgcm' };
const imageEntry = /^\.\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|gif|webp)$/;
let pausedApplication;
let pauseMarker;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  if (pausedApplication) {
    try {
      run('docker', ['unpause', pausedApplication]);
      if (pauseMarker) unlinkSync(pauseMarker);
    } catch { /* The systemd recovery step retries using the private marker. */ }
  }
  process.exit(130);
});
function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 300_000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Operation failed: ${basename(command)} ${args[0] || ''}`);
  return result.stdout.trim();
}
function validateDockerName(value) {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)) throw new Error('Invalid Docker resource name.');
  return value;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
function encryptionKey() {
  const encoded = process.env.DB_BACKUP_ENCRYPTION_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded.trim()) throw new Error('A canonical 32-byte backup key is required.');
  return key;
}
const databaseEnv = () => ({ ...process.env, DATABASE_URL: 'postgresql://sultan_user@127.0.0.1/sultan_db', DIRECT_URL: 'postgresql://sultan_user@127.0.0.1/sultan_db' });
function databaseCli(args) {
  return JSON.parse(run(process.execPath, ['scripts/db-backup-encrypted.ts', ...args], databaseEnv()));
}
async function encryptImages(volume, destination, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const file = await open(destination, 'wx', 0o600);
  const child = spawn('docker', ['run', '--rm', '--network', 'none', '--read-only', '--mount', `type=volume,src=${volume},dst=/images,readonly`, 'postgres:15-alpine', 'tar', '-czf', '-', '-C', '/images', '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit); });
  // Register a rejection handler immediately, including when an earlier file write fails.
  exited.catch(() => undefined);
  child.stderr.resume();
  try {
    await file.writeFile(Buffer.concat([magic, iv]));
    for await (const chunk of child.stdout) await file.writeFile(cipher.update(chunk));
    if (await exited !== 0) throw new Error('Images archive failed.');
    await file.writeFile(cipher.final());
    await file.writeFile(cipher.getAuthTag());
    await file.sync();
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    await file.close();
  }
}
async function decryptImages(source, destination, key) {
  const file = await open(source, 'r');
  try {
    const { size } = await file.stat();
    if (size < magic.length + 12 + 16) throw new Error('Invalid images archive.');
    const header = Buffer.alloc(magic.length + 12);
    await file.read(header, 0, header.length, 0);
    if (!header.subarray(0, magic.length).equals(magic)) throw new Error('Invalid images archive header.');
    const tag = Buffer.alloc(16);
    await file.read(tag, 0, 16, size - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length));
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(source, { start: header.length, end: size - 17 }), decipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } finally { await file.close(); }
}
async function inspectSnapshot(directory, container, key) {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'sultan-cloud-v1') throw new Error('Unsupported snapshot format.');
  for (const part of ['database', 'images']) {
    if (manifest[part]?.file !== names[part] || await digest(join(directory, names[part])) !== manifest[part].sha256) {
      throw new Error('Snapshot checksum mismatch.');
    }
  }
  const database = databaseCli(['verify', '--file', join(directory, names.database), '--container', validateDockerName(container)]);
  const temporary = await mkdtemp(join(tmpdir(), 'sultan-images-verify-'));
  await chmod(temporary, 0o700);
  try {
    const archive = join(temporary, 'images.tar.gz');
    await decryptImages(join(directory, names.images), archive, key);
    const entries = run('tar', ['-tzf', archive]).split(/\r?\n/).filter(Boolean);
    if (entries.some((entry) => entry !== './' && !imageEntry.test(entry))) throw new Error('Unsafe image archive member.');
    return { databaseEntries: database.archiveEntries, imageCount: entries.filter((entry) => entry !== './').length };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
async function createSnapshot(key) {
  const compose = resolve(argument('--compose', 'docker-compose.cloud.yml'));
  const composeArgs = ['compose', '-f', compose];
  const app = validateDockerName(run('docker', [...composeArgs, 'ps', '-q', 'sultan-app']));
  const db = validateDockerName(run('docker', [...composeArgs, 'ps', '-q', 'sultan-db']));
  const state = JSON.parse(run('docker', ['inspect', '--format', '{{json .State}}', app]));
  if (!state.Running || state.Paused) throw new Error('The application must be running and unpaused before backup.');
  const mounts = JSON.parse(run('docker', ['inspect', '--format', '{{json .Mounts}}', app]));
  const volume = validateDockerName(mounts.find((mount) => mount.Type === 'volume' && mount.Destination === '/app/storage/order-images')?.Name);
  const root = resolve(argument('--root', '/var/backups/sultan-production'));
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== root) throw new Error('Backup root must not contain symbolic links.');
  await chmod(root, 0o700);
  const directory = await mkdtemp(join(root, `sultan-${new Date().toISOString().replace(/[:.]/g, '-')}-`));
  await chmod(directory, 0o700);
  const marker = join(root, '.backup-paused-app');
  let ownsMarker = false;
  try {
    await writeFile(marker, app, { flag: 'wx', mode: 0o600 });
    ownsMarker = true;
    pauseMarker = marker;
    pausedApplication = app;
    run('docker', ['pause', app]);
    databaseCli(['create', '--container', db, '--output', join(directory, names.database)]);
    await encryptImages(volume, join(directory, names.images), key);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  } finally {
    if (ownsMarker) {
      const current = JSON.parse(run('docker', ['inspect', '--format', '{{json .State}}', app]));
      if (current.Paused) run('docker', ['unpause', app]);
      await rm(marker);
      pausedApplication = undefined;
      pauseMarker = undefined;
    }
  }
  const manifest = { format: 'sultan-cloud-v1', createdAt: new Date().toISOString(), consistency: 'application-paused', database: { file: names.database, sha256: await digest(join(directory, names.database)) }, images: { file: names.images, sha256: await digest(join(directory, names.images)) } };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  const verification = await inspectSnapshot(directory, db, key);
  await writeFile(join(directory, 'VERIFIED'), new Date().toISOString(), { flag: 'wx', mode: 0o600 });
  const keep = Number(argument('--keep', '30'));
  if (!Number.isSafeInteger(keep) || keep < 1 || keep > 365) throw new Error('Retention must keep between 1 and 365 verified snapshots.');
  const snapshots = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^sultan-\d{4}-\d\d-\d\dT[0-9TZ-]+-[A-Za-z0-9]+$/.test(entry.name)) continue;
    const candidate = join(root, entry.name);
    try {
      if (!existsSync(join(candidate, 'VERIFIED'))) continue;
      const prior = JSON.parse(await readFile(join(candidate, 'manifest.json'), 'utf8'));
      if (prior.format === 'sultan-cloud-v1') snapshots.push(candidate);
    } catch { /* Incomplete snapshots are kept for inspection and never pruned. */ }
  }
  const expired = snapshots.sort().reverse().slice(keep).filter((snapshot) => snapshot !== directory);
  for (const snapshot of expired) {
    if (await realpath(snapshot) !== snapshot || !snapshot.startsWith(root + '/')) throw new Error('Unsafe retention path.');
    await rm(snapshot, { recursive: true, force: false });
  }
  console.log(JSON.stringify({ mode: 'create', encrypted: true, directory, retained: snapshots.length - expired.length, expired: expired.length, ...verification }));
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw new Error('Cloud backup requires Node.js 22.18 or later.');
  for (const envFile of [argument('--key-file'), '.env.local', '.env']) if (envFile && existsSync(envFile)) loadEnvFile(envFile);
  if (process.argv[2] === 'recover') {
    const root = resolve(argument('--root', '/var/backups/sultan-production'));
    const marker = join(root, '.backup-paused-app');
    if (!existsSync(marker)) return;
    if (await realpath(root) !== root) throw new Error('Unsafe recovery root.');
    const app = validateDockerName((await readFile(marker, 'utf8')).trim());
    const current = run('docker', ['compose', '-f', resolve(argument('--compose', 'docker-compose.cloud.yml')), 'ps', '-q', 'sultan-app']);
    if (app !== current) throw new Error('Recovery marker does not belong to the current project app.');
    const state = JSON.parse(run('docker', ['inspect', '--format', '{{json .State}}', app]));
    if (state.Paused) run('docker', ['unpause', app]);
    await rm(marker);
    console.log(JSON.stringify({ mode: 'recover', application: 'unpaused' }));
    return;
  }
  const key = encryptionKey();
  try {
    const mode = process.argv[2];
    if (mode === 'create') return await createSnapshot(key);
    if (mode !== 'verify' && mode !== 'restore-images') throw new Error('Use create, verify, or restore-images.');
    const directory = resolve(argument('--directory', ''));
    const result = await inspectSnapshot(directory, argument('--container'), key);
    if (mode === 'verify') { console.log(JSON.stringify({ mode, authenticated: true, ...result })); return; }
    const volume = validateDockerName(argument('--target-volume'));
    if (!volume.endsWith('_restore_test')) throw new Error('The new isolated volume must end in _restore_test.');
    const exists = spawnSync('docker', ['volume', 'inspect', volume], { stdio: 'ignore', windowsHide: true });
    if (exists.status !== 1) throw new Error('The isolated restore volume must not already exist.');
    const temporary = await mkdtemp(join(tmpdir(), 'sultan-images-restore-'));
    await chmod(temporary, 0o700);
    try {
      const archive = join(temporary, 'images.tar.gz');
      await decryptImages(join(directory, names.images), archive, key);
      run('docker', ['volume', 'create', '--label', 'sultan.restore-test=true', volume]);
      const child = spawn('docker', ['run', '--rm', '--network', 'none', '--read-only', '--mount', `type=volume,src=${volume},dst=/images`, '-i', 'postgres:15-alpine', 'sh', '-c', 'tar -xzf - -C /images && chown -R 1001:1001 /images'], { stdio: ['pipe', 'ignore', 'pipe'] });
      const exited = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit); });
      exited.catch(() => undefined);
      child.stderr.resume();
      await pipeline(createReadStream(archive), child.stdin);
      if (await exited !== 0) throw new Error('Isolated image restore failed.');
      console.log(JSON.stringify({ mode, volume, ...result }));
    } finally { await rm(temporary, { recursive: true, force: true }); }
  } finally { key.fill(0); }
}
main().catch(() => { console.error('Cloud snapshot operation failed; inspect configuration and isolated resource names. No credentials were logged.'); process.exitCode = 1; });
