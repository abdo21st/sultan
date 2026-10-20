import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

// Pin the reviewed transport image; the transfer never mounts the Docker socket or backup key.
export const RCLONE_IMAGE = 'rclone/rclone@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5';
export const SNAPSHOT_NAME = /^sultan-\d{4}-\d\d-\d\dT[0-9TZ-]+-[A-Za-z0-9]+$/;
const files = ['database.dump.aesgcm', 'order-images.tar.gz.aesgcm', 'manifest.json'];
const signedMarker = 'OFFSITE-VERIFIED.json';
const configKeys = ['SULTAN_S3_ENDPOINT', 'SULTAN_S3_REGION', 'SULTAN_S3_BUCKET', 'SULTAN_S3_ACCESS_KEY_ID', 'SULTAN_S3_SECRET_ACCESS_KEY', 'SULTAN_S3_PREFIX', 'SULTAN_S3_FORCE_PATH_STYLE'];
class OffsiteError extends Error {}
const assert = (condition, message) => { if (!condition) throw new OffsiteError(message); };
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1]; };

export function validateConfig(input, allowLoopbackTest = false) {
    assert(Object.keys(input).every(key => configKeys.includes(key)), 'Unknown offsite setting.');
    for (const key of configKeys) assert(typeof input[key] === 'string' && !/[\x00-\x1f\x7f]/.test(input[key]), 'Invalid or missing offsite setting.');
    const endpoint = new URL(input.SULTAN_S3_ENDPOINT);
    const loopback = ['127.0.0.1', '[::1]'].includes(endpoint.hostname);
    assert(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/', 'Use a base S3 endpoint without credentials or query parameters.');
    const testEndpoint = allowLoopbackTest && loopback && endpoint.protocol === 'http:' && Number(endpoint.port) >= 1024;
    assert(endpoint.protocol === 'https:' || testEndpoint, 'Offsite storage requires verified HTTPS.');
    assert(testEndpoint || !/^(?:localhost\.?|127(?:\.\d+){3}|\[::1\])$/i.test(endpoint.hostname), 'Production offsite storage must be outside loopback.');
    assert(/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.SULTAN_S3_REGION), 'Invalid S3 region.');
    assert(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(input.SULTAN_S3_BUCKET) && !input.SULTAN_S3_BUCKET.includes('..') && !/^\d+\.\d+\.\d+\.\d+$/.test(input.SULTAN_S3_BUCKET), 'Invalid S3 bucket name.');
    assert(/^(?:[A-Za-z0-9_-]+\/)+$/.test(input.SULTAN_S3_PREFIX), 'Use a scoped prefix ending in a slash.');
    assert(['true', 'false'].includes(input.SULTAN_S3_FORCE_PATH_STYLE), 'Invalid S3 path style.');
    assert(input.SULTAN_S3_ACCESS_KEY_ID.length >= 1 && input.SULTAN_S3_ACCESS_KEY_ID.length <= 256 && input.SULTAN_S3_SECRET_ACCESS_KEY.length >= 1 && input.SULTAN_S3_SECRET_ACCESS_KEY.length <= 512, 'Invalid S3 credentials.');
    const destinationId = createHash('sha256').update(JSON.stringify([endpoint.href, input.SULTAN_S3_REGION, input.SULTAN_S3_BUCKET, input.SULTAN_S3_PREFIX, input.SULTAN_S3_FORCE_PATH_STYLE])).digest('hex');
    return { ...input, SULTAN_S3_ENDPOINT: endpoint.href, destinationId, testEndpoint };
}
export async function loadConfig(file, allowLoopbackTest = false) {
    const metadata = await lstat(file);
    assert(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size < 16_384, 'Use a regular private offsite configuration file.');
    if (process.platform !== 'win32') assert((metadata.mode & 0o077) === 0 && metadata.uid === process.getuid(), 'Offsite configuration must be private and owned by the current operator.');
    return validateConfig(parseEnv(await readFile(file, 'utf8')), allowLoopbackTest);
}
export function transportEnvironment(config) {
    return {
        RCLONE_CONFIG_OFFSITE_TYPE: 's3', RCLONE_CONFIG_OFFSITE_PROVIDER: 'Other', RCLONE_CONFIG_OFFSITE_ENV_AUTH: 'false',
        RCLONE_CONFIG_OFFSITE_ENDPOINT: config.SULTAN_S3_ENDPOINT, RCLONE_CONFIG_OFFSITE_REGION: config.SULTAN_S3_REGION,
        RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID: config.SULTAN_S3_ACCESS_KEY_ID, RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY: config.SULTAN_S3_SECRET_ACCESS_KEY,
        RCLONE_CONFIG_OFFSITE_FORCE_PATH_STYLE: config.SULTAN_S3_FORCE_PATH_STYLE, RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET: 'true',
    };
}
async function signingKey() {
    let encoded = process.env.DB_BACKUP_ENCRYPTION_KEY;
    for (const file of [option('--key-file'), '.env.local', '.env']) {
        if (encoded) break;
        if (!file) continue;
        try { encoded = parseEnv(await readFile(file, 'utf8')).DB_BACKUP_ENCRYPTION_KEY; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const key = Buffer.from(encoded || '', 'base64');
    assert(key.length === 32 && key.toString('base64') === encoded?.trim(), 'The separate backup encryption key is required.');
    try { return Buffer.from(hkdfSync('sha256', key, Buffer.from('SULTAN-OFFSITE-V1'), Buffer.from('snapshot-manifest-authentication'), 32)); }
    finally { key.fill(0); }
}
export function signSnapshot(snapshot, hashes, key) {
    const payload = { format: 'sultan-offsite-v1', snapshot, hashes };
    return { payload, signature: createHmac('sha256', key).update(JSON.stringify(payload)).digest('hex') };
}
export function verifySignedSnapshot(marker, snapshot, key) {
    assert(marker?.payload?.format === 'sultan-offsite-v1' && marker.payload.snapshot === snapshot && SNAPSHOT_NAME.test(snapshot), 'Invalid signed offsite snapshot identity.');
    assert(typeof marker.signature === 'string' && /^[a-f0-9]{64}$/.test(marker.signature), 'Invalid offsite signature.');
    const expected = createHmac('sha256', key).update(JSON.stringify(marker.payload)).digest();
    assert(timingSafeEqual(expected, Buffer.from(marker.signature, 'hex')), 'Offsite snapshot signature mismatch.');
    assert(Object.keys(marker.payload.hashes).length === 4 && [...files, 'VERIFIED'].every(file => /^[a-f0-9]{64}$/.test(marker.payload.hashes[file])), 'Invalid signed offsite file hashes.');
    return marker.payload.hashes;
}
async function digest(file) {
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(file)) hash.update(bytes);
    return hash.digest('hex');
}
function run(command, args, stage, environment = process.env) {
    const result = spawnSync(command, args, { env: environment, encoding: 'utf8', timeout: 30 * 60_000, maxBuffer: 1024 * 1024, windowsHide: true });
    assert(!result.error && result.status === 0, `Offsite operation failed at ${stage}; transport output was suppressed to protect credentials.`);
    return result.stdout.trim();
}
function transport(args, stage) {
    const nonce = randomBytes(12).toString('hex');
    const name = `sultan-offsite-transfer-${nonce}`;
    try {
        return run('docker', ['run', '--name', name, '--label', `sultan.offsite-transfer=${nonce}`, '--rm', '--network', 'host', '--read-only', '--memory', '256m', '--cpus', '0.5', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m', ...args], stage);
    } finally {
        const probe = spawnSync('docker', ['inspect', '--format', '{{index .Config.Labels "sultan.offsite-transfer"}}', name], { encoding: 'utf8', timeout: 15_000 });
        if (probe.status === 0) {
            assert(probe.stdout.trim() === nonce, 'Offsite transport ownership changed.');
            run('docker', ['rm', '-f', name], 'owned transport cleanup');
        } else assert(!probe.error && probe.status === 1, 'Offsite transport cleanup could not be confirmed.');
    }
}
async function regularFile(file, maximum = Number.MAX_SAFE_INTEGER) {
    const metadata = await lstat(file);
    assert(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= maximum, 'Snapshot contains an unsafe file.');
}
export async function inspectSource(directory) {
    const absolute = resolve(directory);
    assert(SNAPSHOT_NAME.test(basename(absolute)) && await realpath(absolute) === absolute && !/[,\r\n]/.test(absolute), 'Use a verified snapshot with a safe path.');
    for (const file of [...files, 'VERIFIED']) await regularFile(join(absolute, file), ['manifest.json', 'VERIFIED'].includes(file) ? 65_536 : undefined);
    assert(!Number.isNaN(Date.parse((await readFile(join(absolute, 'VERIFIED'), 'utf8')).trim())), 'Invalid source verification marker.');
    const manifest = JSON.parse(await readFile(join(absolute, 'manifest.json'), 'utf8'));
    assert(manifest.format === 'sultan-cloud-v1' && manifest.database?.file === files[0] && manifest.images?.file === files[1], 'Unsupported snapshot manifest.');
    const hashes = {};
    for (const file of [...files, 'VERIFIED']) hashes[file] = await digest(join(absolute, file));
    assert(manifest.database.sha256 === hashes[files[0]] && manifest.images.sha256 === hashes[files[1]], 'Snapshot checksum mismatch.');
    return { directory: absolute, name: basename(absolute), hashes };
}
export function authenticateSnapshot(directory, container) {
    assert(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container), 'Invalid verification container.');
    const result = JSON.parse(run(process.execPath, ['scripts/cloud-backup.mjs', 'verify', '--directory', directory, '--container', container, ...(option('--key-file') ? ['--key-file', option('--key-file')] : [])], 'authenticated archive verification'));
    assert(result.authenticated === true, 'Snapshot authentication failed.');
    return result;
}
async function cleanupTemporary(directory) {
    const absolute = await realpath(directory);
    assert(dirname(absolute) === await realpath(tmpdir()) && basename(absolute).startsWith('sultan-offsite-'), 'Unsafe offsite temporary cleanup path.');
    await rm(absolute, { recursive: true, force: true });
}
export async function uploadSnapshot(config, directory, container, stateDirectory) {
    assert(process.platform === 'linux', 'Offsite transport requires the Linux Docker host.');
    const source = await inspectSource(directory);
    authenticateSnapshot(source.directory, container);
    const state = resolve(stateDirectory);
    await mkdir(state, { recursive: true, mode: 0o700 });
    assert(await realpath(state) === state, 'Unsafe offsite state directory.');
    await chmod(state, 0o700);
    const temporary = await mkdtemp(join(tmpdir(), 'sultan-offsite-'));
    await chmod(temporary, 0o700);
    let key;
    try {
        key = await signingKey();
        const credentials = join(temporary, 'transport.env');
        await writeFile(credentials, Object.entries(transportEnvironment(config)).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
        const download = join(temporary, 'download');
        await mkdir(download, { mode: 0o700 });
        function transfer(file, downloading = false) {
            assert([...files, 'VERIFIED', signedMarker].includes(file), 'Unknown snapshot file.');
            const remote = `offsite:${config.SULTAN_S3_BUCKET}/${config.SULTAN_S3_PREFIX}${source.name}/${file}`;
            const mounts = downloading
                ? ['--mount', `type=bind,src=${download},dst=/download`]
                : ['--mount', `type=bind,src=${join(file === signedMarker ? temporary : source.directory, file)},dst=/source,readonly`];
            transport(['--env-file', credentials, ...mounts, RCLONE_IMAGE,
                'copyto', ...(downloading ? [remote, `/download/${file}`] : ['/source', remote]), '--config', '/dev/null', '--immutable', '--checksum', '--retries', '2', '--low-level-retries', '2', '--contimeout', '15s', '--timeout', '5m'], downloading ? 'remote readback' : 'encrypted upload');
        }
        // Publish the completion marker only after readback and authenticated archive verification.
        for (const file of files) { transfer(file); transfer(file, true); await chmod(join(download, file), 0o600); assert(await digest(join(download, file)) === source.hashes[file], 'Remote readback checksum mismatch.'); }
        const verification = authenticateSnapshot(download, container);
        transfer('VERIFIED'); transfer('VERIFIED', true);
        await chmod(join(download, 'VERIFIED'), 0o600);
        assert(await digest(join(download, 'VERIFIED')) === source.hashes.VERIFIED, 'Remote completion marker differs.');
        const marker = signSnapshot(source.name, source.hashes, key);
        await writeFile(join(temporary, signedMarker), JSON.stringify(marker), { mode: 0o600, flag: 'wx' });
        transfer(signedMarker); transfer(signedMarker, true);
        await chmod(join(download, signedMarker), 0o600);
        const remoteHashes = verifySignedSnapshot(JSON.parse(await readFile(join(download, signedMarker), 'utf8')), source.name, key);
        assert(JSON.stringify(remoteHashes) === JSON.stringify(source.hashes), 'The signed remote snapshot differs from its source.');
        const receipt = { format: 'sultan-offsite-v1', destinationId: config.destinationId, snapshot: source.name, hashes: source.hashes, verifiedAt: new Date().toISOString(), readbackMatched: true, authenticated: true, ...verification };
        await writeFile(join(state, `${config.destinationId}-${source.name}.json`), JSON.stringify(receipt), { mode: 0o600 });
        return { mode: 'offsite-upload', snapshot: source.name, destinationId: config.destinationId, readbackMatched: true, authenticated: true, databaseEntries: verification.databaseEntries, imageCount: verification.imageCount, providerAcceptance: !config.testEndpoint };
    } finally { key?.fill(0); await cleanupTemporary(temporary); }
}
export async function downloadSnapshot(config, snapshot, destination, container) {
    assert(process.platform === 'linux' && SNAPSHOT_NAME.test(snapshot), 'Invalid offsite snapshot name.');
    const target = resolve(destination);
    // mkdir must fail for an existing destination, preserving any existing files.
    await mkdir(target, { mode: 0o700 });
    assert(await realpath(target) === target && !/[,\r\n]/.test(target), 'Unsafe download directory.');
    const temporary = await mkdtemp(join(tmpdir(), 'sultan-offsite-'));
    await chmod(temporary, 0o700);
    let key;
    try {
        key = await signingKey();
        const credentials = join(temporary, 'transport.env');
        await writeFile(credentials, Object.entries(transportEnvironment(config)).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
        let expected;
        for (const file of [signedMarker, 'VERIFIED', ...files]) {
            transport(['--env-file', credentials, '--mount', `type=bind,src=${target},dst=/download`, RCLONE_IMAGE,
                'copyto', `offsite:${config.SULTAN_S3_BUCKET}/${config.SULTAN_S3_PREFIX}${snapshot}/${file}`, `/download/${file}`, '--config', '/dev/null', '--immutable', '--retries', '2', '--low-level-retries', '2', '--contimeout', '15s', '--timeout', '5m'], 'remote restore download');
            await chmod(join(target, file), 0o600);
            if (file === signedMarker) {
                await regularFile(join(target, file), 65_536);
                expected = verifySignedSnapshot(JSON.parse(await readFile(join(target, file), 'utf8')), snapshot, key);
            } else assert(await digest(join(target, file)) === expected[file], 'Downloaded snapshot differs from its authenticated manifest.');
        }
        const verification = authenticateSnapshot(target, container);
        return { mode: 'offsite-download', snapshot, directory: target, authenticated: true, ...verification };
    } finally { key?.fill(0); await cleanupTemporary(temporary); }
}
async function main() {
    const config = await loadConfig(resolve(option('--config', '.env.backup-offsite')), process.argv.includes('--allow-loopback-test-endpoint'));
    const container = option('--container', 'sultan-production-sultan-db-1');
    const state = option('--state', '/var/lib/sultan-offsite');
    const mode = process.argv[2];
    if (mode === 'check-config') { console.log(JSON.stringify({ mode, valid: true, productionEndpoint: !config.testEndpoint })); return; }
    if (mode === 'upload') { console.log(JSON.stringify(await uploadSnapshot(config, option('--directory', ''), container, state))); return; }
    if (mode === 'download') { console.log(JSON.stringify(await downloadSnapshot(config, option('--snapshot', ''), option('--destination', ''), container))); return; }
    assert(mode === 'upload-pending', 'Use check-config, upload, upload-pending, or download.');
    const root = resolve(option('--root', '/var/backups/sultan-production'));
    assert(await realpath(root) === root, 'Unsafe backup root.');
    let uploaded = 0;
    let alreadyUploaded = 0;
    for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => b.name.localeCompare(a.name))) {
        if (!entry.isDirectory() || !SNAPSHOT_NAME.test(entry.name)) continue;
        const directory = join(root, entry.name);
        let source;
        try { source = await inspectSource(directory); } catch { throw new Error('A retained snapshot is incomplete; inspect it before offsite transfer.'); }
        let prior;
        try { prior = JSON.parse(await readFile(join(state, `${config.destinationId}-${entry.name}.json`), 'utf8')); } catch { /* No completed receipt yet. */ }
        if (prior?.format === 'sultan-offsite-v1' && prior.destinationId === config.destinationId && prior.authenticated === true && prior.readbackMatched === true && JSON.stringify(prior.hashes) === JSON.stringify(source.hashes)) { alreadyUploaded++; continue; }
        await uploadSnapshot(config, directory, container, state);
        uploaded++;
    }
    console.log(JSON.stringify({ mode, uploaded, alreadyUploaded, destinationId: config.destinationId }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
    console.error(error instanceof OffsiteError ? error.message : 'Offsite backup failed; inspect the private configuration and verified snapshot.');
    process.exitCode = 1;
});
