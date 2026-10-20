import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const root = '/opt/sultan-mobile-acceptance';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Run mobile acceptance provisioning as the Linux server administrator.');
await mkdir(root, { mode: 0o700 });
if (await realpath(root) !== root) throw new Error('The acceptance directory must not be a symbolic link.');
const configuration = {
    QA_DB_PASSWORD: randomBytes(24).toString('hex'),
    QA_AUTH_SECRET: randomBytes(32).toString('base64url'),
    QA_CRON_SECRET: randomBytes(32).toString('base64url'),
    QA_SHARE_SECRET: randomBytes(32).toString('base64url'),
    QA_ACCOUNT_USERNAME: `phone_${randomBytes(4).toString('hex')}`,
    QA_ACCOUNT_PASSWORD: `phone-${randomBytes(10).toString('hex')}`,
};
await writeFile(`${root}/.env`, Object.entries(configuration).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
await writeFile(`${root}/.managed-by-sultan`, 'sultan-mobile-acceptance-v1\n', { flag: 'wx', mode: 0o600 });
const reread = parseEnv(await readFile(`${root}/.env`, 'utf8'));
if ((await lstat(`${root}/.env`)).mode & 0o077) throw new Error('The QA configuration must remain private.');
await writeFile(`${root}/private-phone-credentials.json`, JSON.stringify({
    purpose: 'اختبار هاتف حقيقي ببيانات مصطنعة فقط',
    url: 'https://sultan-qa.mtapp.ly',
    username: reread.QA_ACCOUNT_USERNAME,
    password: reread.QA_ACCOUNT_PASSWORD,
    accountRole: 'MANAGER',
    warning: 'هذه بيئة اختبار مستقلة. لا تدخل بيانات عملاء حقيقية أو تعتمد حسابها لحساب الإنتاج.',
}, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ mobileAcceptanceProvisioned: true, credentialsPrinted: false, realDataUsed: false }));
