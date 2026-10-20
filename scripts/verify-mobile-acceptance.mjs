import { readFile } from 'node:fs/promises';
const file = process.argv[2];
if (!file || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Use a private QA credential file with TLS verification enabled.');
const credentials = JSON.parse(await readFile(file, 'utf8'));
const base = 'https://sultan-qa.mtapp.ly';
if (credentials.url !== base || !credentials.username || !credentials.password) throw new Error('Use only the disposable QA credentials.');
const jar = new Map();
async function request(path, init = {}) {
    const response = await fetch(`${base}${path}`, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { ...init.headers, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';', 1)[0]; const index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)); }
    return response;
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const health = await request('/api/health');
assert(health.status === 200, 'QA HTTPS health failed.');
assert((await request('/api/orders/mobile_acceptance_order/images/0')).status === 404, 'An anonymous client read the private QA image.');
const manifest = await (await request('/manifest.json')).json();
assert(manifest.name.includes('اختبار'), 'The installed QA app name is not clearly labeled.');
const { csrfToken } = await (await request('/api/auth/csrf')).json();
await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ username: credentials.username, password: credentials.password, csrfToken, json: 'true', callbackUrl: base }) });
const session = await (await request('/api/auth/session')).json();
assert(session?.user?.id === 'mobile_acceptance_actor' && session.user.role === 'MANAGER' && !session.user.mustChangePassword, 'The synthetic QA account could not authenticate.');
const settings = await (await request('/api/settings')).json();
assert(settings.appName?.includes('بيئة اختبار الهاتف'), 'The QA interface is not clearly labeled.');
const form = await request('/orders/new');
assert(form.status === 200, 'The authenticated QA form did not open.');
const order = await (await request('/api/orders/mobile_acceptance_order')).json();
assert(order.customerName === 'طلب تهيئة اختباري' && order.paidAmount === 0 && order.remainingAmount === 100, 'The QA fixture differs from the synthetic baseline.');
const image = await request('/api/orders/mobile_acceptance_order/images/0');
const expected = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
assert(image.status === 200 && Buffer.from(await image.arrayBuffer()).equals(expected), 'The authenticated QA image differs from its fixture.');
console.log(JSON.stringify({ mobileAcceptanceReady: true, httpsHealth: 200, authenticatedRole: 'MANAGER', privateImageAnonymous: 404, privateImageAuthenticated: 200, syntheticOrderPaid: 0, qaBrandingVerified: true, physicalDeviceAcceptance: false, productionDataUsed: false }));
