import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

try {
  if (existsSync('.env')) loadEnvFile('.env');
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) throw new Error('Missing maintenance secret.');
  const response = await fetch('http://127.0.0.1:3005/api/cron/blob-cleanup', {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error('Maintenance request failed.');
  const result = await response.json();
  if (!Number.isSafeInteger(result.failed) || result.failed > 0) throw new Error('Image cleanup requires operator attention.');
  console.log(JSON.stringify({ job: 'private-image-cleanup', status: 'ok', ...result }));
} catch {
  console.error('Private image cleanup failed; inspect the application health and maintenance configuration.');
  process.exitCode = 1;
}
