// RBAC-STUDIO-001 — /creator/studio dashboard page (read-only).
// Renders the Studio summary, roster, commission view, and contract status
// counts returned by GET /studio-dashboard/:studio_id.
//
// Follows the same render-plan convention as ui/app/creator/control/page.ts:
// no JSX, no React runtime — just a structurally-testable RenderElement tree.

import { el, RenderElement } from '../../../components/render-plan';

export const STUDIO_DASHBOARD_PAGE_RULE_ID = 'STUDIO_DASHBOARD_PAGE_v1';

/** Mirrors the API response from StudioDashboardController.getDashboard(). */
export interface StudioDashboardPageInputs {
  studio: {
    id: string;
    name: string;
    affiliation_number: string;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    created_at: string;
  };
  roster: ReadonlyArray<{
    creator_id: string;
    role: 'STUDIO_OWNER' | 'STUDIO_ADMIN' | 'CREATOR';
    status: 'ACTIVE' | 'PENDING' | 'REVOKED';
    joined_at: string;
  }>;
  commission: {
    commission_rate_pct: string;
    last_updated_at: string;
  };
  contracts: {
    total: number;
    signed: number;
    pending_signature: number;
  };
}

export interface StudioDashboardPageRender {
  view: StudioDashboardPageInputs;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderStudioDashboardPage(
  inputs: StudioDashboardPageInputs,
): StudioDashboardPageRender {
  const tree = el(
    'main',
    {
      test_id: 'studio-dashboard-page',
      classes: ['cnz-studio-dashboard', 'cnz-theme-dark'],
      aria: { 'aria-label': 'Studio dashboard' },
    },
    [
      renderHeader(inputs),
      renderCommissionCard(inputs),
      renderRoster(inputs),
      renderContractsSummary(inputs),
    ],
  );

  return {
    view: inputs,
    tree,
    rule_applied_id: STUDIO_DASHBOARD_PAGE_RULE_ID,
  };
}

function renderHeader(inputs: StudioDashboardPageInputs): RenderElement {
  return el(
    'header',
    {
      test_id: 'studio-dashboard-header',
      classes: ['cnz-studio-dashboard__header'],
    },
    [
      el('h1', {}, [inputs.studio.name]),
      el(
        'span',
        {
          test_id: 'studio-dashboard-affiliation-number',
          classes: ['cnz-affiliation-chip'],
          props: { affiliation_number: inputs.studio.affiliation_number },
        },
        [`Affiliation #${inputs.studio.affiliation_number}`],
      ),
      el(
        'span',
        {
          test_id: 'studio-dashboard-status',
          classes: [`cnz-status--${inputs.studio.status.toLowerCase()}`],
        },
        [inputs.studio.status],
      ),
    ],
  );
}

function renderCommissionCard(inputs: StudioDashboardPageInputs): RenderElement {
  return el(
    'section',
    {
      test_id: 'studio-dashboard-commission',
      classes: ['cnz-panel', 'cnz-panel--commission'],
      aria: { 'aria-label': 'Commission (read-only — set by platform admin)' },
    },
    [
      el('h2', {}, ['Commission rate']),
      el(
        'strong',
        { test_id: 'studio-dashboard-commission-pct' },
        [inputs.commission.commission_rate_pct],
      ),
      el('p', {}, [
        `Last updated ${inputs.commission.last_updated_at}. Set by PLATFORM_ADMIN — not editable here.`,
      ]),
    ],
  );
}

function renderRoster(inputs: StudioDashboardPageInputs): RenderElement {
  return el(
    'section',
    {
      test_id: 'studio-dashboard-roster',
      classes: ['cnz-panel', 'cnz-panel--roster'],
      aria: { 'aria-label': 'Studio roster' },
    },
    [
      el('h2', {}, [`Roster (${inputs.roster.length})`]),
      el('table', { classes: ['cnz-table'] }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Creator']),
            el('th', {}, ['Role']),
            el('th', {}, ['Status']),
            el('th', {}, ['Joined']),
          ]),
        ]),
        el(
          'tbody',
          {},
          inputs.roster.map((r) =>
            el(
              'tr',
              {
                test_id: `studio-dashboard-roster-${r.creator_id}`,
                props: { role: r.role, status: r.status },
              },
              [
                el('td', {}, [r.creator_id]),
                el('td', {}, [r.role]),
                el('td', {}, [r.status]),
                el('td', {}, [r.joined_at]),
              ],
            ),
          ),
        ),
      ]),
    ],
  );
}

function renderContractsSummary(inputs: StudioDashboardPageInputs): RenderElement {
  return el(
    'section',
    {
      test_id: 'studio-dashboard-contracts',
      classes: ['cnz-panel', 'cnz-panel--contracts'],
      aria: { 'aria-label': 'Contract progress' },
    },
    [
      el('h2', {}, ['Contracts']),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Total']),
        el('dd', { test_id: 'studio-dashboard-contracts-total' }, [
          String(inputs.contracts.total),
        ]),
        el('dt', {}, ['Signed']),
        el('dd', { test_id: 'studio-dashboard-contracts-signed' }, [
          String(inputs.contracts.signed),
        ]),
        el('dt', {}, ['Pending signature']),
        el('dd', { test_id: 'studio-dashboard-contracts-pending' }, [
          String(inputs.contracts.pending_signature),
        ]),
      ]),
    ],
  );
}
