// Screen 04 — /diamond/session-topup — Cyrano™ Session Top-Up & Recovery.
// Role: VIP Member.
// Purpose: Handle expired Cyrano sessions with seamless top-up and auto-resume.
//
// State machine:
//   granted → minutes-decrementing → expired → top-up purchased → resumed
//
// Layout:
//   • Session expired banner (visible when lifecycle_state === 'EXPIRED')
//   • Remaining minutes: 0
//   • Recommended top-up SKUs (time + voice + narrative)
//   • Three-bucket wallet selector
//   • [Purchase & Resume] → GateGuard
//
// Real-time:
//   • NATS session expiry push drives lifecycle_state updates.
//   • Post-purchase auto-resume with context restore.
//
// Pure render-plan — no JSX, no React runtime, structurally testable.

import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type {
  SessionTopUpView,
  SessionLifecycleState,
  TopUpSku,
  TopUpWalletBucketRow,
} from '../../../types/cyrano-persona-contracts';

export const SESSION_TOPUP_PAGE_RULE_ID = 'CYRANO_SESSION_TOPUP_PAGE_v1';

export interface SessionTopUpPageInputs {
  session_id: string;
  vip_id: string;
  lifecycle_state: SessionLifecycleState;
  remaining_minutes: number;
  recommended_skus: TopUpSku[];
  wallet_buckets: TopUpWalletBucketRow[];
  selected_sku_id: string | null;
  selected_bucket: import('../../../types/public-wallet-contracts').WalletBucket | null;
}

export interface SessionTopUpPageRender {
  metadata: typeof SEO.cyrano_session_topup;
  view: SessionTopUpView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderSessionTopUpPage(
  inputs: SessionTopUpPageInputs,
): SessionTopUpPageRender {
  const selectedSku = inputs.recommended_skus.find(
    (s) => s.sku_id === inputs.selected_sku_id,
  ) ?? null;

  const selectedBucketRow = inputs.selected_bucket
    ? inputs.wallet_buckets.find((b) => b.bucket === inputs.selected_bucket) ?? null
    : null;

  const can_purchase =
    selectedSku !== null &&
    selectedBucketRow !== null &&
    selectedBucketRow.balance_tokens >= selectedSku.price_tokens;

  const view: SessionTopUpView = {
    session_id: inputs.session_id,
    vip_id: inputs.vip_id,
    lifecycle_state: inputs.lifecycle_state,
    remaining_minutes: inputs.remaining_minutes,
    recommended_skus: inputs.recommended_skus,
    wallet_buckets: inputs.wallet_buckets,
    selected_sku_id: inputs.selected_sku_id,
    selected_bucket: inputs.selected_bucket,
    can_purchase,
    generated_at_utc: new Date().toISOString(),
    rule_applied_id: SESSION_TOPUP_PAGE_RULE_ID,
  };

  const tree = el(
    'main',
    {
      test_id: 'session-topup-page',
      classes: ['cnz-session-topup', 'cnz-theme-dark'],
      props: {
        mode: THEME.default_mode,
        session_id: inputs.session_id,
        lifecycle_state: inputs.lifecycle_state,
      },
      aria: { 'aria-label': 'Cyrano™ session top-up' },
    },
    [
      renderLifecycleBanner(view.lifecycle_state),
      renderSessionStatus(view),
      renderSkuRecommendations(view),
      renderWalletSelector(view),
      renderPurchaseButton(view),
    ],
  );

  return {
    metadata: SEO.cyrano_session_topup,
    view,
    tree,
    rule_applied_id: SESSION_TOPUP_PAGE_RULE_ID,
  };
}

const LIFECYCLE_BANNER_COPY: Partial<Record<SessionLifecycleState, string>> = {
  EXPIRED: 'Your Cyrano™ session has expired. Top up to pick up right where you left off.',
  TOP_UP_PURCHASED: 'Purchase confirmed — resuming your session…',
  RESUMED: 'Session resumed. Cyrano™ is back and has full context of your conversation.',
};

function renderLifecycleBanner(state: SessionLifecycleState): RenderElement {
  const copy = LIFECYCLE_BANNER_COPY[state];
  if (!copy) {
    return el('div', { test_id: 'session-topup-banner-idle', classes: ['cnz-banner--hidden'] });
  }

  const bannerClass =
    state === 'EXPIRED'
      ? 'cnz-banner--warn'
      : state === 'RESUMED'
        ? 'cnz-banner--success'
        : 'cnz-banner--info';

  return el(
    'div',
    {
      test_id: 'session-topup-banner',
      classes: ['cnz-banner', bannerClass],
      aria: { role: 'status', 'aria-live': 'polite' },
      props: { lifecycle_state: state },
    },
    [
      el('strong', { classes: ['cnz-banner__icon'] }, [state === 'EXPIRED' ? '⏰' : '✓']),
      el('span', { test_id: 'session-topup-banner-copy' }, [copy]),
    ],
  );
}

function renderSessionStatus(view: SessionTopUpView): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-status',
      classes: ['cnz-panel', 'cnz-panel--session-status'],
      aria: { 'aria-label': 'Session status' },
    },
    [
      el('h2', {}, ['Session status']),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Session ID']),
        el('dd', { test_id: 'session-topup-session-id' }, [view.session_id]),
        el('dt', {}, ['State']),
        el(
          'dd',
          {
            test_id: 'session-topup-state',
            classes: [`cnz-lifecycle--${view.lifecycle_state.toLowerCase()}`],
          },
          [view.lifecycle_state],
        ),
        el('dt', {}, ['Remaining minutes']),
        el(
          'dd',
          {
            test_id: 'session-topup-remaining-minutes',
            classes: [view.remaining_minutes === 0 ? 'cnz-stat--danger' : ''],
          },
          [String(view.remaining_minutes)],
        ),
      ]),
    ],
  );
}

function renderSkuRecommendations(view: SessionTopUpView): RenderElement {
  if (view.recommended_skus.length === 0) {
    return el(
      'section',
      {
        test_id: 'session-topup-skus-empty',
        classes: ['cnz-panel', 'cnz-panel--empty'],
      },
      [el('p', {}, ['No top-up packages available at this time.'])],
    );
  }

  return el(
    'section',
    {
      test_id: 'session-topup-skus',
      classes: ['cnz-panel', 'cnz-panel--skus'],
      aria: { 'aria-label': 'Recommended top-up packages' },
    },
    [
      el('h2', {}, ['Recommended top-ups']),
      el(
        'ul',
        { classes: ['cnz-sku-list'] },
        view.recommended_skus.map((sku) => renderSkuCard(sku, view.selected_sku_id)),
      ),
    ],
  );
}

function renderSkuCard(sku: TopUpSku, selectedSkuId: string | null): RenderElement {
  const isSelected = sku.sku_id === selectedSkuId;
  return el(
    'li',
    {
      test_id: `session-topup-sku-${sku.sku_id}`,
      classes: ['cnz-sku-card', isSelected ? 'cnz-sku-card--selected' : ''],
      props: {
        sku_id: sku.sku_id,
        sku_type: sku.sku_type,
        selected: isSelected,
      },
    },
    [
      el('header', { classes: ['cnz-sku-card__header'] }, [
        el('strong', { test_id: `session-topup-sku-label-${sku.sku_id}` }, [sku.label]),
        el(
          'span',
          { classes: ['cnz-badge', `cnz-badge--sku-${sku.sku_type.toLowerCase()}`] },
          [sku.sku_type],
        ),
      ]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Minutes']),
        el('dd', { test_id: `session-topup-sku-minutes-${sku.sku_id}` }, [
          String(sku.minutes_granted),
        ]),
        el('dt', {}, ['Cost']),
        el('dd', { test_id: `session-topup-sku-price-${sku.sku_id}` }, [
          `${sku.price_tokens} CZT ($${sku.price_usd.toFixed(2)})`,
        ]),
      ]),
      el(
        'button',
        {
          test_id: `session-topup-sku-select-${sku.sku_id}`,
          classes: [
            'cnz-button',
            isSelected ? 'cnz-button--secondary' : 'cnz-button--primary',
          ],
          on: { click: 'selectSku' },
          props: { sku_id: sku.sku_id, disabled: isSelected },
          aria: { 'aria-pressed': String(isSelected) },
        },
        [isSelected ? 'Selected' : 'Select'],
      ),
    ],
  );
}

function renderWalletSelector(view: SessionTopUpView): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-wallet',
      classes: ['cnz-panel', 'cnz-panel--wallet-selector'],
      aria: { 'aria-label': 'Wallet — three-bucket spend selector' },
    },
    [
      el('h2', {}, ['Pay from wallet']),
      el('p', { classes: ['cnz-help-text'] }, [
        'Tokens are spent in the order shown (purchased → membership → bonus).',
      ]),
      el(
        'ul',
        { classes: ['cnz-bucket-list'] },
        view.wallet_buckets.map((bucket) =>
          renderWalletBucketRow(bucket, view.selected_bucket),
        ),
      ),
    ],
  );
}

function renderWalletBucketRow(
  bucket: TopUpWalletBucketRow,
  selectedBucket: import('../../../types/public-wallet-contracts').WalletBucket | null,
): RenderElement {
  const isSelected = bucket.bucket === selectedBucket;
  return el(
    'li',
    {
      test_id: `session-topup-bucket-${bucket.bucket}`,
      classes: [
        'cnz-bucket-row',
        isSelected ? 'cnz-bucket-row--selected' : '',
        !bucket.sufficient ? 'cnz-bucket-row--insufficient' : '',
      ],
      props: {
        bucket: bucket.bucket,
        spend_priority: bucket.spend_priority,
        selected: isSelected,
        sufficient: bucket.sufficient,
      },
    },
    [
      el('header', { classes: ['cnz-bucket-row__header'] }, [
        el('strong', {}, [`${bucket.spend_priority}. ${bucket.label}`]),
        el(
          'span',
          {
            test_id: `session-topup-bucket-balance-${bucket.bucket}`,
            classes: [bucket.sufficient ? '' : 'cnz-stat--muted'],
          },
          [`${bucket.balance_tokens} CZT`],
        ),
      ]),
      ...(!bucket.sufficient
        ? [
            el('span', { classes: ['cnz-help-text', 'cnz-help-text--warn'] }, [
              'Insufficient balance for selected package.',
            ]),
          ]
        : []),
      el(
        'button',
        {
          test_id: `session-topup-bucket-select-${bucket.bucket}`,
          classes: [
            'cnz-button',
            isSelected ? 'cnz-button--secondary' : 'cnz-button--ghost',
          ],
          on: { click: 'selectBucket' },
          props: { bucket: bucket.bucket, disabled: !bucket.sufficient || isSelected },
          aria: { 'aria-pressed': String(isSelected) },
        },
        [isSelected ? 'Selected' : 'Use this bucket'],
      ),
    ],
  );
}

function renderPurchaseButton(view: SessionTopUpView): RenderElement {
  return el(
    'div',
    {
      test_id: 'session-topup-purchase-row',
      classes: ['cnz-cta-row', 'cnz-cta-row--sticky'],
    },
    [
      el(
        'button',
        {
          test_id: 'session-topup-purchase-btn',
          classes: [
            'cnz-button',
            'cnz-button--primary',
            'cnz-button--large',
            !view.can_purchase ? 'cnz-button--disabled' : '',
          ],
          on: { click: 'purchaseAndResume' },
          props: {
            disabled: !view.can_purchase,
            sku_id: view.selected_sku_id,
            bucket: view.selected_bucket,
            gateguard_action: 'SESSION_TOPUP',
          },
          aria: { 'aria-disabled': String(!view.can_purchase) },
        },
        ['Purchase & Resume →'],
      ),
      el(
        'p',
        {
          test_id: 'session-topup-gateguard-note',
          classes: ['cnz-help-text'],
        },
        ['Purchase is processed through GateGuard™. Your session context will be fully restored.'],
      ),
    ],
  );
}
