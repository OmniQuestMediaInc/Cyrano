// PAYLOAD 7 — /creator/control CreatorControl.Zone command center page.
// Single-pane workstation: Broadcast Timing, Session Monitoring, Cyrano panel,
// Room-Heat meter, persona switcher, payout rate indicator.

import {
  CreatorControlPresenter,
  type CreatorCommandCenterInputs,
} from '../../../view-models/creator-control.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { heatColorFor } from '../../../config/theme';
import { heatTierAriaLabel } from '../../../config/accessibility';
import { el, RenderElement } from '../../../components/render-plan';
import { renderSendGiftPanel } from '../../../components/send-gift-panel';
import type { CreatorCommandCenterView } from '../../../types/creator-panel-contracts';

export const CREATOR_CONTROL_PAGE_RULE_ID = 'CREATOR_CONTROL_PAGE_v1';

export interface CreatorControlPageRender {
  metadata: typeof SEO.creator_control;
  view: CreatorCommandCenterView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderCreatorControlPage(
  inputs: CreatorCommandCenterInputs,
): CreatorControlPageRender {
  const presenter = new CreatorControlPresenter();
  const view = presenter.buildCommandCenterView(inputs);

  const tree = el(
    'main',
    {
      test_id: 'creator-control-page',
      classes: ['cnz-creator-control', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode },
      aria: { 'aria-label': 'CreatorControl.Zone command center' },
    },
    [
      el('header', { test_id: 'creator-control-header', classes: ['cnz-cc__header'] }, [
        el('h1', {}, [view.display_name]),
        el('div', { classes: ['cnz-cc__status-strip'] }, [
          el(
            'span',
            {
              test_id: 'creator-control-obs-status',
              classes: [view.obs_ready ? 'cnz-status--ok' : 'cnz-status--warn'],
            },
            [`OBS: ${view.obs_ready ? 'connected' : 'offline'}`],
          ),
          el(
            'span',
            {
              test_id: 'creator-control-chat-status',
              classes: [view.chat_aggregator_ready ? 'cnz-status--ok' : 'cnz-status--warn'],
            },
            [`Chat aggregator: ${view.chat_aggregator_ready ? 'live' : 'offline'}`],
          ),
          renderPayoutChip(view),
        ]),
      ]),
      renderHeatMeter(view),
      renderSessionMonitoring(view),
      renderBroadcastTiming(view),
      renderCyranoPanel(view),
      renderPersonaSwitcher(view),
      renderSendGiftPanel({ creator_id: view.creator_id }).tree,
    ],
  );

  return {
    metadata: SEO.creator_control,
    view,
    tree,
    rule_applied_id: CREATOR_CONTROL_PAGE_RULE_ID,
  };
}

function renderPayoutChip(view: CreatorCommandCenterView): RenderElement {
  const p = view.payout_rate;
  return el(
    'span',
    {
      test_id: 'creator-control-payout-chip',
      classes: ['cnz-cc__payout-chip'],
      props: {
        scaling_pct: p.scaling_pct_applied,
        rate: p.current_rate_per_token_usd,
      },
    },
    [
      el('strong', {}, [`$${p.current_rate_per_token_usd.toFixed(3)}/CZT`]),
      el('span', {}, [
        p.scaling_pct_applied > 0 ? `+${p.scaling_pct_applied}% (${p.tier_context})` : 'baseline',
      ]),
    ],
  );
}

function renderHeatMeter(view: CreatorCommandCenterView): RenderElement {
  if (!view.heat_meter) {
    return el(
      'section',
      {
        test_id: 'creator-control-heat-meter',
        classes: ['cnz-panel', 'cnz-panel--heat-meter', 'cnz-panel--empty'],
        aria: { 'aria-label': 'Room-Heat meter (no live session)' },
      },
      [el('p', {}, ['No live session — heat meter idle.'])],
    );
  }
  const m = view.heat_meter;
  const color = heatColorFor(m.tier);
  return el(
    'section',
    {
      test_id: 'creator-control-heat-meter',
      classes: ['cnz-panel', 'cnz-panel--heat-meter'],
      aria: { 'aria-label': heatTierAriaLabel(m.tier, m.score) },
      style: { '--cnz-heat-color': color },
    },
    [
      el('h2', {}, ['Room heat']),
      el(
        'div',
        {
          classes: ['cnz-heat-gauge'],
          props: {
            tier: m.tier,
            score: m.score,
            tier_min: m.tier_min,
            tier_max: m.tier_max,
          },
        },
        [
          el('strong', { test_id: 'creator-control-heat-score' }, [String(m.score)]),
          el('span', { test_id: 'creator-control-heat-tier' }, [m.tier]),
        ],
      ),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Tipper pressure']),
        el('dd', {}, [String(m.components.tipper_pressure)]),
        el('dt', {}, ['Velocity']),
        el('dd', {}, [String(m.components.velocity)]),
        el('dt', {}, ['VIP presence']),
        el('dd', {}, [String(m.components.vip_presence)]),
      ]),
    ],
  );
}

function renderSessionMonitoring(view: CreatorCommandCenterView): RenderElement {
  const sm = view.session_monitoring;
  return el(
    'section',
    {
      test_id: 'creator-control-session-monitoring',
      classes: ['cnz-panel', 'cnz-panel--session-monitoring'],
      aria: { 'aria-label': 'Live Session Monitoring' },
    },
    [
      el('h2', {}, ['Live Session Monitoring']),
      sm.latest_nudge
        ? el(
            'article',
            {
              test_id: 'creator-control-nudge-card',
              classes: [
                'cnz-nudge-card',
                `cnz-nudge-card--${sm.latest_nudge.direction.toLowerCase()}`,
              ],
              props: {
                direction: sm.latest_nudge.direction,
                magnitude_pct: sm.latest_nudge.magnitude_pct,
                reason_code: sm.latest_nudge.reason_code,
              },
            },
            [
              el('header', {}, [
                el('span', {}, [sm.latest_nudge.direction]),
                el('span', {}, [`${(sm.latest_nudge.magnitude_pct * 100).toFixed(0)}%`]),
              ]),
              el('p', {}, [sm.latest_nudge.copy]),
              el('footer', {}, [sm.latest_nudge.reason_code]),
            ],
          )
        : el('p', { classes: ['cnz-panel--empty'] }, ['No nudge — latest signal too cold.']),
    ],
  );
}

function renderBroadcastTiming(view: CreatorCommandCenterView): RenderElement {
  const bt = view.broadcast_timing;
  return el(
    'section',
    {
      test_id: 'creator-control-broadcast-timing',
      classes: ['cnz-panel', 'cnz-panel--broadcast-timing'],
      aria: { 'aria-label': 'Broadcast Timing Copilot' },
    },
    [
      el('h2', {}, ['Broadcast Timing Copilot']),
      el('table', { classes: ['cnz-table'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Slot (UTC)']),
            el('th', {}, ['Confidence']),
            el('th', {}, ['Tippers']),
            el('th', {}, ['TPM']),
            el('th', {}, ['Reason']),
          ]),
        ]),
        el(
          'tbody',
          {},
          bt.windows.map((w) =>
            el(
              'tr',
              {
                test_id: `creator-control-window-${w.suggested_slot_utc}`,
                props: { reason_code: w.reason_code },
              },
              [
                el('td', {}, [w.suggested_slot_utc]),
                el('td', {}, [`${(w.confidence * 100).toFixed(0)}%`]),
                el('td', {}, [String(w.expected_tippers)]),
                el('td', {}, [w.expected_tips_per_minute.toFixed(1)]),
                el('td', {}, [w.reason_code]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

function renderCyranoPanel(view: CreatorCommandCenterView): RenderElement {
  const c = view.cyrano_panel;
  return el(
    'section',
    {
      test_id: 'creator-control-cyrano-panel',
      classes: ['cnz-panel', 'cnz-panel--cyrano'],
      aria: { 'aria-label': 'Cyrano whisper panel' },
    },
    [
      el('header', {}, [
        el('h2', {}, ['Cyrano™ whispers']),
        el('span', { classes: ['cnz-cyrano__sla'] }, [
          c.latency_last_observed_ms !== null
            ? `${c.latency_last_observed_ms}ms / SLA ${c.latency_sla_ms}ms`
            : `SLA ${c.latency_sla_ms}ms`,
        ]),
      ]),
      el(
        'ol',
        { classes: ['cnz-cyrano__feed'] },
        c.suggestions.map((s) =>
          el(
            'li',
            {
              test_id: `creator-control-cyrano-${s.suggestion_id}`,
              classes: [
                'cnz-cyrano__suggestion',
                `cnz-cyrano__suggestion--${s.tier_context.toLowerCase()}`,
              ],
              props: {
                category: s.category,
                weight: s.weight,
                tier_context: s.tier_context,
              },
            },
            [
              el('header', {}, [
                el('strong', {}, [s.category]),
                el('span', {}, [`weight ${s.weight}`]),
              ]),
              el('p', {}, [s.copy]),
              el('footer', {}, [s.reason_codes.join(', ')]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderPersonaSwitcher(view: CreatorCommandCenterView): RenderElement {
  return el(
    'section',
    {
      test_id: 'creator-control-persona-switcher',
      classes: ['cnz-panel', 'cnz-panel--persona-switcher'],
      aria: { 'aria-label': 'Cyrano persona switcher' },
    },
    [
      el('h2', {}, ['Personas']),
      el(
        'ul',
        { classes: ['cnz-persona-list'] },
        view.cyrano_panel.personas_available.map((p) =>
          el(
            'li',
            {
              test_id: `creator-control-persona-${p.persona_id}`,
              classes: [p.active ? 'cnz-persona-list__item--active' : ''],
              props: { active: p.active, persona_id: p.persona_id },
            },
            [
              el('strong', {}, [p.display_name]),
              el('span', {}, [p.tone]),
              el('p', {}, [p.style_notes]),
              el(
                'button',
                {
                  test_id: `creator-control-persona-activate-${p.persona_id}`,
                  classes: [
                    'cnz-button',
                    p.active ? 'cnz-button--disabled' : 'cnz-button--primary',
                  ],
                  on: { click: 'activatePersona' },
                  props: { persona_id: p.persona_id, disabled: p.active },
                },
                [p.active ? 'Active' : 'Activate'],
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
