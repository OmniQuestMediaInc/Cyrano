// PAYLOAD K — /diamond/concierge Diamond Concierge guest dashboard.
// Gated to INFERNO-tier subscribers. Shows request form + session history.
// Pure render-plan — no React, no IO.

import {
  presentDiamondConciergeDashboard,
  type DiamondConciergePresenterInput,
} from '../../../view-models/rewards.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  DiamondConciergeDashboardView,
  ConciergeSessionViewModel,
} from '../../../types/rewards-contracts';

export const DIAMOND_CONCIERGE_PAGE_RULE_ID = 'DIAMOND_CONCIERGE_PAGE_v1';

export interface DiamondConciergePageRender {
  metadata: typeof SEO.diamond_concierge;
  view: DiamondConciergeDashboardView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderDiamondConciergePage(
  inputs: DiamondConciergePresenterInput,
): DiamondConciergePageRender {
  const view = presentDiamondConciergeDashboard(inputs);

  const tree = el(
    'main',
    {
      test_id: 'diamond-concierge-page',
      classes: ['cnz-concierge', 'cnz-theme-dark'],
      aria: { 'aria-label': 'Diamond Concierge' },
      props: { mode: THEME.default_mode },
    },
    [
      el('header', { test_id: 'concierge-header', classes: ['cnz-concierge__header'] }, [
        el('h1', {}, ['✨ Your Personal Diamond Concierge']),
        el('p', {}, [
          'Request custom experiences, private events, or ultra-personalized Twins.',
        ]),
        view.tier_permitted
          ? el(
              'span',
              {
                test_id: 'concierge-tier-badge',
                classes: ['cnz-badge', 'cnz-badge--inferno'],
              },
              ['Inferno · Diamond Access'],
            )
          : el(
              'div',
              {
                test_id: 'concierge-access-denied',
                classes: ['cnz-alert', 'cnz-alert--warning'],
                aria: { role: 'alert' },
              },
              [
                'Diamond Concierge requires an active Inferno subscription. ',
                el(
                  'a',
                  { on: { click: 'upgradeSubscription' }, classes: ['cnz-link'] },
                  ['Upgrade now →'],
                ),
              ],
            ),
      ]),

      view.tier_permitted ? renderRequestForm() : null,
      renderSessionHistory(view.sessions),
    ],
  );

  return {
    metadata: SEO.diamond_concierge,
    view,
    tree,
    rule_applied_id: DIAMOND_CONCIERGE_PAGE_RULE_ID,
  };
}

function renderRequestForm(): RenderElement {
  return el(
    'section',
    {
      test_id: 'concierge-request-form',
      classes: ['cnz-panel', 'cnz-panel--concierge-form'],
      aria: { 'aria-label': 'Submit a concierge request' },
    },
    [
      el('h2', {}, ['New Request']),
      el('p', { classes: ['cnz-concierge-form__hint'] }, [
        'Describe your request in detail. Our Diamond Concierge team responds within 2 hours.',
      ]),
      el(
        'form',
        {
          test_id: 'concierge-form',
          on: { submit: 'submitConciergeRequest' },
        },
        [
          el(
            'label',
            { classes: ['cnz-form-label'] },
            [
              'Your Request',
              el('textarea', {
                test_id: 'concierge-request-textarea',
                classes: ['cnz-form-textarea'],
                props: { name: 'request', maxLength: 2000, rows: 6, required: true },
                aria: { 'aria-label': 'Concierge request text' },
              }),
            ],
          ),
          el(
            'button',
            {
              test_id: 'concierge-submit-btn',
              classes: ['cnz-button', 'cnz-button--primary', 'cnz-button--xl'],
              on: { click: 'submitConciergeRequest' },
              props: { type: 'submit' },
            },
            ['Submit Request'],
          ),
        ],
      ),
    ],
  );
}

function renderSessionHistory(sessions: ConciergeSessionViewModel[]): RenderElement {
  const statusClass: Record<string, string> = {
    pending:     'cnz-status--pending',
    in_progress: 'cnz-status--active',
    completed:   'cnz-status--ok',
    cancelled:   'cnz-status--warn',
  };

  return el(
    'section',
    {
      test_id: 'concierge-session-history',
      classes: ['cnz-panel', 'cnz-panel--session-history'],
      aria: { 'aria-label': 'Request history' },
    },
    [
      el('h2', {}, ['Your Requests']),
      sessions.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, [
            'No requests yet. Use the form above to submit your first concierge request.',
          ])
        : el(
            'ul',
            { classes: ['cnz-session-list'] },
            sessions.map((s) =>
              el(
                'li',
                {
                  test_id: `concierge-session-${s.id}`,
                  classes: ['cnz-session-item'],
                  props: { session_id: s.id, status: s.status, priority: s.priority },
                },
                [
                  el('p', { classes: ['cnz-session-item__summary'] }, [s.request_summary]),
                  el(
                    'span',
                    {
                      classes: ['cnz-session-item__status', statusClass[s.status] ?? ''],
                    },
                    [s.status.replace(/_/g, ' ')],
                  ),
                  el('time', { props: { dateTime: s.created_at_utc } }, [s.created_at_utc]),
                ],
              ),
            ),
          ),
    ],
  );
}
