// PAYLOAD M — /rewards Rewards Dashboard page.
// Points balance, earning history, burn shop, cross-portal progress.
// Pure render-plan — no React, no IO.

import {
  presentRewardsDashboard,
  buildEarningRuleCards,
  type RewardsDashboardPresenterInput,
} from '../../../view-models/rewards.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  RewardsDashboardView,
  RrrPointsEntryViewModel,
  BurnShopItem,
  ActiveGrantViewModel,
} from '../../../types/rewards-contracts';

export const REWARDS_PAGE_RULE_ID = 'REWARDS_DASHBOARD_PAGE_v1';

export interface RewardsDashboardPageRender {
  metadata: typeof SEO.rewards_dashboard;
  view: RewardsDashboardView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderRewardsDashboardPage(
  inputs: RewardsDashboardPresenterInput,
): RewardsDashboardPageRender {
  const view = presentRewardsDashboard(inputs);

  const tree = el(
    'main',
    {
      test_id: 'rewards-dashboard-page',
      classes: ['cnz-rewards', 'cnz-theme-dark'],
      aria: { 'aria-label': 'Rewards Dashboard' },
      props: { mode: THEME.default_mode },
    },
    [
      el('header', { test_id: 'rewards-header', classes: ['cnz-rewards__header'] }, [
        el('h1', {}, ['🏆 Red Room Rewards']),
        el('p', { classes: ['cnz-rewards__subtitle'] }, [
          'Earn points for every action — spend them in the burn shop for exclusive rewards.',
        ]),
        el(
          'div',
          {
            test_id: 'rewards-balance',
            classes: ['cnz-rewards__balance'],
            aria: { 'aria-label': `Points balance: ${view.balance}` },
          },
          [
            el('span', { classes: ['cnz-rewards__balance-label'] }, ['Your Points']),
            el('strong', { classes: ['cnz-rewards__balance-value'] }, [
              view.balance.toLocaleString('en-US'),
            ]),
          ],
        ),
      ]),

      renderEarningRulesPanel(),
      renderHistoryPanel(view.history),
      renderBurnShopPanel(view.burn_shop, view.balance),
      renderActiveGrantsPanel(view.active_grants),

      view.cross_portal_enabled
        ? el(
            'section',
            {
              test_id: 'rewards-cross-portal',
              classes: ['cnz-panel', 'cnz-panel--cross-portal'],
              aria: { 'aria-label': 'Cross-portal progress' },
            },
            [
              el('h2', {}, ['Cross-Portal Progress']),
              el('p', {}, [
                'Points earned across all Cyrano portals contribute to your total balance.',
              ]),
            ],
          )
        : null,
    ],
  );

  return {
    metadata: SEO.rewards_dashboard,
    view,
    tree,
    rule_applied_id: REWARDS_PAGE_RULE_ID,
  };
}

function renderEarningRulesPanel(): RenderElement {
  const rules = buildEarningRuleCards();
  return el(
    'section',
    {
      test_id: 'rewards-earning-rules',
      classes: ['cnz-panel', 'cnz-panel--earning-rules'],
      aria: { 'aria-label': 'Earning rules' },
    },
    [
      el('h2', {}, ['How to Earn']),
      el(
        'ul',
        { classes: ['cnz-earning-rule-list'] },
        rules.map((r) =>
          el(
            'li',
            {
              test_id: `rewards-rule-${r.action}`,
              classes: ['cnz-earning-rule-item'],
              props: { action: r.action, points: r.points },
            },
            [
              el('span', { classes: ['cnz-earning-rule__label'] }, [r.label]),
              el('strong', { classes: ['cnz-earning-rule__points'] }, [
                `+${r.points} pts`,
              ]),
            ],
          ),
        ),
      ),
    ],
  );
}

function renderHistoryPanel(history: RrrPointsEntryViewModel[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'rewards-history',
      classes: ['cnz-panel', 'cnz-panel--history'],
      aria: { 'aria-label': 'Points history' },
    },
    [
      el('h2', {}, ['Points History']),
      history.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, [
            'No points earned yet. Start chatting to earn your first points!',
          ])
        : el(
            'ul',
            { classes: ['cnz-history-list'] },
            history.map((entry) =>
              el(
                'li',
                {
                  test_id: `rewards-history-${entry.id}`,
                  classes: [
                    'cnz-history-item',
                    entry.amount > 0 ? 'cnz-history-item--credit' : 'cnz-history-item--debit',
                  ],
                  props: { action: entry.action, amount: entry.amount },
                },
                [
                  el('span', { classes: ['cnz-history-item__desc'] }, [entry.description]),
                  el('strong', { classes: ['cnz-history-item__amount'] }, [
                    entry.amount > 0 ? `+${entry.amount}` : String(entry.amount),
                  ]),
                  el('time', { props: { dateTime: entry.created_at_utc } }, [
                    entry.created_at_utc,
                  ]),
                ],
              ),
            ),
          ),
    ],
  );
}

function renderBurnShopPanel(shop: BurnShopItem[], balance: number): RenderElement {
  return el(
    'section',
    {
      test_id: 'rewards-burn-shop',
      classes: ['cnz-panel', 'cnz-panel--burn-shop'],
      aria: { 'aria-label': 'Burn shop' },
    },
    [
      el('h2', {}, ['🔥 Burn Shop']),
      el('p', { classes: ['cnz-burn-shop__intro'] }, [
        'Spend your points for exclusive perks.',
      ]),
      el(
        'ul',
        { classes: ['cnz-burn-shop-list'] },
        shop.map((item) => {
          const canAfford = balance >= item.cost_points;
          return el(
            'li',
            {
              test_id: `rewards-burn-${item.reward}`,
              classes: [
                'cnz-burn-item',
                canAfford ? 'cnz-burn-item--available' : 'cnz-burn-item--locked',
              ],
              props: {
                reward: item.reward,
                cost: item.cost_points,
                can_afford: canAfford,
              },
            },
            [
              el('header', {}, [
                el('strong', {}, [item.label]),
                el('span', { classes: ['cnz-burn-item__cost'] }, [
                  `${item.cost_points.toLocaleString('en-US')} pts`,
                ]),
              ]),
              el('p', {}, [item.description]),
              item.expires_in_days !== null
                ? el('p', { classes: ['cnz-burn-item__expiry'] }, [
                    `Expires after ${item.expires_in_days} days`,
                  ])
                : null,
              el(
                'button',
                {
                  test_id: `rewards-burn-btn-${item.reward}`,
                  classes: [
                    'cnz-button',
                    canAfford ? 'cnz-button--primary' : 'cnz-button--disabled',
                  ],
                  on: { click: 'burnPoints' },
                  props: { reward: item.reward, cost: item.cost_points, enabled: canAfford },
                },
                [canAfford ? `Redeem for ${item.cost_points} pts` : 'Not enough points'],
              ),
            ],
          );
        }),
      ),
    ],
  );
}

function renderActiveGrantsPanel(grants: ActiveGrantViewModel[]): RenderElement {
  return el(
    'section',
    {
      test_id: 'rewards-active-grants',
      classes: ['cnz-panel', 'cnz-panel--active-grants'],
      aria: { 'aria-label': 'Active rewards' },
    },
    [
      el('h2', {}, ['Active Rewards']),
      grants.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, ['No active rewards. Burn points to unlock perks!'])
        : el(
            'ul',
            { classes: ['cnz-grants-list'] },
            grants.map((g) =>
              el(
                'li',
                {
                  test_id: `rewards-grant-${g.grant_id}`,
                  classes: ['cnz-grant-item'],
                  props: { reward_type: g.reward_type, points_burned: g.points_burned },
                },
                [
                  el('strong', {}, [g.reward_type.replace(/_/g, ' ')]),
                  g.expires_at_utc
                    ? el('span', { classes: ['cnz-grant-item__expiry'] }, [
                        `Expires: ${g.expires_at_utc}`,
                      ])
                    : el('span', { classes: ['cnz-grant-item__no-expiry'] }, ['No expiry']),
                ],
              ),
            ),
          ),
    ],
  );
}
