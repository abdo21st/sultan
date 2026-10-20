import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectSource, loadConfig, signSnapshot, transportEnvironment, validateConfig, verifySignedSnapshot } from './backup-offsite.mjs';

const fixture = () => ({ SULTAN_S3_ENDPOINT: 'https://example.invalid', SULTAN_S3_REGION: 'auto', SULTAN_S3_BUCKET: 'sultan-test', SULTAN_S3_ACCESS_KEY_ID: 'synthetic-access', SULTAN_S3_SECRET_ACCESS_KEY: 'synthetic-secret', SULTAN_S3_PREFIX: 'sultan/', SULTAN_S3_FORCE_PATH_STYLE: 'true' });
test('production transport requires HTTPS and excludes inline credentials and loopback', () => {
    assert.equal(validateConfig(fixture()).testEndpoint, false);
    for (const endpoint of ['http://example.invalid', 'http://127.0.0.1:9090', 'https://127.0.0.1', 'https://user:password@example.invalid', 'https://example.invalid?token=secret', 'https://example.invalid/s3']) assert.throws(() => validateConfig({ ...fixture(), SULTAN_S3_ENDPOINT: endpoint }));
});
test('the explicit test exception permits only loopback HTTP on an unprivileged port', () => {
    assert.equal(validateConfig({ ...fixture(), SULTAN_S3_ENDPOINT: 'http://127.0.0.1:9090' }, true).testEndpoint, true);
    for (const endpoint of ['http://example.invalid:9090', 'http://127.0.0.1:80', 'http://localhost:9090']) assert.throws(() => validateConfig({ ...fixture(), SULTAN_S3_ENDPOINT: endpoint }, true));
});
test('offsite paths, credentials, and settings reject unsafe or ambiguous values', () => {
    for (const change of [{ SULTAN_S3_PREFIX: '../' }, { SULTAN_S3_PREFIX: '' }, { SULTAN_S3_PREFIX: 'sultan//' }, { SULTAN_S3_BUCKET: 'a/b' }, { SULTAN_S3_BUCKET: '127.0.0.1' }, { SULTAN_S3_FORCE_PATH_STYLE: 'yes' }, { SULTAN_S3_SECRET_ACCESS_KEY: 'secret\nINJECT=true' }, { SULTAN_S3_ACCESS_KEY_ID: '' }, { DB_BACKUP_ENCRYPTION_KEY: 'must-stay-separate' }]) assert.throws(() => validateConfig({ ...fixture(), ...change }));
});
test('transport receives only its S3 settings and cannot receive the backup encryption key', () => {
    const config = validateConfig(fixture());
    const environment = transportEnvironment({ ...config, DB_BACKUP_ENCRYPTION_KEY: 'do-not-transfer' });
    assert.ok(Object.keys(environment).every(key => key.startsWith('RCLONE_CONFIG_OFFSITE_')));
    assert.ok(!JSON.stringify(environment).includes('do-not-transfer'));
    assert.equal(environment.RCLONE_CONFIG_OFFSITE_ENV_AUTH, 'false');
    assert.equal(environment.RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET, 'true');
});
test('configuration is read from a private regular file', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'sultan-offsite-unit-'));
    try {
        const file = join(temporary, 'private.env');
        await writeFile(file, Object.entries(fixture()).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
        assert.equal((await loadConfig(file)).SULTAN_S3_BUCKET, 'sultan-test');
        if (process.platform !== 'win32') {
            await chmod(file, 0o644);
            await assert.rejects(loadConfig(file), /private and owned/);
            await chmod(file, 0o600);
            const link = join(temporary, 'link.env');
            await symlink(file, link);
            await assert.rejects(loadConfig(link), /regular private/);
        }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});
test('signed metadata binds every file and its snapshot identity', () => {
    const name = 'sultan-2026-10-21T00-00-00-000Z-abcdef';
    const hashes = Object.fromEntries(['database.dump.aesgcm', 'order-images.tar.gz.aesgcm', 'manifest.json', 'VERIFIED'].map(file => [file, randomBytes(32).toString('hex')]));
    const key = randomBytes(32);
    const marker = signSnapshot(name, hashes, key);
    assert.deepEqual(verifySignedSnapshot(JSON.parse(JSON.stringify(marker)), name, key), hashes);
    assert.throws(() => verifySignedSnapshot(marker, name, randomBytes(32)), /signature mismatch/);
    assert.throws(() => verifySignedSnapshot(marker, `${name}x`, key), /identity/);
    const changed = structuredClone(marker);
    changed.payload.hashes['manifest.json'] = 'a'.repeat(64);
    assert.throws(() => verifySignedSnapshot(changed, name, key), /signature mismatch/);
    assert.deepEqual(signSnapshot(name, hashes, key), marker);
});
test('snapshot inspection validates exact files, source checksums, and symlink boundaries', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'sultan-offsite-unit-'));
    try {
        const directory = join(temporary, 'sultan-2026-10-21T00-00-00-000Z-abcdef');
        await mkdir(directory);
        const database = randomBytes(64); const images = randomBytes(64);
        await writeFile(join(directory, 'database.dump.aesgcm'), database);
        await writeFile(join(directory, 'order-images.tar.gz.aesgcm'), images);
        await writeFile(join(directory, 'VERIFIED'), new Date().toISOString());
        await writeFile(join(directory, 'manifest.json'), JSON.stringify({ format: 'sultan-cloud-v1', database: { file: 'database.dump.aesgcm', sha256: createHash('sha256').update(database).digest('hex') }, images: { file: 'order-images.tar.gz.aesgcm', sha256: createHash('sha256').update(images).digest('hex') } }));
        assert.equal(Object.keys((await inspectSource(directory)).hashes).length, 4);
        await writeFile(join(directory, 'database.dump.aesgcm'), randomBytes(64));
        await assert.rejects(inspectSource(directory), /checksum mismatch/);
        await writeFile(join(directory, 'database.dump.aesgcm'), database);
        if (process.platform !== 'win32') {
            const original = await readFile(join(directory, 'VERIFIED'));
            await rm(join(directory, 'VERIFIED'));
            await writeFile(join(temporary, 'marker'), original);
            await symlink(join(temporary, 'marker'), join(directory, 'VERIFIED'));
            await assert.rejects(inspectSource(directory), /unsafe file/);
        }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});
