// PAYLOAD G1 — /creator/gamification page.
// Renders the prize-pool editor + per-game configuration cards (Wheel, Slots,
// Dice) + 30-day analytics row. Pure render-plan — no React, no IO.

import { presentCreatorGamificationDashboard, type GamificationPresenterInput } from '../../../view-models/gamification.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  CreatorGameCard,
  CreatorGamificationDashboard,
  PrizePoolViewModel,
} from '../../../types/gamification-contracts';

export const CREATOR_GAMIFICATION_PAGE_RULE_ID = 'CREATOR_GAMIFICATION_PAGE_v1';

export interface CreatorGamificationPageRender {
  metadata: typeof SEO.creator_gamification;
  view: CreatorGamificationDashboard;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderCreatorGamificationPage(
  inputs: GamificationPresenterInput,
): CreatorGamificationPageRender {
  const view = presentCreatorGamificationDashboard(inputs);

  const tree = el(
    'main',
    {
      test_id: 'creator-gamification-page',
      classes: ['cnz-creator-gamification', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode },
      aria: { 'aria-label': 'Gamification dashboard' },
    },
    [
      el('header', { test_id: 'creator-gamification-header', classes: ['cnz-cg__header'] }, [
        el('h1', {}, ['Gamification']),
        el('p', { classes: ['cnz-cg__subtitle'] }, [
          'Manage prize pools, configure price points, monitor win rates.',
        ]),
        el(
          'span',
          {
            test_id: 'creator-gamification-rrr-flag',
            classes: [
              view.rrr_burn_globally_enabled ? 'cnz-status--ok' : 'cnz-status--warn',
            ],
          },
          [
            view.rrr_burn_globally_enabled
              ? 'RRR burn enabled'
              : 'RRR burn disabled platform-wide',
          ],
        ),
      ]),
      renderPoolsPanel(view.pools),
      renderGameCards(view.cards),
    ],
  );

  return {
    metadata: SEO.creator_gamification,
    view,
    tree,
    rule_applied_id: CREATOR_GAMIFICATION_PAGE_RULE_ID,
  };
}

function renderPoolsPanel(pools: PrizePoolViewModel[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'creator-gamification-pools',
      classes: ['cnz-panel', 'cnz-panel--pools'],
      aria: { 'aria-label': 'Prize pools' },
    },
    [
      el('header', {}, [
        el('h2', {}, ['Prize pools']),
        el(
          'button',
          {
            test_id: 'creator-gamification-pools-create',
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: 'createPrizePool' },
          },
          ['New pool'],
        ),
      ]),
      pools.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, [
            'No pools yet. Create a shared pool to drive all three games at once.',
          ])
        : el(
            'ul',
            { classes: ['cnz-pool-list'] },
            pools.map((p) =>
              el(
                'li',
                {
                  test_id: `creator-gamification-pool-${p.pool_id}`,
                  classes: ['cnz-pool-list__item'],
                  props: {
                    pool_id: p.pool_id,
                    scoped_game_type: p.scoped_game_type,
                    version: p.version,
                  },
                },
                [
                  el('header', {}, [
                    el('strong', {}, [p.name]),
                    el('span', { classes: ['cnz-pool__scope'] }, [
                      p.scoped_game_type
                        ? `Scoped: ${p.scoped_game_type}`
                        : 'Shared (all games)',
                    ]),
                  ]),
                  el(
                    'ul',
                    { classes: ['cnz-pool__entries'] },
                    p.entries.map((e) =>
                      el(
                        'li',
                        {
                          test_id: `creator-gamification-prize-${p.pool_id}-${e.prize_slot}`,
                          classes: [
                            'cnz-pool__entry',
                            `cnz-rarity-${e.rarity.toLowerCase()}`,
                          ],
                          props: {
                            prize_slot: e.prize_slot,
                            rarity: e.rarity,
                            base_weight: e.base_weight,
                          },
                        },
                        [
                          el('strong', {}, [e.name]),
                          el('span', {}, [e.rarity]),
                          el('span', {}, [`weight ${e.base_weight}`]),
                          el('p', {}, [e.description]),
                        ],
                      ),
                    ),
                  ),
                  el('footer', {}, [
                    el(
                      'button',
                      {
                        test_id: `creator-gamification-pool-export-${p.pool_id}`,
                        classes: ['cnz-button'],
                        on: { click: 'exportPrizePool' },
                        props: { pool_id: p.pool_id },
                      },
                      ['Export JSON'],
                    ),
                    el(
                      'button',
                      {
                        test_id: `creator-gamification-pool-deactivate-${p.pool_id}`,
                        classes: ['cnz-button', 'cnz-button--danger'],
                        on: { click: 'deactivatePrizePool' },
                        props: { pool_id: p.pool_id },
                      },
                      ['Deactivate'],
                    ),
                  ]),
                ],
              ),
            ),
          ),
    ],
  );
}

function renderGameCards(cards: CreatorGameCard[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'creator-gamification-games',
      classes: ['cnz-panel', 'cnz-panel--games'],
      aria: { 'aria-label': 'Game configuration' },
    },
    [
      el('h2', {}, ['Games']),
      el(
        'div',
        { classes: ['cnz-game-card-grid'] },
        cards.map((card) =>
          el(
            'article',
            {
              test_id: `creator-gamification-card-${card.game_type}`,
              classes: [
                'cnz-game-card',
                card.enabled ? 'cnz-game-card--on' : 'cnz-game-card--off',
              ],
              props: {
                game_type: card.game_type,
                enabled: card.enabled,
                cooldown_seconds: card.cooldown_seconds,
                accepts_rrr_burn: card.accepts_rrr_burn,
              },
            },
            [
              el('header', {}, [
                el('h3', {}, [card.display_name]),
                el(
                  'button',
                  {
                    test_id: `creator-gamification-toggle-${card.game_type}`,
                    classes: ['cnz-button', card.enabled ? 'cnz-button--primary' : 'cnz-button--ghost'],
                    on: { click: 'toggleGame' },
                    props: { game_type: card.game_type, enabled: card.enabled },
                  },
                  [card.enabled ? 'Enabled' : 'Disabled'],
                ),
              ]),
              el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
                el('dt', {}, ['Token tiers']),
                el('dd', {}, [card.token_tiers.join(' / ')]),
                el('dt', {}, ['Cooldown']),
                el('dd', {}, [`${card.cooldown_seconds}s`]),
                el('dt', {}, ['RRR burn']),
                el('dd', {}, [card.accepts_rrr_burn ? 'Accepted' : 'CZT only']),
                el('dt', {}, ['Pool']),
                el('dd', {}, [card.active_pool_name ?? '— none —']),
                el('dt', {}, ['Plays (30d)']),
                el('dd', {}, [String(card.stat_30d.plays)]),
                el('dt', {}, ['CZT revenue (30d)']),
                el('dd', {}, [String(card.stat_30d.czt_revenue)]),
                el('dt', {}, ['Win rate (30d)']),
                el('dd', {}, [`${card.stat_30d.win_rate_pct}%`]),
              ]),
              el(
                'button',
                {
                  test_id: `creator-gamification-edit-${card.game_type}`,
                  classes: ['cnz-button'],
                  on: { click: 'editGameConfig' },
                  props: { game_type: card.game_type },
                },
                ['Edit price points'],
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
