// Cyrano Layer 2 — Next.js middleware (VIP gate)
// Runs at the edge before every request. Strategy:
//   1. Always allow public routes (/access-denied, /api/auth/session, _next, …).
//   2. If a non-expired cyrano_l2_session cookie is present, allow.
//   3. Otherwise redirect to /access-denied with a query hint. The denial
//      page links to the route handler that re-establishes the session via
//      the upstream platform identity headers; that handler sets the cookie
//      and redirects back. The middleware itself does not call the backend
//      — keeping it side-effect-free is intentional for edge runtime.

import { NextRequest, NextResponse } from 'next/server';
import { CYRANO_LAYER2_COOKIE, isSessionExpired, parseSessionCookie, PUBLIC_ROUTES } from './lib/cyrano-session';

export const config = {
  // Apply to all paths except Next.js internals and static assets. Route
  // handlers under /api are matched so we can let /api/auth/session through
  // explicitly inside the middleware.
  matcher: ['/((?!_next/|favicon.ico|robots.txt).*)'],
};

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true;
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(CYRANO_LAYER2_COOKIE)?.value;
  const session = parseSessionCookie(cookie);

  if (session && !isSessionExpired(session)) {
    const res = NextResponse.next();
    // Pass tier through to server components without re-parsing the cookie.
    res.headers.set('x-cyrano-l2-tier', session.resolved_tier);
    res.headers.set('x-cyrano-l2-session-id', session.session_id);
    return res;
  }

  const denyUrl = req.nextUrl.clone();
  denyUrl.pathname = '/access-denied';
  denyUrl.search = '';
  denyUrl.searchParams.set('next', `${pathname}${search}`);
  if (!session) {
    denyUrl.searchParams.set('reason', 'NO_SESSION');
  } else {
    denyUrl.searchParams.set('reason', 'SESSION_EXPIRED');
  }
  return NextResponse.redirect(denyUrl);
}
