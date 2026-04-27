// PAYLOAD 7 — /admin/recovery CS Recovery Dashboard page.

import {
  RecoveryPresenter,
  type AuditEventInput,
  type RecoveryCaseInput,
} from '../../../view-models/diamond-concierge.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type { RecoveryCommandCenterView } from '../../../types/admin-diamond-contracts';

export const RECOVERY_PAGE_RULE_ID = 'ADMIN_RECOVERY_PAGE_v1';

export interface RecoveryPageInputs {
  cases: RecoveryCaseInput[];
  audit_window: AuditEventInput[];
  now_utc?: Date;
}

export interface RecoveryPageRender {
  metadata: typeof SEO.admin_recovery;
  view: RecoveryCommandCenterView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderRecoveryPage(inputs: RecoveryPageInputs): RecoveryPageRender {
  const presenter = new RecoveryPresenter();
  const view = presenter.buildRecoveryCommandCenterView(inputs);

  const tree = el(
    'main',
    {
      test_id: 'admin-recovery-page',
      classes: ['cnz-admin', 'cnz-admin--recovery', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode },
      aria: { 'aria-label': 'Customer Service Recovery dashboard' },
    },
    [
      el('header', { classes: ['cnz-admin__header'] }, [
        el('h1', { test_id: 'admin-recovery-title' }, ['CS Recovery']),
        el('p', { classes: ['cnz-admin__subtitle'] }, [
          'Token Bridge, Three-Fifths Exit, expiration distribution, audit chain.',
        ]),
      ]),
      el(
        'section',
        {
          test_id: 'admin-recovery-stage-counts',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Open cases by stage' },
        },
        [
          el('h2', {}, ['Cases by stage']),
          el(
            'dl',
            { classes: ['cnz-stat-grid'] },
            Object.entries(view.cases_by_stage).flatMap(([stage, count]) => [
              el('dt', { test_id: `admin-recovery-stage-${stage}` }, [stage]),
              el('dd', {}, [String(count)]),
            ]),
          ),
        ],
      ),
      el(
        'section',
        {
          test_id: 'admin-recovery-open-cases',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Open recovery cases' },
        },
        [
          el('h2', {}, [`Open cases (${view.open_cases.length})`]),
          el('table', { classes: ['cnz-table'] }, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', {}, ['Case ID']),
                el('th', {}, ['User']),
                el('th', {}, ['Stage']),
                el('th', {}, ['Tokens']),
                el('th', {}, ['Original USD cents']),
                el('th', {}, ['Flags']),
                el('th', {}, ['Opened']),
              ]),
            ]),
            el(
              'tbody',
              {},
              view.open_cases.map((c) =>
                el(
                  'tr',
                  {
                    test_id: `admin-recovery-case-${c.case_id}`,
                    props: { stage: c.stage },
                  },
                  [
                    el('td', {}, [c.case_id]),
                    el('td', {}, [c.user_id]),
                    el('td', {}, [c.stage]),
                    el('td', {}, [c.remaining_balance_tokens]),
                    el('td', {}, [c.original_purchase_price_usd_cents]),
                    el('td', {}, [c.flags.join(',') || '—']),
                    el('td', {}, [c.opened_at_utc]),
                  ],
                ),
              ),
            ),
          ]),
        ],
      ),
      el(
        'section',
        {
          test_id: 'admin-recovery-audit-trail',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Recovery audit trail' },
        },
        [
          el('h2', {}, [`Audit trail (${view.audit_trail_window.length} latest events)`]),
          el(
            'ol',
            { classes: ['cnz-feed', 'cnz-feed--mono'] },
            view.audit_trail_window.map((row) =>
              el(
                'li',
                {
                  test_id: `admin-recovery-audit-${row.event_id}`,
                },
                [
                  el('span', {}, [row.sequence_number]),
                  el('span', {}, [row.event_type]),
                  el('span', {}, [row.correlation_id]),
                  el('span', {}, [row.hash_current.slice(0, 12) + '…']),
                  el('span', {}, [row.occurred_at_utc]),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  );

  return {
    metadata: SEO.admin_recovery,
    view,
    tree,
    rule_applied_id: RECOVERY_PAGE_RULE_ID,
  };
}
