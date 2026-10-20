import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { chmod, mkdtemp, mkdir, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const MAGIC = Buffer.from("SULTANDB1", "ascii");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

interface DatabaseConnection {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  pgEnv: NodeJS.ProcessEnv;
}

function readEncryptionKey(): Buffer {
  const encoded = process.env.DB_BACKUP_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Encryption key is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded.trim()) {
    key.fill(0);
    throw new Error("Encryption key must be a canonical base64 value containing 32 random bytes.");
  }
  return key;
}

function readDatabaseConnection(value = process.env.DIRECT_URL || process.env.DATABASE_URL): DatabaseConnection {
  if (!value) throw new Error("Database connection is not configured.");
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database connection must use PostgreSQL.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const username = decodeURIComponent(url.username);
  if (!database || !username || !url.hostname) throw new Error("Database connection is incomplete.");

  const pgEnv: NodeJS.ProcessEnv = { ...process.env };
  const sslEnv: Record<string, string> = {
    sslmode: "PGSSLMODE",
    sslrootcert: "PGSSLROOTCERT",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
  };
  for (const [parameter, envName] of Object.entries(sslEnv)) {
    const value = url.searchParams.get(parameter);
    if (value) pgEnv[envName] = value;
  }

  return {
    host: url.hostname,
    port: url.port || "5432",
    username,
    password: decodeURIComponent(url.password),
    database,
    pgEnv,
  };
}

function validateContainer(value: string | undefined): string | null {
  if (!value) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)) {
    throw new Error("Container name contains unsupported characters.");
  }
  return value;
}

function pgDumpCommand(connection: DatabaseConnection, container: string | null) {
  const args = ["--format=custom", "--no-owner", "--no-acl", "--no-password", "--username", connection.username, "--dbname", connection.database];
  if (container) return { command: "docker", args: ["exec", container, "pg_dump", ...args], env: process.env };
  return {
    command: "pg_dump",
    args: ["--host", connection.host, "--port", connection.port, ...args],
    env: { ...connection.pgEnv, PGPASSWORD: connection.password },
  };
}

async function writeFully(file: Awaited<ReturnType<typeof open>>, data: Buffer) {
  let offset = 0;
  while (offset < data.length) {
    const { bytesWritten } = await file.write(data, offset, data.length - offset, null);
    if (bytesWritten === 0) throw new Error("Backup file write failed.");
    offset += bytesWritten;
  }
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
}

async function createEncryptedBackup(outputPath: string, container: string | null, key: Buffer) {
  const connection = readDatabaseConnection();
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const file = await open(output, "wx", 0o600);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const source = pgDumpCommand(connection, container);
  const child = spawn(source.command, source.args, { env: source.env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = waitForExit(child);
  exited.catch(() => undefined);
  child.stderr.resume();

  try {
    await writeFully(file, Buffer.concat([MAGIC, iv]));
    for await (const chunk of child.stdout) {
      const encrypted = cipher.update(chunk as Buffer);
      if (encrypted.length > 0) await writeFully(file, encrypted);
    }
    const exitCode = await exited;
    if (exitCode !== 0) throw new Error("Database dump process failed.");
    const final = cipher.final();
    if (final.length > 0) await writeFully(file, final);
    await writeFully(file, cipher.getAuthTag());
    await file.sync();
  } catch {
    child.kill();
    await file.close().catch(() => undefined);
    await rm(output, { force: true }).catch(() => undefined);
    throw new Error("Encrypted backup creation failed; no usable backup was kept.");
  }

  await file.close();
  return output;
}

async function decryptToTemporaryDump(inputPath: string, key: Buffer) {
  const input = resolve(inputPath);
  const inputFile = await open(input, "r");
  const tempDirectory = await mkdtemp(join(tmpdir(), "sultan-db-restore-"));
  await chmod(tempDirectory, 0o700).catch(() => undefined);
  const dumpPath = join(tempDirectory, "database.dump");
  const outputFile = await open(dumpPath, "wx", 0o600);

  try {
    const fileStat = await inputFile.stat();
    const headerLength = MAGIC.length + IV_LENGTH;
    if (fileStat.size < headerLength + TAG_LENGTH) throw new Error("Encrypted backup is too short.");
    const header = Buffer.alloc(headerLength);
    const { bytesRead } = await inputFile.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || !header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error("Encrypted backup header is invalid.");
    }

    const iv = header.subarray(MAGIC.length);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    const encryptedStream = createReadStream(input, { start: headerLength, end: fileStat.size - 1 });
    let tail: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    for await (const chunkValue of encryptedStream) {
      const chunk = chunkValue as Buffer;
      const joined = tail.length > 0 ? Buffer.concat([tail, chunk]) : chunk;
      const encryptedLength = Math.max(0, joined.length - TAG_LENGTH);
      if (encryptedLength > 0) {
        await writeFully(outputFile, decipher.update(joined.subarray(0, encryptedLength)));
      }
      tail = joined.subarray(encryptedLength);
    }

    if (tail.length !== TAG_LENGTH) throw new Error("Encrypted backup authentication tag is missing.");
    decipher.setAuthTag(tail);
    await writeFully(outputFile, decipher.final());
    await outputFile.sync();
    return { directory: tempDirectory, dumpPath };
  } catch {
    await outputFile.close().catch(() => undefined);
    await inputFile.close().catch(() => undefined);
    await rm(tempDirectory, { recursive: true, force: true });
    throw new Error("Backup authentication or decryption failed.");
  } finally {
    await outputFile.close().catch(() => undefined);
    await inputFile.close().catch(() => undefined);
  }
}

async function runProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  inputFile?: string,
  collectOutput = false,
) {
  const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.resume();
  let output = "";
  let lineCount = 0;
  child.stdout.on("data", (chunk: Buffer) => {
    if (collectOutput) output += chunk.toString("utf8");
    else {
      for (const byte of chunk) if (byte === 10) lineCount += 1;
    }
  });
  const exit = waitForExit(child);
  if (inputFile) createReadStream(inputFile).pipe(child.stdin);
  else child.stdin.end();
  const exitCode = await exit;
  if (exitCode !== 0) throw new Error("PostgreSQL archive operation failed.");
  return collectOutput ? output.trim() : lineCount;
}

async function verifyArchive(dumpPath: string, container: string | null) {
  const args = ["--list"];
  if (container) return runProcess("docker", ["exec", "-i", container, "pg_restore", ...args], process.env, dumpPath);
  return runProcess("pg_restore", args.concat([dumpPath]), process.env, undefined, false);
}

async function createRestoreDatabase(container: string, connection: DatabaseConnection, database: string) {
  const query = `SELECT 1 FROM pg_database WHERE datname = '${database}'`;
  const exists = await runProcess(
    "docker",
    ["exec", container, "psql", "-U", connection.username, "-d", "postgres", "-tAc", query],
    process.env,
    undefined,
    true,
  );
  if (exists === "1") throw new Error("Restore database already exists; choose a new isolated name.");
  await runProcess("docker", ["exec", container, "createdb", "-U", connection.username, database], process.env);
}

async function restoreToContainer(dumpPath: string, container: string, connection: DatabaseConnection, database: string) {
  await runProcess(
    "docker",
    ["exec", "-i", container, "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl", "--exit-on-error", "-U", connection.username, "-d", database],
    process.env,
    dumpPath,
  );
  const counts = await runProcess(
    "docker",
    ["exec", container, "psql", "-U", connection.username, "-d", database, "-tAc", "SELECT (SELECT COUNT(*) FROM \"Order\") || ',' || (SELECT COUNT(*) FROM \"Transaction\") || ',' || (SELECT COUNT(*) FROM \"Order\" o WHERE round(o.\"paidAmount\"::numeric, 2) <> round(COALESCE((SELECT sum(t.amount::numeric) FROM \"Transaction\" t WHERE t.\"orderId\" = o.id AND t.type = 'INCOME'), 0), 2))"],
    process.env,
    undefined,
    true,
  );
  if (typeof counts !== "string") throw new Error("Restored database counts could not be read.");
  return counts;
}

async function dropRestoreDatabase(container: string, connection: DatabaseConnection, database: string) {
  await runProcess("docker", ["exec", container, "dropdb", "-U", connection.username, database], process.env);
}

async function getAvailablePort() {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address() as AddressInfo;
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
  return address.port;
}

async function checkRestoredApplication(databaseUrl: string, database: string) {
  const serverPath = resolve(".next/standalone/server.js");
  if (!existsSync(serverPath)) throw new Error("Build the standalone application before using --start-app.");

  const restoredUrl = new URL(databaseUrl);
  restoredUrl.pathname = `/${database}`;
  const port = await getAvailablePort();
  const authSecret = randomBytes(32).toString("base64url");
  const child = spawn(process.execPath, [serverPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: restoredUrl.toString(),
      DIRECT_URL: restoredUrl.toString(),
      AUTH_SECRET: authSecret,
      NEXTAUTH_SECRET: authSecret,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: `http://127.0.0.1:${port}`,
      NEXTAUTH_URL: `http://127.0.0.1:${port}`,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "ignore",
  });
  let applicationExited = false;
  let applicationSpawnError: Error | undefined;
  child.once("exit", () => { applicationExited = true; });
  child.once("error", (error) => { applicationSpawnError = error; applicationExited = true; });

  try {
    const healthUrl = `http://127.0.0.1:${port}/api/health`;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (applicationSpawnError) throw new Error("Restored application could not be started.");
      if (applicationExited) throw new Error("Restored application exited before its health check passed.");
      try {
        const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
        if (response.ok) {
          const body = await response.json() as { status?: string };
          if (body.status === "ok") return { status: body.status, httpStatus: response.status };
        }
      } catch {
        // The local server can need a short warm-up before its database health check succeeds.
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
    throw new Error("Restored application did not pass its database health check.");
  } finally {
    if (!applicationExited) {
      const exited = new Promise<void>((resolveExit) => child.once("exit", () => {
        applicationExited = true;
        resolveExit();
      }));
      child.kill();
      await Promise.race([exited, new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 5_000))]);
      if (!applicationExited) {
        child.kill("SIGKILL");
        await Promise.race([exited, new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 2_000))]);
      }
    }
  }
}

async function runSelfTest(container: string | null, startApplication: boolean) {
  if (!container) throw new Error("Backup self-test requires an explicit local PostgreSQL container.");
  const connection = readDatabaseConnection();
  if (!["localhost", "127.0.0.1", "::1"].includes(connection.host)) {
    throw new Error("Backup self-test is restricted to a local database connection.");
  }

  const key = randomBytes(32);
  const priorKey = process.env.DB_BACKUP_ENCRYPTION_KEY;
  process.env.DB_BACKUP_ENCRYPTION_KEY = key.toString("base64");
  const runId = randomUUID().replace(/-/g, "").slice(0, 10);
  const output = resolve("local-backups", `.sultan-backup-selftest-${runId}.dump.aesgcm`);
  const targetDatabase = `sultan_restore_${runId}_restore_test`;
  let temporary: { directory: string; dumpPath: string } | null = null;
  let targetCreated = false;
  let stage = "prepare";

  try {
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    stage = "create_encrypted_dump";
    await createEncryptedBackup(output, container, key);
    stage = "decrypt_and_authenticate";
    temporary = await decryptToTemporaryDump(output, key);
    stage = "verify_postgres_archive";
    const archiveEntries = await verifyArchive(temporary.dumpPath, container);
    stage = "create_isolated_restore_database";
    await createRestoreDatabase(container, connection, targetDatabase);
    targetCreated = true;
    stage = "restore_and_check_financial_ledger";
    const restoredCounts = await restoreToContainer(temporary.dumpPath, container, connection, targetDatabase);
    if (typeof restoredCounts !== "string") throw new Error("Restored database counts could not be read.");
    const [orders, transactions, ledgerMismatches] = restoredCounts.split(",").map(Number);
    if (![orders, transactions, ledgerMismatches].every(Number.isFinite) || ledgerMismatches !== 0) {
      throw new Error("Restored backup failed the financial consistency check.");
    }
    stage = "start_application_on_restored_database";
    const applicationHealth = startApplication
      ? await checkRestoredApplication(process.env.DIRECT_URL || process.env.DATABASE_URL || "", targetDatabase)
      : undefined;
    console.log(JSON.stringify({ mode: "self-test", encrypted: true, authenticated: true, archiveEntries, restoredCounts: { orders, transactions, ledgerMismatches }, ...(applicationHealth ? { applicationHealth } : {}) }));
  } catch {
    throw new Error(`Backup self-test failed at ${stage}.`);
  } finally {
    if (targetCreated) await dropRestoreDatabase(container, connection, targetDatabase).catch(() => undefined);
    if (temporary) await rm(temporary.directory, { recursive: true, force: true });
    await rm(output, { force: true });
    if (priorKey === undefined) delete process.env.DB_BACKUP_ENCRYPTION_KEY;
    else process.env.DB_BACKUP_ENCRYPTION_KEY = priorKey;
    key.fill(0);
  }
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "self-test") {
    const container = validateContainer(getArg("--container"));
    await runSelfTest(container, process.argv.includes("--start-app"));
    return;
  }
  const key = readEncryptionKey();
  try {
    if (command === "create") {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const output = getArg("--output") ?? join("local-backups", `sultan-${timestamp}.dump.aesgcm`);
      const container = validateContainer(getArg("--container"));
      const path = await createEncryptedBackup(output, container, key);
      console.log(JSON.stringify({ mode: "create", encrypted: true, file: path }));
      return;
    }

    if (command !== "verify" && command !== "restore") {
      throw new Error("Use create, verify, or restore.");
    }
    const input = getArg("--file");
    if (!input) throw new Error("Backup file is required.");
    const container = validateContainer(getArg("--container"));
    const temporary = await decryptToTemporaryDump(input, key);
    try {
      const archiveEntries = await verifyArchive(temporary.dumpPath, container);
      if (command === "verify" || !process.argv.includes("--apply")) {
        console.log(JSON.stringify({ mode: "verify", authenticated: true, archiveEntries }));
        return;
      }

      if (!container) throw new Error("Restoring is supported only into an isolated PostgreSQL Docker container.");
      const database = getArg("--target-db");
      if (!database || !/^[A-Za-z0-9_]+_(?:restore|restore_test)$/.test(database)) {
        throw new Error("Target database must have an isolated _restore or _restore_test suffix.");
      }
      const connection = readDatabaseConnection();
      await createRestoreDatabase(container, connection, database);
      const counts = await restoreToContainer(temporary.dumpPath, container, connection, database);
      const applicationHealth = process.argv.includes("--start-app")
        ? await checkRestoredApplication(process.env.DIRECT_URL || process.env.DATABASE_URL || "", database)
        : undefined;
      console.log(JSON.stringify({ mode: "restore", authenticated: true, archiveEntries, database, restoredCounts: counts, ...(applicationHealth ? { applicationHealth } : {}) }));
    } finally {
      await rm(temporary.directory, { recursive: true, force: true });
    }
  } finally {
    key.fill(0);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Encrypted database operation failed.";
  console.error(message);
  process.exitCode = 1;
});
