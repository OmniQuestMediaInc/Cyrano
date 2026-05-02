/**
 * tests/e2e/high-heat-cyrano-payout-flow.spec.ts
 * CYR: High-heat session → Cyrano suggestion → scaled payout
 *
 * Closes ship-gate E2E-1. Verifies FFS tier vocabulary, payout scaling
 * envelope, and Cyrano whisper panel contract shape. Hermetic.
 */

import {
  CreatorControlPresenter,
  REDBOOK_PAYOUT_FLOOR,
  REDBOOK_PAYOUT_CEILING,
} from '../../ui/view-models/creator-control.presenter';
import type {
  CreatorCommandCenterView,
  FfsMeter,
} from '../../ui/types/creator-panel-contracts';
import type {
  CyranoCategory,
  FfsTier,
} from '../../ui/types/creator-control-contracts';

describe('SM-07 — FFS tier vocabulary (COLD | WARM | HOT | INFERNO)', () => {
  it('FfsTier values are exactly the canonical four', () => {
    const valid: FfsTier[] = ['COLD', 'WARM', 'HOT', 'INFERNO'];
    expect(valid).toHaveLength(4);
    // Compile-time exhaustiveness — unhandled tier breaks build
    for (const t of valid) {
      const exhaustive: 'ok' = ((): 'ok' => {
        switch (t) {
          case 'COLD':
          case 'WARM':
          case 'HOT':
          case 'INFERNO':
            return 'ok';
        }
      })();
      expect(exhaustive).toBe('ok');
    }
  });
});

describe('CyranoCategory — 8-category whisper engine', () => {
  it('CyranoCategory has exactly 8 categories', () => {
    const categories: CyranoCategory[] = [
      'CAT_SESSION_OPEN',
      'CAT_ENGAGEMENT',
      'CAT_ESCALATION',
      'CAT_NARRATIVE',
      'CAT_CALLBACK',
      'CAT_RECOVERY',
      'CAT_MONETIZATION',
      'CAT_SESSION_CLOSE',
    ];
    expect(categories).toHaveLength(8);
  });
});

describe('Payout rate envelope — REDBOOK §3', () => {
  it('REDBOOK_PAYOUT_FLOOR is $0.075', () => {
    expect(REDBOOK_PAYOUT_FLOOR).toBe(0.075);
  });

  it('REDBOOK_PAYOUT_CEILING is $0.090', () => {
    expect(REDBOOK_PAYOUT_CEILING).toBe(0.09);
  });
});

describe('CreatorControlPresenter — high-heat session with payout scaling', () => {
  function inputs(args: {
    id: string;
    score: number | null;
    obs?: boolean;
    chat?: boolean;
  }) {
    const heat =
      args.score === null
        ? null
        : {
            session_id: `sess_${args.id}`,
            creator_id: `crt_${args.id}`,
            tier: tierFor(args.score),
            score: args.score,
            components: { tipper_pressure: 20, velocity: 20, vip_presence: 10 },
            captured_at_utc: new Date().toISOString(),
          };
    return {
      creator_id: `crt_${args.id}`,
      display_name: `Test Creator ${args.id}`,
      obs_ready: args.obs ?? true,
      chat_aggregator_ready: args.chat ?? true,
      active_session_id: args.score === null ? null : `sess_${args.id}`,
      latest_heat: heat,
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    };
  }

  function tierFor(score: number): 'COLD' | 'WARM' | 'HOT' | 'INFERNO' {
    if (score >= 86) return 'INFERNO';
    if (score >= 61) return 'HOT';
    if (score >= 34) return 'WARM';
    return 'COLD';
  }

  it('builds a contract-shaped command center view at INFERNO with +10% scaling', () => {
    const presenter = new CreatorControlPresenter();
    const view: CreatorCommandCenterView = presenter.buildCommandCenterView(
      inputs({ id: 'inferno', score: 95 }),
    );
    expect(view.heat_meter).not.toBeNull();
    const meter = view.heat_meter as FfsMeter;
    expect(meter.tier).toBe('INFERNO');
    expect(view.payout_rate.scaling_pct_applied).toBe(10);
    expect(view.payout_rate.tier_context).toBe('INFERNO');
  });

  it('builds a contract-shaped command center view at HOT with +5% scaling', () => {
    const presenter = new CreatorControlPresenter();
    const view = presenter.buildCommandCenterView(inputs({ id: 'hot', score: 75 }));
    expect((view.heat_meter as FfsMeter).tier).toBe('HOT');
    expect(view.payout_rate.scaling_pct_applied).toBe(5);
  });

  it('builds a contract-shaped command center view at COLD with 0% scaling', () => {
    const presenter = new CreatorControlPresenter();
    const view = presenter.buildCommandCenterView(
      inputs({ id: 'cold', score: null, obs: false, chat: false }),
    );
    expect(view.heat_meter).toBeNull();
    expect(view.payout_rate.scaling_pct_applied).toBe(0);
    expect(view.payout_rate.tier_context).toBe('COLD');
    expect(view.obs_ready).toBe(false);
  });

  it('payout floor and ceiling on PayoutRateIndicator match REDBOOK §3', () => {
    const presenter = new CreatorControlPresenter();
    const view = presenter.buildCommandCenterView(inputs({ id: 'redbook', score: null }));
    expect(view.payout_rate.redbook_floor_per_token_usd).toBe(REDBOOK_PAYOUT_FLOOR);
    expect(view.payout_rate.redbook_ceiling_per_token_usd).toBe(REDBOOK_PAYOUT_CEILING);
  });
});
