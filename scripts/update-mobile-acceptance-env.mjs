import { randomBytes } from 'node:crypto';
import { chmod, lstat, readFile, rename, writeFile } from 'node:fs/promises';

const root = '/opt/sultan-mobile-acceptance';
const envPath = `${root}/.env`;
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Run the QA environment update as the Linux server administrator.');

const file = await lstat(envPath);
if (!file.isFile() || file.isSymbolicLink() || file.uid !== 0 || (file.mode & 0o077) !== 0) {
  throw new Error('The QA environment file must be a root-owned regular file with private permissions.');
}

const args = process.argv.slice(2);
const releaseIndex = args.indexOf('--release-tag');
const releaseTag = releaseIndex >= 0 ? args[releaseIndex + 1] : null;
if (releaseTag !== null && !/^[a-f0-9]{7,40}$/.test(releaseTag)) throw new Error('The QA release tag must be a hexadecimal commit identifier.');

const replacements = new Map([
  ['QA_APP_DB_PASSWORD', null],
  ['QA_MIGRATION_DB_PASSWORD', null],
]);
if (releaseTag !== null) replacements.set('SULTAN_RELEASE_TAG', releaseTag);

const original = await readFile(envPath, 'utf8');
const lines = original.split(/\r?\n/);
const seen = new Set();
for (const line of lines) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!match || !replacements.has(match[1])) continue;
  const [, key, value] = match;
  if (key === 'SULTAN_RELEASE_TAG' && releaseTag === null) continue;
  if (replacements.get(key) === null) replacements.set(key, value || randomBytes(32).toString('hex'));
  seen.add(key);
}

if (!seen.has('QA_APP_DB_PASSWORD')) replacements.set('QA_APP_DB_PASSWORD', randomBytes(32).toString('hex'));
if (!seen.has('QA_MIGRATION_DB_PASSWORD')) replacements.set('QA_MIGRATION_DB_PASSWORD', randomBytes(32).toString('hex'));
if (releaseTag !== null) replacements.set('SULTAN_RELEASE_TAG', releaseTag);
else if (!seen.has('SULTAN_RELEASE_TAG')) replacements.set('SULTAN_RELEASE_TAG', 'b1aa512');

const output = lines.filter((line) => ![...replacements.keys()].some((key) => line.startsWith(`${key}=`)));
for (const [key, value] of replacements) output.push(`${key}=${value}`);
const tempPath = `${root}/.env.update-${process.pid}`;
const content = `${output.filter((line, index) => index < output.length - 1 || line !== '').join('\n').replace(/\n*$/, '\n')}`;
await writeFile(tempPath, content, { flag: 'wx', mode: 0o600 });
await chmod(tempPath, 0o600);
await rename(tempPath, envPath);
console.log(JSON.stringify({ qaConfigurationUpdated: true, releaseTag: replacements.get('SULTAN_RELEASE_TAG') }));
