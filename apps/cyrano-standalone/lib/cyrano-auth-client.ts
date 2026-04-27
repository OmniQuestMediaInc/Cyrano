// Cyrano Layer 2 — backend gate client
// Server-side only (Next.js Route Handler / middleware). Calls the core API's
// POST /cyrano/auth/session, forwarding the canonical platform identity
// headers. Returns the granted session or null on a 4xx denial.

import type { CyranoLayer2ContentMode, CyranoLayer2Session } from './cyrano-session';
import { PLATFORM_IDENTITY_HEADERS } from './cyrano-session';

const apiBase = process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000';

export interface PlatformIdentity {
  userId: string;
  organizationId: string;
  tenantId: string;
  correlationId?: string;
}

export interface EstablishResult {
  ok: boolean;
  status: number;
  session: CyranoLayer2Session | null;
  reasonCode?: string;
  ruleAppliedId?: string;
  resolvedTier?: string;
}

export async function establishCyranoSession(
  identity: PlatformIdentity,
  contentMode: CyranoLayer2ContentMode = 'adult',
): Promise<EstablishResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [PLATFORM_IDENTITY_HEADERS.USER_ID]: identity.userId,
    [PLATFORM_IDENTITY_HEADERS.ORGANIZATION_ID]: identity.organizationId,
    [PLATFORM_IDENTITY_HEADERS.TENANT_ID]: identity.tenantId,
  };
  if (identity.correlationId) {
    headers[PLATFORM_IDENTITY_HEADERS.CORRELATION_ID] = identity.correlationId;
  }

  const res = await fetch(`${apiBase}/cyrano/auth/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content_mode: contentMode }),
    cache: 'no-store',
  });

  if (res.ok) {
    const session = (await res.json()) as CyranoLayer2Session;
    return { ok: true, status: res.status, session };
  }

  // Surface canonical denial fields so the gate UI can show a useful message
  // without exposing raw backend error envelopes.
  let reasonCode: string | undefined;
  let ruleAppliedId: string | undefined;
  let resolvedTier: string | undefined;
  try {
    const body = (await res.json()) as {
      reason_code?: string;
      rule_applied_id?: string;
      resolved_tier?: string;
    };
    reasonCode = body.reason_code;
    ruleAppliedId = body.rule_applied_id;
    resolvedTier = body.resolved_tier;
  } catch {
    // Body was not JSON — keep undefined.
  }

  return {
    ok: false,
    status: res.status,
    session: null,
    reasonCode,
    ruleAppliedId,
    resolvedTier,
  };
}

export function readPlatformIdentityFromHeaders(
  headers: Headers,
): PlatformIdentity | null {
  const userId = headers.get(PLATFORM_IDENTITY_HEADERS.USER_ID);
  const organizationId = headers.get(PLATFORM_IDENTITY_HEADERS.ORGANIZATION_ID);
  const tenantId = headers.get(PLATFORM_IDENTITY_HEADERS.TENANT_ID);
  const correlationId = headers.get(PLATFORM_IDENTITY_HEADERS.CORRELATION_ID) ?? undefined;
  if (!userId || !organizationId || !tenantId) return null;
  return { userId, organizationId, tenantId, correlationId };
}
