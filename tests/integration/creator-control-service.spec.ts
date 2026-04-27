/**
 * creator-control-service.spec.ts
 * PAYLOAD 5 — CreatorControlService, Room-Heat engine, timing + monitoring
 * copilots. Hermetic tests, no broker connection required.
 */
import {
  FlickerNFlameScoringEngine,
  type FfsSample,
} from '../../services/creator-control/src/ffs.engine';
import { BroadcastTimingCopilot } from '../../services/creator-control/src/broadcast-timing.copilot';
import { SessionMonitoringCopilot } from '../../services/creator-control/src/session-monitoring.copilot';
import { CreatorControlService } from '../../services/creator-control/src/creator-control.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

type Published = { topic: string; payload: Record<string, unknown> };

function natsStub(): { stub: { publish: jest.Mock }; published: Published[] } {
  const published: Published[] = [];
  const stub = {
    publish: jest.fn((topic: string, payload: Record<string, unknown>) => {
      published.push({ topic, payload });
    }),
  };
  return { stub, published };
}

function sample(overrides: Partial<FfsSample> = {}): FfsSample {
  return {
    session_id: 'sess-1',
    creator_id: 'creator-1',
    tippers_online: 10,
    tips_per_minute: 5,
    avg_tip_tokens: 10,
    dwell_minutes: 10,
    diamond_guests_present: 1,
    captured_at_utc: new Date('2026-04-24T12:00:00Z').toISOString(),
    ...overrides,
  };
}

describe('FlickerNFlameScoringEngine — tier resolution', () => {
  it('computes COLD when no tippers and no velocity', () => {
    const { stub } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = new FlickerNFlameScoringEngine(stub as any);
    const score = engine.computeScore(
      sample({ tippers_online: 0, tips_per_minute: 0, diamond_guests_present: 0, avg_tip_tokens: 0 }),
    );
    expect(score.tier).toBe('COLD');
    expect(score.score).toBe(0);
  });

  it('computes INFERNO when pressure + velocity + VIPs all saturate', () => {
    const { stub } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = new FlickerNFlameScoringEngine(stub as any);
    const score = engine.computeScore(
      sample({
        tippers_online: 50,          // → 40 (capped)
        tips_per_minute: 20,
        avg_tip_tokens: 20,          // 20*20/10 = 40 (capped)
        diamond_guests_present: 4,   // → 20 (capped)
      }),
    );
    expect(score.score).toBe(100);
    expect(score.tier).toBe('INFERNO');
  });

  it('publishes TIER_CHANGED only when the tier crosses a band boundary', () => {
    const { stub, published } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = new FlickerNFlameScoringEngine(stub as any);
    engine.ingest(sample({ tippers_online: 1, tips_per_minute: 0, avg_tip_tokens: 0, diamond_guests_present: 0 })); // COLD
    engine.ingest(sample({ tippers_online: 1, tips_per_minute: 0, avg_tip_tokens: 0, diamond_guests_present: 0 })); // still COLD
    engine.ingest(sample({ tippers_online: 40, tips_per_minute: 5, avg_tip_tokens: 4, diamond_guests_present: 1 })); // WARM+
    const tierEvents = published.filter((p) => p.topic === NATS_TOPICS.FFS_TIER_CHANGED);
    // One transition COLD→X (initial set), then WARM (or higher) shift. Duplicates suppressed.
    expect(tierEvents.length).toBeGreaterThanOrEqual(1);
    expect(tierEvents.length).toBeLessThanOrEqual(2);
  });
});

describe('BroadcastTimingCopilot', () => {
  it('ranks high-traffic slots above low-traffic ones', () => {
    const copilot = new BroadcastTimingCopilot();
    const suggestions = copilot.recommendTopSlots({
      creator_id: 'creator-1',
      history: [
        { slot_start_utc: '2026-04-25T02:00:00Z', avg_tippers_online: 5,  avg_tips_per_minute: 0.5, sample_count: 20 },
        { slot_start_utc: '2026-04-25T22:00:00Z', avg_tippers_online: 40, avg_tips_per_minute: 6.0, sample_count: 30 },
        { slot_start_utc: '2026-04-25T10:00:00Z', avg_tippers_online: 12, avg_tips_per_minute: 1.5, sample_count: 15 },
      ],
      top_n: 2,
    });
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].suggested_slot_utc).toBe('2026-04-25T22:00:00Z');
  });

  it('scales confidence by sample_count', () => {
    const copilot = new BroadcastTimingCopilot();
    const [low] = copilot.recommendTopSlots({
      creator_id: 'creator-1',
      history: [
        { slot_start_utc: '2026-04-25T20:00:00Z', avg_tippers_online: 10, avg_tips_per_minute: 1, sample_count: 2 },
      ],
    });
    expect(low.confidence).toBe(0.2);
  });

  it('flags diamond-correlated slots with a specific reason code', () => {
    const copilot = new BroadcastTimingCopilot();
    const slot = '2026-04-25T22:00:00Z';
    const [top] = copilot.recommendTopSlots({
      creator_id: 'creator-1',
      history: [
        { slot_start_utc: slot, avg_tippers_online: 30, avg_tips_per_minute: 4, sample_count: 30 },
      ],
      diamond_correlated_slots: new Set([slot]),
    });
    expect(top.reason_code).toBe('HIGH_AVAILABILITY_WITH_DIAMOND_CORRELATION');
  });
});

describe('SessionMonitoringCopilot', () => {
  it('suggests RAISE at INFERNO with 20% magnitude', () => {
    const copilot = new SessionMonitoringCopilot();
    const nudge = copilot.suggestNudge({
      session_id: 's',
      creator_id: 'c',
      tier: 'INFERNO',
      score: 90,
      components: { tipper_pressure: 40, velocity: 40, vip_presence: 10 },
      captured_at_utc: 't',
      rule_applied_id: 'FFS_ENGINE_v1',
    });
    expect(nudge.direction).toBe('RAISE');
    expect(nudge.magnitude_pct).toBe(0.2);
  });

  it('suggests HOLD at WARM', () => {
    const copilot = new SessionMonitoringCopilot();
    const nudge = copilot.suggestNudge({
      session_id: 's',
      creator_id: 'c',
      tier: 'WARM',
      score: 30,
      components: { tipper_pressure: 15, velocity: 10, vip_presence: 5 },
      captured_at_utc: 't',
      rule_applied_id: 'FFS_ENGINE_v1',
    });
    expect(nudge.direction).toBe('HOLD');
    expect(nudge.magnitude_pct).toBe(0);
  });

  it('suggests LOWER at COLD', () => {
    const copilot = new SessionMonitoringCopilot();
    const nudge = copilot.suggestNudge({
      session_id: 's',
      creator_id: 'c',
      tier: 'COLD',
      score: 5,
      components: { tipper_pressure: 2, velocity: 3, vip_presence: 0 },
      captured_at_utc: 't',
      rule_applied_id: 'FFS_ENGINE_v1',
    });
    expect(nudge.direction).toBe('LOWER');
    expect(nudge.magnitude_pct).toBe(0.1);
  });
});

describe('CreatorControlService — workstation orchestration', () => {
  it('publishes SESSION_SUGGESTION and PRICE_NUDGE on high-heat ingest', () => {
    const { stub, published } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new CreatorControlService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stub as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new FlickerNFlameScoringEngine(stub as any),
      new BroadcastTimingCopilot(),
      new SessionMonitoringCopilot(),
    );
    const { heat, nudge } = svc.ingestSample(
      sample({ tippers_online: 50, tips_per_minute: 20, avg_tip_tokens: 20, diamond_guests_present: 4 }),
    );
    expect(heat.tier).toBe('INFERNO');
    expect(nudge.direction).toBe('RAISE');
    const topics = published.map((p) => p.topic);
    expect(topics).toContain(NATS_TOPICS.CREATOR_CONTROL_SESSION_SUGGESTION);
    expect(topics).toContain(NATS_TOPICS.CREATOR_CONTROL_PRICE_NUDGE);
  });

  it('does NOT publish PRICE_NUDGE when the suggestion is HOLD', () => {
    const { stub, published } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new CreatorControlService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stub as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new FlickerNFlameScoringEngine(stub as any),
      new BroadcastTimingCopilot(),
      new SessionMonitoringCopilot(),
    );
    // tippers_online: 40 → pressure=40, velocity=0, vip=0 → score=40 → WARM (34–60) → HOLD → no PRICE_NUDGE
    svc.ingestSample(sample({ tippers_online: 40, tips_per_minute: 0, avg_tip_tokens: 0, diamond_guests_present: 0 }));
    const nudgeEvents = published.filter((p) => p.topic === NATS_TOPICS.CREATOR_CONTROL_PRICE_NUDGE);
    expect(nudgeEvents).toHaveLength(0);
  });

  it('builds a workstation snapshot using cached heat state', () => {
    const { stub } = natsStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new CreatorControlService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stub as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new FlickerNFlameScoringEngine(stub as any),
      new BroadcastTimingCopilot(),
      new SessionMonitoringCopilot(),
    );
    svc.ingestSample(sample({ tippers_online: 40, tips_per_minute: 10, avg_tip_tokens: 8, diamond_guests_present: 2 }));
    const snap = svc.buildWorkstationSnapshot({
      creator_id: 'creator-1',
      active_session_id: 'sess-1',
      top_broadcast_slots: [],
      obs_ready: true,
      chat_aggregator_ready: false,
    });
    expect(snap.latest_heat).not.toBeNull();
    expect(snap.obs_ready).toBe(true);
    expect(snap.chat_aggregator_ready).toBe(false);
    expect(snap.rule_applied_id).toBe('CREATOR_CONTROL_ZONE_v1');
  });
});
