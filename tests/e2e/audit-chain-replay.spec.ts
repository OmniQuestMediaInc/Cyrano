// PAYLOAD 8 — End-to-end test: immutable audit chain validation + replay.
//
// Verifies the canonical hash-chain invariant: each event's hash_current is
// SHA-256(hash_prior || payload_hash). Tampering any prior payload breaks
// the chain on the next walk.

import { createHash } from 'crypto';
import { DiamondConciergePresenter } from '../../ui/view-models/diamond-concierge.presenter';
import type { AuditEventInput } from '../../ui/view-models/diamond-concierge.presenter';

const GENESIS = '0'.repeat(64);

function payloadHashFor(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(stable).digest('hex');
}

function chainHash(prior: string, payloadHash: string): string {
  return createHash('sha256')
    .update(prior + payloadHash)
    .digest('hex');
}

interface ChainEvent {
  event_id: string;
  sequence_number: bigint;
  event_type: string;
  correlation_id: string;
  actor_id: string | null;
  occurred_at_utc: string;
  redacted_payload: Record<string, unknown>;
  payload_hash: string;
  hash_prior: string | null;
  hash_current: string;
}

function buildChain(
  events: Array<Omit<ChainEvent, 'payload_hash' | 'hash_prior' | 'hash_current'>>,
): ChainEvent[] {
  const out: ChainEvent[] = [];
  let prior = GENESIS;
  for (const e of events) {
    const ph = payloadHashFor(e.redacted_payload);
    const hc = chainHash(prior, ph);
    out.push({ ...e, payload_hash: ph, hash_prior: prior, hash_current: hc });
    prior = hc;
  }
  return out;
}

function verifyChain(events: ChainEvent[]): {
  valid: boolean;
  first_failure?: string;
} {
  let prior = GENESIS;
  for (const e of events) {
    const ph = payloadHashFor(e.redacted_payload);
    if (ph !== e.payload_hash) {
      return { valid: false, first_failure: `payload_hash drift on ${e.event_id}` };
    }
    if (e.hash_prior !== prior) {
      return { valid: false, first_failure: `hash_prior drift on ${e.event_id}` };
    }
    const expected = chainHash(prior, e.payload_hash);
    if (expected !== e.hash_current) {
      return { valid: false, first_failure: `hash_current drift on ${e.event_id}` };
    }
    prior = e.hash_current;
  }
  return { valid: true };
}

describe('PAYLOAD 8 — immutable audit chain replay', () => {
  it('walks an intact 3-event chain end-to-end', () => {
    const chain = buildChain([
      {
        event_id: 'aud-1',
        sequence_number: 1n,
        event_type: 'PURCHASE',
        correlation_id: 'corr-1',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:00:00Z',
        redacted_payload: { reason_code: 'PURCHASE', amount: 1000 },
      },
      {
        event_id: 'aud-2',
        sequence_number: 2n,
        event_type: 'SPEND',
        correlation_id: 'corr-2',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:05:00Z',
        redacted_payload: { reason_code: 'SPEND', amount: 250 },
      },
      {
        event_id: 'aud-3',
        sequence_number: 3n,
        event_type: 'GATEGUARD_DECISION',
        correlation_id: 'corr-3',
        actor_id: null,
        occurred_at_utc: '2026-04-25T10:06:00Z',
        redacted_payload: { decision: 'APPROVE', fraud: 12, welfare: 18 },
      },
    ]);

    expect(chain[0].hash_prior).toBe(GENESIS);
    expect(verifyChain(chain).valid).toBe(true);
  });

  it('detects payload tampering on a prior event', () => {
    const chain = buildChain([
      {
        event_id: 'aud-1',
        sequence_number: 1n,
        event_type: 'PURCHASE',
        correlation_id: 'corr-1',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:00:00Z',
        redacted_payload: { reason_code: 'PURCHASE', amount: 1000 },
      },
      {
        event_id: 'aud-2',
        sequence_number: 2n,
        event_type: 'SPEND',
        correlation_id: 'corr-2',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:05:00Z',
        redacted_payload: { reason_code: 'SPEND', amount: 250 },
      },
    ]);
    chain[0].redacted_payload = { reason_code: 'PURCHASE', amount: 999_999 };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.first_failure).toMatch(/payload_hash drift/);
  });

  it('detects hash_current tampering anywhere in the chain', () => {
    const chain = buildChain([
      {
        event_id: 'aud-1',
        sequence_number: 1n,
        event_type: 'PURCHASE',
        correlation_id: 'corr-1',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:00:00Z',
        redacted_payload: { reason_code: 'PURCHASE', amount: 1000 },
      },
      {
        event_id: 'aud-2',
        sequence_number: 2n,
        event_type: 'SPEND',
        correlation_id: 'corr-2',
        actor_id: 'u-1',
        occurred_at_utc: '2026-04-25T10:05:00Z',
        redacted_payload: { reason_code: 'SPEND', amount: 250 },
      },
    ]);
    chain[1].hash_current = 'f'.repeat(64);
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.first_failure).toMatch(/hash_current drift/);
  });

  it('renders the chain into the audit-chain UI window in monotonic order', () => {
    const chain = buildChain([
      {
        event_id: 'aud-a',
        sequence_number: 11n,
        event_type: 'PURCHASE',
        correlation_id: 'corr-a',
        actor_id: 'u-a',
        occurred_at_utc: '2026-04-25T10:00:00Z',
        redacted_payload: { reason_code: 'PURCHASE', amount: 100 },
      },
      {
        event_id: 'aud-b',
        sequence_number: 12n,
        event_type: 'SPEND',
        correlation_id: 'corr-b',
        actor_id: 'u-a',
        occurred_at_utc: '2026-04-25T10:01:00Z',
        redacted_payload: { reason_code: 'SPEND', amount: 50 },
      },
    ]);
    const presenter = new DiamondConciergePresenter();
    const inputs: AuditEventInput[] = chain.map((e) => ({
      event_id: e.event_id,
      sequence_number: e.sequence_number,
      event_type: e.event_type,
      correlation_id: e.correlation_id,
      actor_id: e.actor_id,
      occurred_at_utc: e.occurred_at_utc,
      payload_hash: e.payload_hash,
      hash_prior: e.hash_prior,
      hash_current: e.hash_current,
    }));
    const window = presenter.buildAuditChainWindow(inputs);
    // Sorted descending by sequence_number.
    expect(window[0].event_id).toBe('aud-b');
    expect(window[1].event_id).toBe('aud-a');
    expect(window[0].sequence_number).toBe('12');
    expect(window[0].hash_current).toBe(chain[1].hash_current);
  });
});
