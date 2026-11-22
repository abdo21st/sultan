import { isSameOriginRequest, isUnsafeMethod } from './request-origin';

describe('request origin protection', () => {
  const url = 'https://sultan-qa.mtapp.ly/api/orders';
  const request = (requestUrl: string, method: string, headers: Record<string, string> = {}): Request => ({
    url: requestUrl,
    method,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  }) as unknown as Request;

  it('accepts an exact same-origin Origin header behind the trusted proxy', () => {
    expect(isSameOriginRequest(request(url, 'POST', {
      origin: 'https://sultan-qa.mtapp.ly',
      host: 'sultan-qa.mtapp.ly',
      'x-forwarded-host': 'sultan-qa.mtapp.ly',
      'x-forwarded-proto': 'https',
    }))).toBe(true);
  });

  it('rejects foreign, null, and malformed origins without falling back to Referer', () => {
    for (const origin of ['https://evil.example', 'null', '://bad']) {
      expect(isSameOriginRequest(request(url, 'POST', { origin, referer: 'https://sultan-qa.mtapp.ly/orders/new' }))).toBe(false);
    }
  });

  it('uses Referer only when Origin is absent and rejects requests without browser provenance', () => {
    expect(isSameOriginRequest(request(url, 'PATCH', { referer: `${url}/edit` }))).toBe(true);
    expect(isSameOriginRequest(request(url, 'PATCH'))).toBe(false);
    expect(isSameOriginRequest(request(url, 'PATCH', { 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });

  it('requires origin checks only for state-changing methods', () => {
    expect(['POST', 'PUT', 'PATCH', 'DELETE'].every(isUnsafeMethod)).toBe(true);
    expect(['GET', 'HEAD', 'OPTIONS'].some(isUnsafeMethod)).toBe(false);
  });
});
