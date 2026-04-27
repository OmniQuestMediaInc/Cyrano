/**
 * integration-hub.spec.ts
 * PAYLOAD 5 — End-to-end flow: a high-heat session goes through
 * CreatorControl → Cyrano → Integration Hub → payout scaling + monetization
 * handoff. Hermetic.
 */
import { IntegrationHubService } from '../../services/integration-hub/src/hub.service';
import { CreatorControlService } from '../../services/creator-control/src/creator-control.service';
import { CyranoService } from '../../services/cyrano/src/cyrano.service';
import { BroadcastTimingCopilot } from '../../services/creator-control/src/broadcast-timing.copilot';
import { SessionMonitoringCopilot } from '../../services/creator-control/src/session-monitoring.copilot';
import { FlickerNFlameScoringEngine } from '../../services/creator-control/src/ffs.engine';
import { PersonaManager } from '../../services/cyrano/src/persona.manager';
import { SessionMemoryStore } from '../../services/cyrano/src/session-memory.store';
import { LEDGER_SPEND_ORDER } from '../../services/core-api/src/config/governance.config';
import { NATS_TOPICS } from '../../services/nats/topics.registry';
import type { CyranoInputFrame } from '../../services/cyrano/src/cyrano.types';
import type { FfsSample } from '../../services/creator-control/src/ffs.engine';

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

function makeHub(): {
  hub: IntegrationHubService;
  published: Published[];
} {
  const { stub, published } = natsStub();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heat = new FlickerNFlameScoringEngine(stub as any);
  const timing = new BroadcastTimingCopilot();
  const monitoring = new SessionMonitoringCopilot();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorControl = new CreatorControlService(stub as any, heat, timing, monitoring);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyrano = new CyranoService(stub as any, new SessionMemoryStore(), new PersonaManager());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hub = new IntegrationHubService(stub as any, creatorControl, cyrano);
  return { hub, published };
}

function infernoSample(): FfsSample {
  return {
    session_id: 'sess-e2e',
    creator_id: 'creator-e2e',
    tippers_online: 50,
    tips_per_minute: 20,
    avg_tip_tokens: 20,
    dwell_minutes: 15,
    diamond_guests_present: 4,
    captured_at_utc: new Date('2026-04-24T22:00:00Z').toISOString(),
  };
}

function infernoFrame(): Omit<CyranoInputFrame, 'heat'> {
  return {
    session_id: 'sess-e2e',
    creator_id: 'creator-e2e',
    guest_id: 'guest-e2e',
    phase: 'PEAK',
    silence_seconds: 3,
    dwell_minutes: 15,
    guest_has_tipped: true,
    latest_guest_message: 'can we go private?',
    captured_at_utc: new Date('2026-04-24T22:00:00Z').toISOString(),
  };
}

describe('IntegrationHubService.processHighHeatSession — E2E flow', () => {
  it('returns INFERNO heat + CAT_MONETIZATION suggestion + 10% payout scaling', async () => {
    const { hub, published } = makeHub();
    const result = await hub.processHighHeatSession({
      sample: infernoSample(),
      frame: infernoFrame(),
      creator_payout_rate_per_token_usd: 0.075,
      base_wallet_id: 'wallet-creator-e2e',
    });

    expect(result.heat.tier).toBe('INFERNO');
    expect(result.suggestion?.category).toBe('CAT_MONETIZATION');
    expect(result.payout_scaling_pct).toBe(0.10);
    expect(result.scaled_payout_per_token_usd).toBeCloseTo(0.0825, 4);

    const topics = published.map((p) => p.topic);
    expect(topics).toContain(NATS_TOPICS.HUB_HIGH_HEAT_MONETIZATION);
    expect(topics).toContain(NATS_TOPICS.HUB_PAYOUT_SCALING_APPLIED);
  });

  it('three-bucket spend order is returned verbatim from governance config', async () => {
    const { hub } = makeHub();
    const result = await hub.processHighHeatSession({
      sample: infernoSample(),
      frame: infernoFrame(),
      creator_payout_rate_per_token_usd: 0.075,
      base_wallet_id: 'wallet-creator-e2e',
    });
    expect(result.spend_order).toEqual(LEDGER_SPEND_ORDER);
    expect(result.spend_order[0]).toBe('purchased');
  });

  it('COLD tier emits no monetization handoff and no payout scaling event', async () => {
    const { hub, published } = makeHub();
    const coldSample: FfsSample = {
      session_id: 'sess-e2e',
      creator_id: 'creator-e2e',
      tippers_online: 1,
      tips_per_minute: 0,
      avg_tip_tokens: 0,
      dwell_minutes: 2,
      diamond_guests_present: 0,
      captured_at_utc: new Date('2026-04-24T22:00:00Z').toISOString(),
    };
    const result = await hub.processHighHeatSession({
      sample: coldSample,
      frame: infernoFrame(),
      creator_payout_rate_per_token_usd: 0.075,
      base_wallet_id: 'wallet-creator-e2e',
    });
    expect(result.heat.tier).toBe('COLD');
    expect(result.payout_scaling_pct).toBe(0);
    const topics = published.map((p) => p.topic);
    expect(topics).not.toContain(NATS_TOPICS.HUB_HIGH_HEAT_MONETIZATION);
    expect(topics).not.toContain(NATS_TOPICS.HUB_PAYOUT_SCALING_APPLIED);
  });
});

describe('IntegrationHubService.emitDiamondConciergeHandoff', () => {
  it('emits a handoff event with canonical spend order attached', () => {
    const { hub, published } = makeHub();
    hub.emitDiamondConciergeHandoff({
      wallet_id: 'wallet-123',
      creator_id: 'creator-1',
      lapsed_tokens: 5_000,
      lapsed_usd_cents: 400_00n,
      reason_code: 'EXPIRY_LAPSED',
    });
    const event = published.find((p) => p.topic === NATS_TOPICS.HUB_DIAMOND_CONCIERGE_HANDOFF);
    expect(event).toBeDefined();
    expect(event?.payload.spend_order).toEqual(LEDGER_SPEND_ORDER);
    expect(event?.payload.lapsed_usd_cents).toBe('40000');
  });
});
