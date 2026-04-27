// Cyrano Layer 2 — session establishment Route Handler
// POST /api/auth/session
//   - Reads the canonical platform identity headers attached by the upstream
//     reverse proxy (x-user-id / x-organization-id / x-tenant-id).
//   - Calls the core API gate.
//   - On success, sets the cyrano_l2_session HttpOnly cookie and redirects
//     the user back to ?next=… (or '/').
//   - On denial, redirects to /access-denied?reason=…
//
// GET on the same path returns the current session JSON for diagnostics.

import { NextRequest, NextResponse } from 'next/server';
import {
  establishCyranoSession,
  readPlatformIdentityFromHeaders,
} from '../../../../lib/cyrano-auth-client';
import { CYRANO_LAYER2_COOKIE, parseSessionCookie } from '../../../../lib/cyrano-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  // Only allow same-origin paths starting with a single slash.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const identity = readPlatformIdentityFromHeaders(req.headers);
  if (!identity) {
    const url = req.nextUrl.clone();
    url.pathname = '/access-denied';
    url.search = '';
    url.searchParams.set('reason', 'NO_USER_CONTEXT');
    return NextResponse.redirect(url, { status: 303 });
  }

  const result = await establishCyranoSession(identity);
  const next = safeNext(req.nextUrl.searchParams.get('next'));

  if (!result.ok || !result.session) {
    const url = req.nextUrl.clone();
    url.pathname = '/access-denied';
    url.search = '';
    url.searchParams.set('reason', result.reasonCode ?? 'TIER_INSUFFICIENT');
    if (result.resolvedTier) url.searchParams.set('tier', result.resolvedTier);
    return NextResponse.redirect(url, { status: 303 });
  }

  const expiresAt = new Date(result.session.expires_at_utc);
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = next;
  redirectUrl.search = '';

  const res = NextResponse.redirect(redirectUrl, { status: 303 });
  res.cookies.set({
    name: CYRANO_LAYER2_COOKIE,
    value: JSON.stringify(result.session),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
  return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cookie = req.cookies.get(CYRANO_LAYER2_COOKIE)?.value;
  const session = parseSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ result: 'NO_SESSION' }, { status: 404 });
  }
  return NextResponse.json(session);
}
