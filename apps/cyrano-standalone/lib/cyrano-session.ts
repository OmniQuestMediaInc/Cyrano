// Cyrano Layer 2 — session DTO + cookie name + ttl
// Mirrors the backend `CyranoLayer2SessionGranted` shape so the Next.js
// runtime can pass the granted session through middleware → server components
// without redefining the contract.

export type CyranoLayer2Tier = 'VIP_PLATINUM' | 'VIP_DIAMOND';
export type CyranoLayer2ContentMode = 'adult' | 'narrative';

export interface CyranoLayer2Session {
  result: 'GRANTED';
  session_id: string;
  user_id: string;
  resolved_tier: CyranoLayer2Tier;
  tier_display: string;
  content_mode: CyranoLayer2ContentMode;
  expires_at_utc: string;
  correlation_id: string;
  reason_code: 'TIER_AUTHORIZED';
  rule_applied_id: string;
}

/** Cookie name used by middleware + the /api/auth/session route handler. */
export const CYRANO_LAYER2_COOKIE = 'cyrano_l2_session';

/** Headers the upstream platform proxy is expected to attach to every request. */
export const PLATFORM_IDENTITY_HEADERS = {
  USER_ID: 'x-user-id',
  ORGANIZATION_ID: 'x-organization-id',
  TENANT_ID: 'x-tenant-id',
  CORRELATION_ID: 'x-correlation-id',
} as const;

/** Routes that bypass the VIP gate. */
export const PUBLIC_ROUTES: readonly string[] = ['/access-denied'];

export function isSessionExpired(session: CyranoLayer2Session, now: Date = new Date()): boolean {
  return Date.parse(session.expires_at_utc) <= now.getTime();
}

export function parseSessionCookie(value: string | undefined): CyranoLayer2Session | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CyranoLayer2Session;
    if (parsed.result !== 'GRANTED' || !parsed.session_id || !parsed.expires_at_utc) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
