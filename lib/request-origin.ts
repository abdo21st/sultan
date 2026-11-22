const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(',', 1)[0]?.trim();
  return first || null;
}

function expectedOrigin(request: Request): string | null {
  const requestUrl = new URL(request.url);
  const host = firstHeaderValue(request.headers.get('x-forwarded-host')) ?? request.headers.get('host') ?? requestUrl.host;
  const protocol = firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? requestUrl.protocol.slice(0, -1);
  if (!host || (protocol !== 'http' && protocol !== 'https')) return null;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export function isUnsafeMethod(method: string): boolean {
  return unsafeMethods.has(method.toUpperCase());
}

export function isSameOriginRequest(request: Request): boolean {
  const expected = expectedOrigin(request);
  if (!expected) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin === expected;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }

  return request.headers.get('sec-fetch-site')?.toLowerCase() === 'same-origin';
}
