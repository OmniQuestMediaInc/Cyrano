// Screen 04 — /vip/session/topup  Session Top-Up & Recovery page.
// Role: VIP Member.
// Purpose: Handle expired Cyrano sessions with seamless top-up.
//
// State machine: granted → minutes-decrementing → expired → top-up-purchased → resumed
//
// Layout:
//   • Session expired banner (when state = expired)
//   • Remaining minutes indicator
//   • Recommended top-up SKUs (time + voice + narrative)
//   • Three-bucket wallet selector
//   • [Purchase & Resume] → GateGuard
//
// Real-time:
//   NATS session expiry push (state driven in; this page renders the result)
//   Post-purchase auto-resume with context restore (context_restorable flag)
//
// Follows the render-plan convention: no JSX, no React runtime.

import { SEO } from '../../../../config/seo';
import { THEME } from '../../../../config/theme';
import { el, RenderElement } from '../../../../components/render-plan';
import type {
  SessionTopUpPageInputs,
  SessionTopUpPageView,
  TopUpSku,
  TopUpWalletBucketRow,
} from '../../../../types/session-topup-contracts';

export const SESSION_TOP_UP_PAGE_RULE_ID = 'SESSION_TOP_UP_PAGE_v1';

export interface SessionTopUpPageRender {
  metadata: typeof SEO.session_topup;
  view: SessionTopUpPageView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderSessionTopUpPage(
  inputs: SessionTopUpPageInputs,
): SessionTopUpPageRender {
  const is_expired =
    inputs.session_state === 'expired' || inputs.remaining_minutes === 0;
  const can_resume =
    inputs.selected_sku_id !== null && inputs.selected_bucket !== null;
  const context_restorable = inputs.context_snapshot !== null;

  const view: SessionTopUpPageView = {
    vip_id: inputs.vip_id,
    session_id: inputs.session_id,
    session_state: inputs.session_state,
    remaining_minutes: inputs.remaining_minutes,
    is_expired,
    can_resume,
    recommended_skus: inputs.recommended_skus,
    wallet_buckets: inputs.wallet_buckets,
    selected_sku_id: inputs.selected_sku_id,
    selected_bucket: inputs.selected_bucket,
    context_restorable,
  };

  const tree = el(
    'main',
    {
      test_id: 'session-topup-page',
      classes: ['cnz-session-topup', 'cnz-theme-dark'],
      props: {
        mode: THEME.default_mode,
        session_state: inputs.session_state,
        vip_id: inputs.vip_id,
        session_id: inputs.session_id,
      },
      aria: { 'aria-label': 'Cyrano Session Top-Up & Recovery' },
    },
    [
      is_expired ? renderExpiredBanner(inputs.session_id) : renderMinutesIndicator(inputs.remaining_minutes),
      renderSkuList(inputs.recommended_skus, inputs.selected_sku_id),
      renderWalletSelector(inputs.wallet_buckets, inputs.selected_bucket),
      renderPurchaseAction(can_resume, context_restorable, inputs.selected_sku_id, inputs.selected_bucket),
    ],
  );

  return {
    metadata: SEO.session_topup,
    view,
    tree,
    rule_applied_id: SESSION_TOP_UP_PAGE_RULE_ID,
  };
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderExpiredBanner(sessionId: string): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-expired-banner',
      classes: ['cnz-banner', 'cnz-banner--expired'],
      aria: { role: 'alert', 'aria-live': 'assertive' },
      props: { session_id: sessionId },
    },
    [
      el('strong', {}, ['Session expired']),
      el('p', {}, ['Your Cyrano session has ended. Top up to continue.']),
      el(
        'dl',
        { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] },
        [
          el('dt', {}, ['Remaining minutes']),
          el('dd', { test_id: 'session-topup-remaining-minutes' }, ['0']),
        ],
      ),
    ],
  );
}

function renderMinutesIndicator(remaining: number): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-minutes-indicator',
      classes: ['cnz-panel', 'cnz-panel--minutes'],
      aria: { 'aria-label': 'Session minutes remaining' },
    },
    [
      el('h2', {}, ['Session time']),
      el(
        'strong',
        { test_id: 'session-topup-remaining-minutes', classes: ['cnz-minutes-display'] },
        [`${remaining} min remaining`],
      ),
    ],
  );
}

function renderSkuList(skus: TopUpSku[], selectedSkuId: string | null): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-sku-list',
      classes: ['cnz-panel', 'cnz-panel--sku-list'],
      aria: { 'aria-label': 'Recommended top-up options' },
    },
    [
      el('h2', {}, ['Recommended top-ups']),
      skus.length === 0
        ? el('p', { classes: ['cnz-panel--empty'] }, ['No top-up options available.'])
        : el(
            'ul',
            { classes: ['cnz-sku-list'] },
            skus.map((sku) => renderSkuCard(sku, selectedSkuId)),
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
      classes: [
        'cnz-sku-card',
        `cnz-sku-card--${sku.sku_type}`,
        isSelected ? 'cnz-sku-card--selected' : '',
        sku.is_recommended ? 'cnz-sku-card--recommended' : '',
      ],
      props: {
        sku_id: sku.sku_id,
        sku_type: sku.sku_type,
        selected: isSelected,
        is_recommended: sku.is_recommended,
      },
    },
    [
      sku.is_recommended
        ? el('span', { classes: ['cnz-sku-card__badge'] }, ['Recommended'])
        : null,
      el('header', {}, [
        el('strong', { test_id: `session-topup-sku-label-${sku.sku_id}` }, [sku.label]),
        el('span', { classes: ['cnz-sku-card__type'] }, [sku.sku_type]),
      ]),
      el('p', {}, [sku.description]),
      el('dl', { classes: ['cnz-stat-grid', 'cnz-stat-grid--inline'] }, [
        el('dt', {}, ['Minutes granted']),
        el('dd', { test_id: `session-topup-sku-minutes-${sku.sku_id}` }, [
          String(sku.minutes_granted),
        ]),
        el('dt', {}, ['Price']),
        el('dd', { test_id: `session-topup-sku-price-${sku.sku_id}` }, [
          `${sku.price_czt} CZT`,
        ]),
      ]),
      el(
        'button',
        {
          test_id: `session-topup-sku-select-${sku.sku_id}`,
          classes: [
            'cnz-button',
            isSelected ? 'cnz-button--primary' : 'cnz-button--ghost',
          ],
          on: { click: 'selectTopUpSku' },
          props: { sku_id: sku.sku_id },
        },
        [isSelected ? 'Selected' : 'Select'],
      ),
    ],
  );
}

function renderWalletSelector(
  buckets: TopUpWalletBucketRow[],
  selectedBucket: TopUpWalletBucketRow['bucket'] | null,
): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-wallet-selector',
      classes: ['cnz-panel', 'cnz-panel--wallet-selector'],
      aria: { 'aria-label': 'Payment wallet selector' },
    },
    [
      el('h2', {}, ['Pay from']),
      el(
        'ul',
        { classes: ['cnz-wallet-bucket-list'] },
        buckets.map((bucket) => renderWalletBucketRow(bucket, selectedBucket)),
      ),
    ],
  );
}

function renderWalletBucketRow(
  bucket: TopUpWalletBucketRow,
  selectedBucket: TopUpWalletBucketRow['bucket'] | null,
): RenderElement {
  const isSelected = bucket.bucket === selectedBucket;
  return el(
    'li',
    {
      test_id: `session-topup-bucket-${bucket.bucket}`,
      classes: [
        'cnz-wallet-bucket',
        isSelected ? 'cnz-wallet-bucket--selected' : '',
        bucket.will_drain_next ? 'cnz-wallet-bucket--drain-next' : '',
      ],
      props: {
        bucket: bucket.bucket,
        selected: isSelected,
        spend_priority: bucket.spend_priority,
      },
    },
    [
      el(
        'button',
        {
          test_id: `session-topup-bucket-select-${bucket.bucket}`,
          classes: ['cnz-button', isSelected ? 'cnz-button--primary' : 'cnz-button--ghost'],
          on: { click: 'selectWalletBucket' },
          props: { bucket: bucket.bucket },
        },
        [bucket.label],
      ),
      el('span', { classes: ['cnz-wallet-bucket__balance'] }, [
        `${bucket.balance_tokens} CZT`,
      ]),
      bucket.will_drain_next
        ? el('span', { classes: ['cnz-wallet-bucket__drain-badge'] }, ['Drains first'])
        : null,
    ],
  );
}

function renderPurchaseAction(
  canResume: boolean,
  contextRestorable: boolean,
  selectedSkuId: string | null,
  selectedBucket: TopUpWalletBucketRow['bucket'] | null,
): RenderElement {
  return el(
    'section',
    {
      test_id: 'session-topup-purchase-action',
      classes: ['cnz-panel', 'cnz-panel--purchase-action'],
      aria: { 'aria-label': 'Purchase and resume' },
    },
    [
      contextRestorable
        ? el('p', { classes: ['cnz-notice', 'cnz-notice--context'] }, [
            'Your conversation context will be restored after purchase.',
          ])
        : null,
      el(
        'button',
        {
          test_id: 'session-topup-purchase-resume',
          classes: [
            'cnz-button',
            'cnz-button--xl',
            canResume ? 'cnz-button--primary' : 'cnz-button--disabled',
          ],
          on: { click: 'purchaseAndResume' },
          props: {
            disabled: !canResume,
            selected_sku_id: selectedSkuId,
            selected_bucket: selectedBucket,
          },
        },
        ['Purchase & Resume'],
      ),
      !canResume
        ? el('p', { classes: ['cnz-notice', 'cnz-notice--hint'] }, [
            'Select a top-up option and payment bucket to continue.',
          ])
        : null,
    ],
  );
}
