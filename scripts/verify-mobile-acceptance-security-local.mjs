const base = 'http://127.0.0.1:3375';
const trustedProxyHeaders = {
  Host: 'sultan-qa.mtapp.ly',
  'X-Forwarded-Host': 'sultan-qa.mtapp.ly',
  'X-Forwarded-Proto': 'https',
};

async function request(path, init = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: { ...trustedProxyHeaders, ...init.headers },
  });
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const health = await request('/api/health');
assert(health.status === 200, 'QA health failed.');

const loginPage = await request('/login');
assert(loginPage.status === 200, 'The QA login page did not load.');
const csp = loginPage.headers.get('content-security-policy') || '';
const scriptPolicy = csp.split(';').find((directive) => directive.trim().startsWith('script-src')) || '';
const nonce = /'nonce-([^']+)'/.exec(scriptPolicy)?.[1];
assert(nonce && scriptPolicy.includes("'strict-dynamic'") && !scriptPolicy.includes("'unsafe-inline'"), 'The login page CSP is missing its strict nonce.');
const html = await loginPage.text();
assert([...html.matchAll(/\bnonce="([^"]+)"/g)].some((match) => match[1] === nonce), 'The response script nonce does not match its CSP.');

const crossOrigin = await request('/api/orders', {
  method: 'POST',
  headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' },
  body: '{}',
});
assert(crossOrigin.status === 403 && (await crossOrigin.text()).includes('Invalid request origin'), 'The cross-origin API write was not blocked.');

const missingOrigin = await request('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
assert(missingOrigin.status === 403 && (await missingOrigin.text()).includes('Invalid request origin'), 'The API write without browser provenance was not blocked.');

const sameOrigin = await request('/api/orders', {
  method: 'POST',
  headers: { Origin: 'https://sultan-qa.mtapp.ly', 'Content-Type': 'application/json' },
  body: '{}',
});
assert(!(await sameOrigin.text()).includes('Invalid request origin'), 'The same-origin request did not pass the CSRF guard.');
console.log(JSON.stringify({ qaHealth: 200, cspNonceAndScriptMatch: true, crossOriginWrite: 403, missingOriginWrite: 403, sameOriginPassedGuard: true }));
