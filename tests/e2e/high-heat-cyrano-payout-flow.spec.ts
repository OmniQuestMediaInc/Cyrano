// PAYLOAD 8 — End-to-end test: high-heat session → Cyrano → scaled payout.
//
// Verifies the integration-hub composition: telemetry sample produces a
// INFERNO heat score, Cyrano emits a CAT_MONETIZATION suggestion at peak
// weight, and the Integration Hub computes the +10% payout scaling per
// PAYOUT_SCALING_PCT_BY_TIER.

import { IntegrationHubService } from '../../services/integration-hub/src/hub.service';
import { CreatorControlService } from '../../services/creator-control/src/creator-control.service';
import { CyranoService } from '../../services/cyrano/src/cyrano.service';
import { BroadcastTimingCopilot } from '../../services/creator-control/src/broadcast-timing.copilot';
import { SessionMonitoringCopilot } from '../../services/creator-control/src/session-monitoring.copilot';
import { FlickerNFlameScoringEngine } from '../../services/creator-control/src/ffs.engine';
import { PersonaManager } from '../../services/cyrano/src/persona.manager';
import { SessionMemoryStore } from '../../services/cyrano/src/session-memory.store';
import { CreatorControlPresenter } from '../../ui/view-models/creator-control.presenter';
import { NATS_TOPICS } from '../../services/nats/topics.registry';
import type { FfsSample } from '../../services/creator-control/src/ffs.engine';
import type { CyranoInputFrame } from '../../services/cyrano/src/cyrano.types';

type Published = { topic: string; payload: Record<string, unknown> };

function buildHub(): { hub: IntegrationHubService; published: Published[] } {
  const published: Published[] = [];
  const stub = {
    publish: jest.fn((topic: string, payload: Record<string, unknown>) =>
      published.push({ topic, payload }),
    ),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heat = new FlickerNFlameScoringEngine(stub as any);
  const timing = new BroadcastTimingCopilot();
  const monitoring = new SessionMonitoringCopilot();
  const creatorControl = new CreatorControlService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stub as any,
    heat,
    timing,
    monitoring,
  );
  const cyrano = new CyranoService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stub as any,
    new SessionMemoryStore(),
    new PersonaManager(),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hub = new IntegrationHubService(stub as any, creatorControl, cyrano);
  return { hub, published };
}

const infernoSample: FfsSample = {
  session_id: 'sess-payload8',
  creator_id: 'creator-payload8',
  tippers_online: 60,
  tips_per_minute: 25,
  avg_tip_tokens: 30,
  dwell_minutes: 22,
  diamond_guests_present: 3,
  captured_at_utc: '2026-04-25T20:00:00Z',
};

const infernoFrame: Omit<CyranoInputFrame, 'heat'> = {
  session_id: 'sess-payload8',
  creator_id: 'creator-payload8',
  guest_id: 'guest-payload8',
  phase: 'PEAK',
  silence_seconds: 1,
  dwell_minutes: 22,
  guest_has_tipped: true,
  latest_guest_message: 'private show?',
  captured_at_utc: '2026-04-25T20:00:00Z',
};

describe('PAYLOAD 8 — high-heat E2E flow', () => {
  it('produces INFERNO heat → CAT_MONETIZATION → +10% payout scaling', async () => {
    const { hub, published } = buildHub();
    const result = await hub.processHighHeatSession({
      sample: infernoSample,
      frame: infernoFrame,
      creator_payout_rate_per_token_usd: 0.075,
      base_wallet_id: 'wallet-payload8',
    });

    expect(result.heat.tier).toBe('INFERNO');
    expect(result.payout_scaling_pct).toBeCloseTo(0.1, 5);
    expect(result.scaled_payout_per_token_usd).toBeCloseTo(0.075 * 1.1, 5);
    expect(result.suggestion?.category).toBe('CAT_MONETIZATION');

    const monetizationEmits = published.filter(
      (p) => p.topic === NATS_TOPICS.HUB_HIGH_HEAT_MONETIZATION,
    );
    expect(monetizationEmits.length).toBeGreaterThanOrEqual(1);
  });

  it('feeds the CreatorControl presenter with a INFERNO view-model', async () => {
    const presenter = new CreatorControlPresenter();
    const view = presenter.buildCommandCenterView({
      creator_id: 'creator-payload8',
      display_name: 'Payload8 Creator',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess-payload8',
      latest_heat: {
        session_id: 'sess-payload8',
        creator_id: 'creator-payload8',
        tier: 'INFERNO',
        score: 92,
        components: {
          tipper_pressure: 38,
          velocity: 38,
          vip_presence: 16,
        },
        captured_at_utc: '2026-04-25T20:00:00Z',
      },
      latest_nudge: {
        session_id: 'sess-payload8',
        creator_id: 'creator-payload8',
        direction: 'RAISE',
        magnitude_pct: 0.15,
        tier: 'INFERNO',
        ffs_score: 92,
        reason_code: 'INFERNO_RAISE',
        copy: 'Heat is at peak — push private show offer.',
        captured_at_utc: '2026-04-25T20:00:00Z',
      },
      broadcast_windows: [],
      cyrano_suggestions: [
        {
          suggestion_id: 'sg-1',
          session_id: 'sess-payload8',
          category: 'CAT_MONETIZATION',
          weight: 95,
          tier_context: 'INFERNO',
          copy: 'Offer the private show now.',
          reason_codes: ['CAT_MONETIZATION', 'TIER_INFERNO'],
          emitted_at_utc: '2026-04-25T20:00:01Z',
          latency_ms: 120,
        },
      ],
      cyrano_personas: [
        {
          persona_id: 'p-1',
          display_name: 'Default',
          tone: 'playful',
          style_notes: 'baseline',
          active: true,
        },
      ],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });

    expect(view.payout_rate.scaling_pct_applied).toBe(10);
    expect(view.payout_rate.current_rate_per_token_usd).toBeGreaterThan(0.08);
    expect(view.cyrano_panel.suggestions[0]?.category).toBe('CAT_MONETIZATION');
    expect(view.heat_meter?.tier).toBe('INFERNO');
  });
});
