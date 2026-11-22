import { randomBytes } from 'node:crypto';
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { isSameOriginRequest, isUnsafeMethod } from '@/lib/request-origin';

function createContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    'img-src \'self\' data: blob: https:',
    "font-src 'self' data: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const pageAuthProxy = auth((request) => {
  const nonce = randomBytes(16).toString('base64');
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}) as unknown as NextMiddleware;

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const path = request.nextUrl.pathname;
    const builtInCsrf = path.startsWith('/api/auth/');
    const bearerProtected = path.startsWith('/api/cron/');
    if (isUnsafeMethod(request.method) && !builtInCsrf && !bearerProtected && !isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
    return NextResponse.next();
  }

  return pageAuthProxy(request, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|manifest\\.json|favicon\\.ico|.*\\.png$|.*\\.svg$|.*\\.apk$|downloads/).*)'],
};
