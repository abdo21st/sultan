import { randomBytes } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });
const suffix = randomBytes(12).toString('hex');
const prefix = `sultan_upgrade_${suffix}`;
const ownedDatabases = new Set<string>();
const ownedContainers = new Set<string>();
const children = new Set<ChildProcess>();
const baseline = '20261020000000_initial_baseline';
const financial = '20261020000100_financial_security_integrity';
const sixth = '20261021000000_session_and_share_revocation';
const source = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL || 'invalid:');
if (!['postgres:', 'postgresql:'].includes(source.protocol) || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(source.hostname)) throw new Error('Upgrade acceptance requires a loopback PostgreSQL connection.');
source.searchParams.delete('schema');
function option(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
const container = option('--container');
if (!container || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container)) throw new Error('Pass the disposable PostgreSQL container with --container.');
const previousImage = option('--rollback-image');
const databaseOnly = process.argv.includes('--database-only');
if (!databaseOnly && (!previousImage || !/^sultan-release:[a-f0-9]{7,40}$/.test(previousImage) || process.platform !== 'linux')) throw new Error('Full acceptance requires Linux and an explicit previous sultan-release image. Use --database-only for a partial database check.');
const username = `upgrade_admin_${suffix}`;
const password = randomBytes(24).toString('base64url');
const ids = { user: `user_${suffix}`, factory: `factory_${suffix}`, shop: `shop_${suffix}`, order: `order_${suffix}`, payment: `payment_${suffix}` };
const history = [{ action: 'REGISTERED', note: 'سجل قديم أول', at: '2025-01-02T03:04:05.000Z' }, { action: 'DELIVERING', note: 'سجل قديم ثان', actor: ids.user }];
const cli = path.resolve('node_modules/tsx/dist/cli.mjs');
const prismaCli = path.resolve('node_modules/prisma/build/index.js');
let temporary = '';
let configDirectory = '';
let stage = 'initialization';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function url(database: string) { const value = new URL(source); value.pathname = `/${database}`; return value.toString(); }
function env(database: string): NodeJS.ProcessEnv { return { ...process.env, DATABASE_URL: url(database), DIRECT_URL: url(database), DB_BACKUP_ENCRYPTION_KEY: encryptionKey }; }
const encryptionKey = randomBytes(32).toString('base64');
function run(command: string, args: string[], environment = process.env, expectedFailure?: RegExp, expectedExitCode?: number) {
    const result = spawnSync(command, args, { env: environment, encoding: 'utf8', timeout: 180_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (expectedFailure) {
        assert(!result.error && result.status !== 0 && (expectedExitCode === undefined || result.status === expectedExitCode) && expectedFailure.test(output), `The expected safety failure was not observed (operation=${args.slice(1, 3).join(' ')}, exit=${result.status}, financialMessage=${output.match(/Financial migration stopped:[^\r\n]{0,200}/)?.[0] || 'absent'}).`);
    } else assert(!result.error && result.status === 0, `Acceptance subprocess failed at ${stage}.`);
    return output;
}
async function query(database: string, sql: string, values?: unknown[]) {
    const client = new Client({ connectionString: url(database), connectionTimeoutMillis: 10_000 });
    await client.connect();
    try { return await client.query(sql, values); } finally { await client.end(); }
}
async function create(name: string) {
    assert(name.startsWith(`${prefix}_`) && /^[a-z0-9_]+$/.test(name), 'Invalid owned database name.');
    await query('postgres', `CREATE DATABASE "${name}"`);
    ownedDatabases.add(name);
}
function migrate(database: string, config?: string, expectedFailure?: RegExp) {
    return run(process.execPath, [prismaCli, 'migrate', 'deploy', ...(config ? ['--config', config] : [])], env(database), expectedFailure);
}
async function fixture(database: string, mismatch = false) {
    await create(database);
    await query(database, await readFile(path.resolve('prisma/migrations', baseline, 'migration.sql'), 'utf8'));
    await query(database, `INSERT INTO "Facility" (id,name,type) VALUES ($1,'Upgrade factory','FACTORY'),($2,'Upgrade shop','SHOP')`, [ids.factory, ids.shop]);
    await query(database, `INSERT INTO "User" (id,username,password,"displayName",role,permissions,"createdAt","updatedAt") VALUES ($1,$2,$3,'Synthetic upgrade administrator','ADMIN',ARRAY[]::text[],'2025-01-02 03:04:05','2025-01-02 03:04:05')`, [ids.user, username, await bcrypt.hash(password, 12)]);
    await query(database, `INSERT INTO "Order" (id,"customerName","customerPhone",description,"dueDate",status,"totalAmount","paidAmount","remainingAmount",images,"factoryId","shopId",history,"createdAt","updatedAt") VALUES ($1,'عميل ترقية تجريبي','0910000000','Synthetic historical order','2025-02-03 04:05:06','orders:status:delivering',123.45,40.10,83.35,ARRAY[]::text[],$2,$3,ARRAY[$4::jsonb,$5::jsonb],'2025-01-02 03:04:05','2025-01-02 03:04:05')`, [ids.order, ids.factory, ids.shop, JSON.stringify(history[0]), JSON.stringify(history[1])]);
    await query(database, `INSERT INTO "Transaction" (id,type,amount,category,description,"orderId","createdBy",date,"createdAt","updatedAt") VALUES ($1,'INCOME',$2,'SALES','Synthetic historical payment',$3,$4,'2025-01-02 03:04:05','2025-01-02 03:04:05','2025-01-02 03:04:05')`, [ids.payment, mismatch ? 30.10 : 40.10, ids.order, ids.user]);
    run(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', baseline], env(database));
    const probe = run('docker', ['exec', container!, 'psql', '-U', decodeURIComponent(source.username), '-d', database, '-tAc', `SELECT count(*) FROM "Order" WHERE id='${ids.order}'`]);
    assert(probe.trim() === '1', 'The container and loopback database service are different.');
}
async function records(database: string) {
    const order = (await query(database, `SELECT id,"serialNumber","customerName","customerPhone",description,status,"dueDate","createdAt","updatedAt","factoryId","shopId",images,round("totalAmount"::numeric,2)::text AS total,round("paidAmount"::numeric,2)::text AS paid,round("remainingAmount"::numeric,2)::text AS remaining FROM "Order" ORDER BY id`)).rows;
    const payment = (await query(database, `SELECT id,type,round(amount::numeric,2)::text AS amount,category,description,"orderId","createdBy",date,"createdAt","updatedAt" FROM "Transaction" ORDER BY id`)).rows;
    const user = (await query(database, `SELECT id,username,password,"displayName",role,permissions,"createdAt","updatedAt" FROM "User" ORDER BY id`)).rows;
    return JSON.stringify({ order, payment, user });
}
async function checkSchema(database: string, upgraded: boolean) {
    const columns = (await query(database, `SELECT column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name='Order' AND column_name IN ('totalAmount','paidAmount','remainingAmount','history') ORDER BY column_name`)).rows;
    assert(columns.length === (upgraded ? 3 : 4), 'Historical schema columns were not preserved or migrated as expected.');
    for (const column of columns.filter(row => row.column_name !== 'history')) assert(upgraded ? column.data_type === 'numeric' && column.numeric_precision === 14 && column.numeric_scale === 2 : column.data_type === 'double precision', 'Unexpected money column type.');
    if (upgraded) {
        const audit = (await query(database, `SELECT "after" FROM "AuditLog" WHERE action='LEGACY_HISTORY_IMPORTED' ORDER BY id`)).rows;
        assert(isDeepStrictEqual(audit.map(row => row.after), history.map((record, index) => ({ record, legacyHistoryIndex: index + 1 }))), 'Historical audit entries did not survive exactly.');
        const flags = (await query(database, `SELECT "mustChangePassword","sessionVersion" FROM "User" WHERE id=$1`, [ids.user])).rows[0];
        assert(flags.mustChangePassword === false && flags.sessionVersion === 0, 'Upgrade reset an existing account security state.');
    } else {
        const old = (await query(database, `SELECT history FROM "Order" WHERE id=$1`, [ids.order])).rows[0];
        assert(isDeepStrictEqual(old.history, history), 'The old history array changed.');
    }
}
async function snapshot(database: string, name: string) {
    const file = path.join(temporary, `${name}.dump.aesgcm`);
    run(process.execPath, [cli, 'scripts/db-backup-encrypted.ts', 'create', '--container', container!, '--output', file], env(database));
    const verified = run(process.execPath, [cli, 'scripts/db-backup-encrypted.ts', 'verify', '--container', container!, '--file', file], env(database));
    assert(verified.includes('"authenticated":true'), 'Encrypted snapshot authentication failed.');
    return file;
}
async function restore(database: string, file: string, target: string) {
    assert(target.startsWith(`${prefix}_`) && target.endsWith('_restore_test'), 'Invalid restore database name.');
    assert((await query('postgres', 'SELECT 1 FROM pg_database WHERE datname=$1', [target])).rows.length === 0, 'Restore target already exists.');
    ownedDatabases.add(target);
    run(process.execPath, [cli, 'scripts/db-backup-encrypted.ts', 'restore', '--container', container!, '--file', file, '--target-db', target, '--apply'], env(database));
}
async function port() {
    const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const value = (server.address() as AddressInfo).port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    return value;
}
async function start(database: string, image?: string) {
    const appPort = await port();
    const base = `http://127.0.0.1:${appPort}`;
    const secret = randomBytes(32).toString('base64url');
    const appEnv = { NODE_ENV: 'production' as const, PORT: String(appPort), HOSTNAME: '127.0.0.1', DATABASE_URL: url(database), DIRECT_URL: url(database), AUTH_SECRET: secret, NEXTAUTH_SECRET: secret, AUTH_TRUST_HOST: 'true', AUTH_URL: base, NEXTAUTH_URL: base, ORDER_IMAGE_STORAGE: 'local', ORDER_IMAGE_STORAGE_DIR: path.join(temporary, 'images'), ORDER_SHARE_SECRET: randomBytes(32).toString('base64url'), CRON_SECRET: randomBytes(32).toString('base64url'), NEXT_TELEMETRY_DISABLED: '1' };
    let child: ChildProcess | undefined;
    let name: string | undefined;
    if (image) {
        name = `sultan-upgrade-${suffix}-${ownedContainers.size}`;
        const envFile = path.join(temporary, `${name}.env`);
        await writeFile(envFile, Object.entries(appEnv).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
        ownedContainers.add(name);
        run('docker', ['run', '-d', '--name', name, '--label', `sultan.upgrade-acceptance=${suffix}`, '--network', 'host', '--env-file', envFile, image]);
        await rm(envFile);
    } else {
        const runtimeEnv: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
        for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']) if (process.env[key]) runtimeEnv[key] = process.env[key];
        child = spawn(process.execPath, [path.resolve('.next/standalone/server.js')], { env: { ...runtimeEnv, ...appEnv }, stdio: 'ignore', windowsHide: true });
        child.on('error', () => undefined);
        children.add(child);
    }
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try { const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) }); if (response.ok && (await response.json()).status === 'ok') return { base, child, name }; } catch { /* Wait for the owned app. */ }
        if (child?.exitCode !== null && child?.exitCode !== undefined) break;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('The isolated application did not become healthy.');
}
async function stop(app: Awaited<ReturnType<typeof start>>) {
    if (app.child) {
        if (app.child.exitCode === null) {
            const exited = new Promise<void>(resolve => app.child!.once('close', () => resolve()));
            app.child.kill('SIGTERM');
            await Promise.race([exited, new Promise<void>(resolve => { const timer = setTimeout(() => { app.child!.kill('SIGKILL'); resolve(); }, 5000); timer.unref(); })]);
        }
        children.delete(app.child);
    }
    if (app.name) removeContainer(app.name);
}
function removeContainer(name: string) {
    assert(ownedContainers.has(name), 'The container is not owned by this run.');
    const label = run('docker', ['inspect', '--format', '{{index .Config.Labels "sultan.upgrade-acceptance"}}', name]).trim();
    assert(label === suffix, 'The owned container label changed.');
    run('docker', ['rm', '-f', name]);
    ownedContainers.delete(name);
}
async function businessRead(base: string) {
    const cookies = new Map<string, string>();
    async function request(route: string, init: RequestInit = {}) {
        const response = await fetch(`${base}${route}`, { ...init, redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { ...init.headers, Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } });
        for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';', 1)[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
        return response;
    }
    const { csrfToken } = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken, username, password, json: 'true', callbackUrl: base }) });
    assert((await (await request('/api/auth/session')).json()).user?.id === ids.user, 'The historical account could not authenticate.');
    const response = await request(`/api/orders/${ids.order}`);
    assert(response.status === 200, 'The historical order could not be read by the running application.');
    const order = await response.json();
    assert(order.totalAmount === 123.45 && order.paidAmount === 40.10 && order.remainingAmount === 83.35 && order.customerName === 'عميل ترقية تجريبي', 'The running application returned changed historical financial data.');
}
async function removeDirectory(directory: string, root: string, expectedName: string) {
    const resolved = await realpath(directory);
    const parent = await realpath(root);
    assert(path.dirname(resolved) === parent && path.basename(resolved).startsWith(expectedName), 'Refusing cleanup outside an owned acceptance directory.');
    await rm(resolved, { recursive: true, force: true });
}

async function main() {
    temporary = await mkdtemp(path.join(tmpdir(), 'sultan-upgrade-'));
    await mkdir(path.resolve('scratch'), { recursive: true });
    configDirectory = await mkdtemp(path.resolve('scratch/upgrade-acceptance-'));
    try {
        stage = 'legacy-upgrade';
        const legacy = `${prefix}_legacy`;
        await fixture(legacy);
        const before = await records(legacy);
        const oldSnapshot = await snapshot(legacy, 'before-legacy-upgrade');
        migrate(legacy);
        await checkSchema(legacy, true);
        assert(await records(legacy) === before, 'Upgrade changed historical financial or account records.');
        const current = await start(legacy);
        await businessRead(current.base);
        await stop(current);
        const restoredOld = `${prefix}_legacy_restore_test`;
        await restore(legacy, oldSnapshot, restoredOld);
        await checkSchema(restoredOld, false);
        assert(await records(restoredOld) === before, 'The legacy snapshot did not restore the historical records.');
        console.log(JSON.stringify({ legacyUpgrade: { syntheticData: true, productionDataUsed: false, recordsPreserved: true, moneyPrecision: 'DECIMAL(14,2)', historicalAuditEntriesPreserved: 2, authenticatedOrderRead: true, encryptedLegacyRestore: true } }));

        stage = 'failed-migration';
        const invalid = `${prefix}_mismatch`;
        await fixture(invalid, true);
        const invalidBefore = await records(invalid);
        const preflight = run(process.execPath, [cli, 'scripts/financial-preflight.ts'], env(invalid), /"paymentLedgerMismatchCount"\s*:\s*1/, 2);
        assert(preflight.includes('"paymentLedgerMismatchCount": 1') || preflight.includes('"paymentLedgerMismatchCount":1'), 'Preflight did not report the exact synthetic mismatch.');
        let exactRejection = false;
        try { await query(invalid, await readFile(path.resolve('prisma/migrations', financial, 'migration.sql'), 'utf8')); }
        catch (error) {
            // Prisma may mask the original exception with a secondary aborted-transaction error.
            if (error instanceof Error && 'code' in error && error.code === 'P0001' && /Financial migration stopped: order payment ledger mismatches need reconciliation/.test(error.message)) exactRejection = true;
            else throw error;
        }
        assert(exactRejection, 'The migration SQL did not reject the exact historical ledger mismatch.');
        migrate(invalid, undefined, /Financial migration stopped: order payment ledger mismatches need reconciliation|current transaction is aborted/);
        const failed = (await query(invalid, `SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`)).rows;
        assert(failed.length === 1 && failed[0].migration_name === financial, 'The migration runner failed at an unexpected migration.');
        assert(await records(invalid) === invalidBefore, 'A rejected migration changed business records.');
        await checkSchema(invalid, false);
        assert((await query(invalid, `SELECT to_regclass('public."AuditLog"') AS name`)).rows[0].name === null, 'A failed financial migration partially created audit storage.');
        await query(invalid, `UPDATE "Order" SET "paidAmount"=30.10,"remainingAmount"=93.35 WHERE id=$1`, [ids.order]);
        run(process.execPath, [prismaCli, 'migrate', 'resolve', '--rolled-back', financial], env(invalid));
        migrate(invalid);
        await checkSchema(invalid, true);
        const reconciled = (await query(invalid, `SELECT count(*)::int AS mismatches FROM "Order" o WHERE o."paidAmount" <> (SELECT sum(amount) FROM "Transaction" t WHERE t."orderId"=o.id AND type='INCOME')`)).rows[0];
        assert(reconciled.mismatches === 0, 'The reconciled synthetic migration did not succeed.');
        console.log(JSON.stringify({ failedMigration: { exactMismatchRejected: true, unchangedBusinessRecords: true, noPartialSchema: true, syntheticReconciliationAndRetry: true } }));

        if (!databaseOnly) {
            stage = 'previous-runtime-rollback';
            const revision = run('docker', ['image', 'inspect', previousImage!, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}']).trim();
            assert(revision.startsWith(previousImage!.split(':')[1]) && /^[a-f0-9]{40}$/.test(revision), 'The previous release image revision does not match its tag.');
            const migrations = path.join(configDirectory, 'migrations');
            await mkdir(migrations);
            for (const entry of await readdir('prisma/migrations', { withFileTypes: true })) {
                if (entry.name === 'migration_lock.toml' || entry.isDirectory() && entry.name <= sixth) await cp(path.resolve('prisma/migrations', entry.name), path.join(migrations, entry.name), { recursive: true });
            }
            const config = path.join(configDirectory, 'prisma.config.ts');
            await writeFile(config, `import { defineConfig } from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(path.resolve('prisma/schema.prisma'))}, migrations:{path:${JSON.stringify(migrations)}}, datasource:{url:process.env.DIRECT_URL!}});\n`);
            const versionSix = `${prefix}_v6`;
            await fixture(versionSix);
            migrate(versionSix, config);
            assert((await query(versionSix, `SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).rows[0].count === 6, 'The rollback source is not exactly migration six.');
            const v6Records = await records(versionSix);
            const v6Audit = JSON.stringify((await query(versionSix, `SELECT * FROM "AuditLog" ORDER BY id`)).rows);
            const v6Snapshot = await snapshot(versionSix, 'before-version-seven');
            const oldRuntime = await start(versionSix, previousImage);
            await businessRead(oldRuntime.base);
            await stop(oldRuntime);
            migrate(versionSix);
            const candidate = await start(versionSix);
            await businessRead(candidate.base);
            await stop(candidate);
            const rollback = `${prefix}_v6_restore_test`;
            await restore(versionSix, v6Snapshot, rollback);
            assert(await records(rollback) === v6Records, 'The prior release snapshot changed financial or account records.');
            assert(JSON.stringify((await query(rollback, `SELECT * FROM "AuditLog" ORDER BY id`)).rows) === v6Audit, 'Rollback changed the audit log.');
            assert((await query(rollback, `SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).rows[0].count === 6, 'Rollback did not restore migration six.');
            assert((await query(rollback, `SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='Transaction' AND column_name='reversalOfId'`)).rows[0].count === 0, 'Rollback retained the candidate schema.');
            const rollbackRuntime = await start(rollback, previousImage);
            await businessRead(rollbackRuntime.base);
            await stop(rollbackRuntime);
            console.log(JSON.stringify({ rollback: { previousRevision: revision, previousRuntimeBeforeUpgrade: true, candidateRuntimeAfterUpgrade: true, candidateStopSimulated: true, encryptedPriorSchemaRestored: true, accountAndFinancialRecordsPreserved: true, auditPreserved: true, previousRuntimeAuthenticatedOrderRead: true } }));
        }
        console.log(JSON.stringify({ upgradeAcceptance: databaseOnly ? 'database-only-partial' : 'complete', previousRuntimeRollbackTested: !databaseOnly, productionDataUsed: false }));
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
        for (const name of [...ownedContainers]) removeContainer(name);
        for (const database of ownedDatabases) {
            assert(database.startsWith(`${prefix}_`) && /^[a-z0-9_]+$/.test(database), 'Refusing unrelated database cleanup.');
            await query('postgres', 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]);
            await query('postgres', `DROP DATABASE IF EXISTS "${database}"`);
        }
        if (configDirectory) await removeDirectory(configDirectory, path.resolve('scratch'), 'upgrade-acceptance-');
        if (temporary) await removeDirectory(temporary, tmpdir(), 'sultan-upgrade-');
    }
}
main().catch((error: unknown) => {
    console.error(`Upgrade acceptance failed at ${stage}; only owned synthetic databases were used.`);
    if (error instanceof Error) console.error(error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted database URL]'));
    process.exitCode = 1;
});
