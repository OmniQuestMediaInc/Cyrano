// Cyrano™ Standalone — home dashboard
// Shows the VIP session status and navigation to core Cyrano features:
//   • AI Twin Creator (photo upload + Flux LoRA training)
//   • Character Chat (persistent narrative memory)
//   • Voice Call (ElevenLabs cloned voice)

import { cookies } from 'next/headers';
import { CYRANO_LAYER2_COOKIE, parseSessionCookie } from '../lib/cyrano-session';

export const dynamic = 'force-dynamic';

export default function Page() {
  const apiBase = process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000';
  const cookieStore = cookies();
  const session = parseSessionCookie(cookieStore.get(CYRANO_LAYER2_COOKIE)?.value);

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>Cyrano™</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        AI character companions with persistent memory, photorealistic imagery, and cloned voices.
      </p>

      {session ? (
        <section style={{ marginBottom: 24, padding: 16, border: '1px solid #2a2', borderRadius: 6 }}>
          <strong>Welcome, {session.tier_display} member.</strong>{' '}
          <span style={{ color: '#666', fontSize: 14 }}>
            Tier: {session.resolved_tier} · Session: {session.session_id}
          </span>
        </section>
      ) : (
        <p style={{ color: '#a00', marginBottom: 24 }}>No Cyrano session (gate bypassed in dev mode).</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <FeatureCard
          icon="🧬"
          title="AI Twin Creator"
          description="Upload photos and train a Flux LoRA character twin with photorealistic image generation."
          href="/ai-twin"
        />
        <FeatureCard
          icon="💬"
          title="Character Chat"
          description="Persistent narrative conversations powered by long-term memory and cinematic branching."
          href="/chat"
        />
        <FeatureCard
          icon="📞"
          title="Voice Call"
          description="Call your character with an ElevenLabs-cloned voice for real-time spoken interactions."
          href="/voice-call"
        />
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: '#999' }}>
        Core API: <code>{apiBase}</code> · Cyrano™ Standalone by OmniQuest Media Inc.
      </p>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: 20,
        border: '1px solid #ddd',
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>{description}</div>
    </a>
  );
}
