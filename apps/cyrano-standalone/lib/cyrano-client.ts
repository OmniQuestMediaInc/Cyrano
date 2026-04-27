// Cyrano Layer 2 — thin platform-API client
// Phase 3.10 scaffolding. The standalone app reaches the rest of the
// platform via these typed wrappers; it never imports the monorepo's
// Prisma client or the NestJS modules directly.

export interface CyranoSuggestionView {
  suggestion_id: string;
  category: string;
  copy: string;
  weight: number;
  tier_context: 'COLD' | 'WARM' | 'HOT' | 'INFERNO';
  emitted_at_utc: string;
}

const apiBase = (typeof process !== 'undefined' && process.env.CYRANO_CORE_API_URL) ||
  'http://localhost:3000';

/** Fetch the latest emitted suggestions for a session. */
export async function getRecentSuggestions(session_id: string): Promise<CyranoSuggestionView[]> {
  const res = await fetch(`${apiBase}/cyrano/sessions/${encodeURIComponent(session_id)}/suggestions`);
  if (!res.ok) throw new Error(`getRecentSuggestions failed: ${res.status}`);
  return res.json() as Promise<CyranoSuggestionView[]>;
}

/** Subscribe to the platform's NATS bridge for live updates (Server-Sent Events). */
export function openSuggestionStream(session_id: string, onMessage: (s: CyranoSuggestionView) => void): () => void {
  const url = `${apiBase}/cyrano/sessions/${encodeURIComponent(session_id)}/stream`;
  // EventSource is browser-native; this is a Layer 2 (browser-only) helper.
  const es = new EventSource(url);
  es.onmessage = (ev: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(ev.data) as CyranoSuggestionView;
      onMessage(parsed);
    } catch {
      // Drop malformed frames silently.
    }
  };
  return () => es.close();
}
