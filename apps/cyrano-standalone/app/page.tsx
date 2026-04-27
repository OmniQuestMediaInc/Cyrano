// Cyrano Layer 2 — gated landing page
// Phase 0 surface: confirms the standalone runtime is reachable AND that the
// VIP gate is enforced. The middleware guarantees that any non-public route
// (including this one) is only reached with a valid cyrano_l2_session
// cookie; we read it server-side here for display.

import { cookies } from 'next/headers';
import { CYRANO_LAYER2_COOKIE, parseSessionCookie } from '../lib/cyrano-session';

export const dynamic = 'force-dynamic';

export default function Page() {
  const apiBase = process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000';
  const cookieStore = cookies();
  const session = parseSessionCookie(cookieStore.get(CYRANO_LAYER2_COOKIE)?.value);

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h1>Cyrano™ Layer 2</h1>
      <p>VIP/Diamond persistent-worlds whisper console.</p>

      {session ? (
        <section style={{ marginTop: 24, padding: 16, border: '1px solid #2a2', borderRadius: 4 }}>
          <p>
            <strong>Welcome, {session.tier_display} member.</strong>
          </p>
          <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
            <li>
              Session: <code>{session.session_id}</code>
            </li>
            <li>
              Tier: <code>{session.resolved_tier}</code>
            </li>
            <li>
              Content mode: <code>{session.content_mode}</code>
            </li>
            <li>
              Expires: <code>{session.expires_at_utc}</code>
            </li>
          </ul>
        </section>
      ) : (
        <p style={{ color: '#a00' }}>No Cyrano session found on this request (unexpected).</p>
      )}

      <p style={{ marginTop: 24 }}>
        Core API base: <code>{apiBase}</code>
      </p>
      <p style={{ marginTop: 8, color: '#666' }}>
        Phase 0 scaffolding complete. Phase 1 will introduce persistent worlds and multi-session
        story memory backed by <code>cyrano_world_sessions</code>.
      </p>
    </main>
  );
}
