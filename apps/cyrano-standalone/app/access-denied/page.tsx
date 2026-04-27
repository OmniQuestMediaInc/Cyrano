// Cyrano Layer 2 — VIP gate denial page
// Reached when middleware finds no valid session, or when the establishment
// route handler returns a denial. Shows the membership requirement and
// offers a single action: re-attempt session establishment via the route
// handler. Phase 0 — no styling beyond the base inline styles already in
// use across the standalone app.

import Link from 'next/link';

interface SearchParams {
  reason?: string;
  tier?: string;
  next?: string;
}

const REASON_COPY: Record<string, string> = {
  NO_SESSION: 'You do not have an active Cyrano session yet.',
  SESSION_EXPIRED: 'Your Cyrano session has expired.',
  TIER_INSUFFICIENT: 'Cyrano requires OmniPass+ or Diamond membership.',
  NO_USER_CONTEXT: 'We could not identify you on this request. Please re-enter via ChatNow.Zone.',
};

export default function AccessDeniedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const reason = searchParams.reason ?? 'NO_SESSION';
  const tier = searchParams.tier;
  const next = searchParams.next ?? '/';
  const message = REASON_COPY[reason] ?? 'Access to Cyrano Layer 2 was denied.';

  const establishHref = `/api/auth/session?next=${encodeURIComponent(next)}`;

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h1>Cyrano™ Layer 2 — Members Only</h1>
      <p style={{ marginTop: 16 }}>{message}</p>

      <ul style={{ marginTop: 24, lineHeight: 1.6 }}>
        <li>
          Required tier: <strong>OmniPass+</strong> (VIP_PLATINUM) or <strong>Diamond</strong>{' '}
          (VIP_DIAMOND)
        </li>
        {tier ? (
          <li>
            Your current tier: <code>{tier}</code>
          </li>
        ) : null}
        <li>
          Reason code: <code>{reason}</code>
        </li>
      </ul>

      <form
        action={establishHref}
        method="post"
        style={{ marginTop: 32, display: 'flex', gap: 12 }}
      >
        <button
          type="submit"
          style={{
            padding: '10px 18px',
            border: '1px solid #444',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          Re-establish session
        </button>
        <Link
          href="/"
          style={{ padding: '10px 18px', alignSelf: 'center', color: '#444' }}
        >
          Back to home
        </Link>
      </form>

      <p style={{ marginTop: 32, fontSize: 12, color: '#888' }}>
        If you believe you should have access, contact Diamond Concierge from your{' '}
        ChatNow.Zone account dashboard.
      </p>
    </main>
  );
}
