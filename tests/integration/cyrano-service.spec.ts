/**
 * cyrano-service.spec.ts
 * PAYLOAD 5 — CyranoService: category selection, tier-weighted scoring,
 * latency SLO enforcement, persona-tone copy, NATS whisper emission.
 *
 * Hermetic — no database or broker connection required.
 */
import { CyranoService, CYRANO_LATENCY } from '../../services/cyrano/src/cyrano.service';
import { PersonaManager } from '../../services/cyrano/src/persona.manager';
import { SessionMemoryStore } from '../../services/cyrano/src/session-memory.store';
import type {
  CyranoInputFrame,
  MemoryFact,
} from '../../services/cyrano/src/cyrano.types';
import type { FfsScore, FfsTier } from '../../services/creator-control/src/ffs.engine';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

type Published = { topic: string; payload: Record<string, unknown> };

function buildNatsStub(): { stub: { publish: jest.Mock }; published: Published[] } {
  const published: Published[] = [];
  const stub = {
    publish: jest.fn((topic: string, payload: Record<string, unknown>) => {
      published.push({ topic, payload });
    }),
  };
  return { stub, published };
}

function heat(tier: FfsTier, score = 60): FfsScore {
  return {
    session_id: 'sess-1',
    creator_id: 'creator-1',
    tier,
    score,
    components: { tipper_pressure: 20, velocity: 25, vip_presence: 15 },
    captured_at_utc: new Date('2026-04-24T12:00:00Z').toISOString(),
    rule_applied_id: 'FFS_ENGINE_v1',
  };
}

function frame(overrides: Partial<CyranoInputFrame> = {}): CyranoInputFrame {
  return {
    session_id: 'sess-1',
    creator_id: 'creator-1',
    guest_id: 'guest-1',
    phase: 'MID',
    heat: heat('WARM'),
    silence_seconds: 5,
    dwell_minutes: 3,
    guest_has_tipped: false,
    latest_guest_message: 'hi!',
    captured_at_utc: new Date('2026-04-24T12:00:00Z').toISOString(),
    ...overrides,
  };
}

function makeService(clockMs = 1_000_000): {
  svc: CyranoService;
  memory: SessionMemoryStore;
  personas: PersonaManager;
  published: Published[];
  advance: (ms: number) => void;
} {
  const { stub, published } = buildNatsStub();
  const memory = new SessionMemoryStore();
  const personas = new PersonaManager();
  let now = clockMs;
  const advance = (ms: number): void => {
    now += ms;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new CyranoService(stub as any, memory, personas, () => now);
  return { svc, memory, personas, published, advance };
}

describe('CyranoService.selectCategory — phase gates', () => {
  it('OPENING phase always selects CAT_SESSION_OPEN', () => {
    const { svc } = makeService();
    const out = svc.evaluate(frame({ phase: 'OPENING', heat: heat('INFERNO') }));
    expect(out?.category).toBe('CAT_SESSION_OPEN');
  });

  it('CLOSING phase always selects CAT_SESSION_CLOSE', () => {
    const { svc } = makeService();
    const out = svc.evaluate(frame({ phase: 'CLOSING', heat: heat('COLD') }));
    expect(out?.category).toBe('CAT_SESSION_CLOSE');
  });
});

describe('CyranoService.selectCategory — tier weighting', () => {
  it('INFERNO tier selects monetization (highest tier weight = 95)', () => {
    const { svc } = makeService();
    const out = svc.evaluate(frame({ phase: 'PEAK', heat: heat('INFERNO') }));
    expect(out?.category).toBe('CAT_MONETIZATION');
  });

  it('HOT tier prefers escalation over lower-weighted categories', () => {
    const { svc } = makeService();
    const out = svc.evaluate(
      frame({ phase: 'MID', heat: heat('HOT'), guest_has_tipped: true }),
    );
    // HOT has escalation=85, monetization=80, narrative=70 — escalation wins.
    expect(out?.category).toBe('CAT_ESCALATION');
  });

  it('COLD tier + long silence + untipped guest triggers RECOVERY override', () => {
    const { svc } = makeService();
    const out = svc.evaluate(
      frame({ heat: heat('COLD'), silence_seconds: 45, guest_has_tipped: false }),
    );
    expect(out?.category).toBe('CAT_RECOVERY');
  });
});

describe('CyranoService.computeWeight — modulators', () => {
  it('INFERNO monetization with guest_has_tipped is boosted (+10)', () => {
    const { svc } = makeService();
    const out = svc.evaluate(
      frame({ phase: 'PEAK', heat: heat('INFERNO'), guest_has_tipped: true }),
    );
    // Base 95 + 10 = 105 → clamped to 100.
    expect(out?.category).toBe('CAT_MONETIZATION');
    expect(out?.weight).toBe(100);
  });

  it('CAT_SESSION_OPEN weight is reduced when dwell_minutes >= 5', () => {
    const { svc } = makeService();
    const out = svc.evaluate(
      frame({ phase: 'OPENING', dwell_minutes: 7, heat: heat('COLD') }),
    );
    // Base 90 − 20 = 70.
    expect(out?.category).toBe('CAT_SESSION_OPEN');
    expect(out?.weight).toBe(70);
  });

  it('CAT_RECOVERY weight is boosted when silence_seconds >= 60', () => {
    const { svc } = makeService();
    const out = svc.evaluate(
      frame({ heat: heat('COLD'), silence_seconds: 90, guest_has_tipped: false }),
    );
    // Base 80 + 15 = 95.
    expect(out?.category).toBe('CAT_RECOVERY');
    expect(out?.weight).toBe(95);
  });
});

describe('CyranoService — memory + persona integration', () => {
  it('callback override fires when ≥2 durable facts exist in WARM MID-session', () => {
    const { svc, memory } = makeService();
    const facts: MemoryFact[] = [
      { id: 'f1', key: 'pet.name', value: 'Mochi', confidence: 0.9, learned_at_utc: 'x' },
      { id: 'f2', key: 'trip.last', value: 'Kyoto', confidence: 0.8, learned_at_utc: 'x' },
    ];
    facts.forEach((fact) =>
      memory.upsertFact({ creator_id: 'creator-1', guest_id: 'guest-1', fact }),
    );
    const out = svc.evaluate(frame({ phase: 'MID', heat: heat('WARM'), guest_has_tipped: true }));
    expect(out?.category).toBe('CAT_CALLBACK');
  });

  it('suggestion copy includes the active persona tone tag', () => {
    const { svc, personas } = makeService();
    personas.register({
      persona_id: 'p1',
      creator_id: 'creator-1',
      display_name: 'Aria',
      tone: 'playful_dominant',
      style_notes: 'short, assertive',
      active: true,
    });
    personas.activateForSession({ session_id: 'sess-1', creator_id: 'creator-1', persona_id: 'p1' });
    const out = svc.evaluate(frame({ phase: 'PEAK', heat: heat('INFERNO') }));
    expect(out?.copy).toContain('[playful_dominant]');
    expect(out?.persona_id).toBe('p1');
  });
});

describe('CyranoService — latency SLO', () => {
  it('silently discards suggestions beyond the hard cutoff and emits a drop event', () => {
    const { svc, published, advance } = makeService(1_000_000);
    // Advance the clock past the hard cutoff between frame-received and emit.
    const t0 = 1_000_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svcAny = svc as any;
    // Tick the internal clock ~5s forward before the eval call resolves.
    advance(CYRANO_LATENCY.HARD_CUTOFF_MS + 500);
    const result = svcAny.evaluate(frame({ phase: 'PEAK', heat: heat('INFERNO') }), t0);
    expect(result).toBeNull();
    const drop = published.find((p) => p.topic === NATS_TOPICS.CYRANO_SUGGESTION_DROPPED);
    expect(drop).toBeDefined();
    expect(drop?.payload.reason_code).toBe('LATENCY_EXCEEDED');
  });

  it('emits on CYRANO_SUGGESTION_EMITTED when within the SLO', () => {
    const { svc, published } = makeService();
    svc.evaluate(frame({ phase: 'PEAK', heat: heat('INFERNO') }));
    const emitted = published.find((p) => p.topic === NATS_TOPICS.CYRANO_SUGGESTION_EMITTED);
    expect(emitted).toBeDefined();
    expect(emitted?.payload.category).toBe('CAT_MONETIZATION');
  });
});
