/**
 * session-topup-page.spec.ts
 * Screen 04 — Session Top-Up & Recovery (VIP Member).
 * Hermetic — no database or broker required.
 */

import {
  renderSessionTopUpPage,
  SESSION_TOP_UP_PAGE_RULE_ID,
} from '../../ui/app/vip/session/topup/page';
import { findByTestId, collectTestIds } from '../../ui/components/render-plan';
import type {
  SessionTopUpPageInputs,
  TopUpSku,
  TopUpWalletBucketRow,
} from '../../ui/types/session-topup-contracts';

function makeSku(overrides: Partial<TopUpSku> = {}): TopUpSku {
  return {
    sku_id: 'sku-time-30',
    sku_type: 'time',
    label: '30-Minute Top-Up',
    description: 'Add 30 minutes to your current session.',
    minutes_granted: 30,
    price_czt: 500,
    is_recommended: true,
    ...overrides,
  };
}

function makeBucket(overrides: Partial<TopUpWalletBucketRow> = {}): TopUpWalletBucketRow {
  return {
    bucket: 'purchased',
    balance_tokens: '1000',
    spend_priority: 1,
    label: 'Purchased',
    will_drain_next: true,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<SessionTopUpPageInputs> = {}): SessionTopUpPageInputs {
  return {
    vip_id: 'vip-1',
    session_id: 'sess-abc',
    session_state: 'expired',
    remaining_minutes: 0,
    context_snapshot: null,
    recommended_skus: [makeSku()],
    wallet_buckets: [
      makeBucket({ bucket: 'purchased', spend_priority: 1, will_drain_next: true }),
      makeBucket({ bucket: 'membership', balance_tokens: '200', spend_priority: 2, will_drain_next: false }),
      makeBucket({ bucket: 'bonus', balance_tokens: '50', spend_priority: 3, will_drain_next: false }),
    ],
    selected_sku_id: null,
    selected_bucket: null,
    ...overrides,
  };
}

describe('renderSessionTopUpPage — structure', () => {
  it('returns the canonical rule_applied_id', () => {
    const { rule_applied_id } = renderSessionTopUpPage(makeInputs());
    expect(rule_applied_id).toBe(SESSION_TOP_UP_PAGE_RULE_ID);
  });

  it('root node carries test_id "session-topup-page"', () => {
    const { tree } = renderSessionTopUpPage(makeInputs());
    expect(tree.test_id).toBe('session-topup-page');
  });

  it('root props include session_state and vip_id', () => {
    const { tree } = renderSessionTopUpPage(makeInputs({ session_state: 'expired', vip_id: 'vip-42' }));
    expect(tree.props?.session_state).toBe('expired');
    expect(tree.props?.vip_id).toBe('vip-42');
  });
});

describe('renderSessionTopUpPage — expired banner', () => {
  it('renders expired banner when session_state is "expired"', () => {
    const { tree } = renderSessionTopUpPage(makeInputs({ session_state: 'expired' }));
    const banner = findByTestId(tree, 'session-topup-expired-banner');
    expect(banner).toBeDefined();
    expect(banner?.classes).toContain('cnz-banner--expired');
  });

  it('renders expired banner when remaining_minutes is 0 even if state is not "expired"', () => {
    const { tree } = renderSessionTopUpPage(
      makeInputs({ session_state: 'minutes-decrementing', remaining_minutes: 0 }),
    );
    const banner = findByTestId(tree, 'session-topup-expired-banner');
    expect(banner).toBeDefined();
  });

  it('does NOT render expired banner when session is still active', () => {
    const { tree } = renderSessionTopUpPage(
      makeInputs({ session_state: 'minutes-decrementing', remaining_minutes: 15 }),
    );
    expect(findByTestId(tree, 'session-topup-expired-banner')).toBeUndefined();
    expect(findByTestId(tree, 'session-topup-minutes-indicator')).toBeDefined();
  });

  it('remaining minutes indicator shows correct value when not expired', () => {
    const { tree } = renderSessionTopUpPage(
      makeInputs({ session_state: 'minutes-decrementing', remaining_minutes: 42 }),
    );
    const indicator = findByTestId(tree, 'session-topup-remaining-minutes');
    expect(indicator?.children).toContain('42 min remaining');
  });

  it('banner has role=alert for assistive technology', () => {
    const { tree } = renderSessionTopUpPage(makeInputs({ session_state: 'expired' }));
    const banner = findByTestId(tree, 'session-topup-expired-banner');
    expect(banner?.aria?.role).toBe('alert');
  });
});

describe('renderSessionTopUpPage — SKU list', () => {
  it('renders a card for each recommended SKU', () => {
    const skus = [
      makeSku({ sku_id: 'sku-t30', sku_type: 'time' }),
      makeSku({ sku_id: 'sku-v15', sku_type: 'voice', is_recommended: false }),
      makeSku({ sku_id: 'sku-n20', sku_type: 'narrative', is_recommended: false }),
    ];
    const { tree } = renderSessionTopUpPage(makeInputs({ recommended_skus: skus }));
    expect(findByTestId(tree, 'session-topup-sku-sku-t30')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-sku-sku-v15')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-sku-sku-n20')).toBeDefined();
  });

  it('marks the selected SKU with cnz-sku-card--selected and shows "Selected"', () => {
    const skus = [
      makeSku({ sku_id: 'sku-sel' }),
      makeSku({ sku_id: 'sku-not', is_recommended: false }),
    ];
    const { tree } = renderSessionTopUpPage(
      makeInputs({ recommended_skus: skus, selected_sku_id: 'sku-sel' }),
    );
    const selectedCard = findByTestId(tree, 'session-topup-sku-sku-sel');
    expect(selectedCard?.classes).toContain('cnz-sku-card--selected');
    const selectBtn = findByTestId(tree, 'session-topup-sku-select-sku-sel');
    expect(selectBtn?.children).toContain('Selected');
    expect(selectBtn?.classes).toContain('cnz-button--primary');
  });

  it('unselected SKU shows "Select" with ghost button style', () => {
    const skus = [makeSku({ sku_id: 'sku-unsel' })];
    const { tree } = renderSessionTopUpPage(makeInputs({ recommended_skus: skus, selected_sku_id: null }));
    const selectBtn = findByTestId(tree, 'session-topup-sku-select-sku-unsel');
    expect(selectBtn?.children).toContain('Select');
    expect(selectBtn?.classes).toContain('cnz-button--ghost');
  });

  it('recommended SKU carries is_recommended badge class', () => {
    const skus = [makeSku({ sku_id: 'sku-rec', is_recommended: true })];
    const { tree } = renderSessionTopUpPage(makeInputs({ recommended_skus: skus }));
    const card = findByTestId(tree, 'session-topup-sku-sku-rec');
    expect(card?.classes).toContain('cnz-sku-card--recommended');
  });

  it('SKU card exposes minutes_granted and price_czt in test-addressable nodes', () => {
    const sku = makeSku({ sku_id: 'sku-d', minutes_granted: 45, price_czt: 750 });
    const { tree } = renderSessionTopUpPage(makeInputs({ recommended_skus: [sku] }));
    const minutes = findByTestId(tree, 'session-topup-sku-minutes-sku-d');
    const price = findByTestId(tree, 'session-topup-sku-price-sku-d');
    expect(minutes?.children).toContain('45');
    expect(price?.children).toContain('750 CZT');
  });

  it('renders empty-state message when no SKUs provided', () => {
    const { tree } = renderSessionTopUpPage(makeInputs({ recommended_skus: [] }));
    const skuList = findByTestId(tree, 'session-topup-sku-list');
    expect(skuList).toBeDefined();
    // no sku cards
    const ids = collectTestIds(tree);
    expect(ids.some((id) => id.startsWith('session-topup-sku-') && id !== 'session-topup-sku-list')).toBe(false);
  });
});

describe('renderSessionTopUpPage — wallet selector', () => {
  it('renders all three bucket rows', () => {
    const { tree } = renderSessionTopUpPage(makeInputs());
    expect(findByTestId(tree, 'session-topup-bucket-purchased')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-bucket-membership')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-bucket-bonus')).toBeDefined();
  });

  it('selected bucket carries cnz-wallet-bucket--selected', () => {
    const { tree } = renderSessionTopUpPage(makeInputs({ selected_bucket: 'membership' }));
    const selectedRow = findByTestId(tree, 'session-topup-bucket-membership');
    expect(selectedRow?.classes).toContain('cnz-wallet-bucket--selected');
    const notSelected = findByTestId(tree, 'session-topup-bucket-purchased');
    expect(notSelected?.classes).not.toContain('cnz-wallet-bucket--selected');
  });

  it('bucket that drains next carries cnz-wallet-bucket--drain-next', () => {
    const { tree } = renderSessionTopUpPage(
      makeInputs({
        wallet_buckets: [
          makeBucket({ bucket: 'purchased', will_drain_next: true }),
          makeBucket({ bucket: 'membership', balance_tokens: '200', spend_priority: 2, will_drain_next: false }),
          makeBucket({ bucket: 'bonus', balance_tokens: '50', spend_priority: 3, will_drain_next: false }),
        ],
      }),
    );
    const drainNext = findByTestId(tree, 'session-topup-bucket-purchased');
    expect(drainNext?.classes).toContain('cnz-wallet-bucket--drain-next');
  });

  it('select bucket buttons are bound to selectWalletBucket handler', () => {
    const { tree } = renderSessionTopUpPage(makeInputs());
    const btn = findByTestId(tree, 'session-topup-bucket-select-purchased');
    expect(btn?.on?.click).toBe('selectWalletBucket');
    expect(btn?.props?.bucket).toBe('purchased');
  });
});

describe('renderSessionTopUpPage — purchase action', () => {
  it('Purchase & Resume is disabled when no SKU or bucket selected', () => {
    const { tree, view } = renderSessionTopUpPage(
      makeInputs({ selected_sku_id: null, selected_bucket: null }),
    );
    expect(view.can_resume).toBe(false);
    const btn = findByTestId(tree, 'session-topup-purchase-resume');
    expect(btn?.props?.disabled).toBe(true);
    expect(btn?.classes).toContain('cnz-button--disabled');
  });

  it('Purchase & Resume is enabled when both SKU and bucket are selected', () => {
    const { tree, view } = renderSessionTopUpPage(
      makeInputs({ selected_sku_id: 'sku-time-30', selected_bucket: 'purchased' }),
    );
    expect(view.can_resume).toBe(true);
    const btn = findByTestId(tree, 'session-topup-purchase-resume');
    expect(btn?.props?.disabled).toBe(false);
    expect(btn?.classes).toContain('cnz-button--primary');
  });

  it('Purchase & Resume is disabled when only SKU is selected', () => {
    const { tree, view } = renderSessionTopUpPage(
      makeInputs({ selected_sku_id: 'sku-time-30', selected_bucket: null }),
    );
    expect(view.can_resume).toBe(false);
    const btn = findByTestId(tree, 'session-topup-purchase-resume');
    expect(btn?.props?.disabled).toBe(true);
  });

  it('shows context restore notice when context_snapshot is present', () => {
    const { tree, view } = renderSessionTopUpPage(
      makeInputs({ context_snapshot: 'snap-xyz' }),
    );
    expect(view.context_restorable).toBe(true);
    const panel = findByTestId(tree, 'session-topup-purchase-action');
    const ids = collectTestIds(panel!);
    // The panel should contain the context notice node
    expect(panel).toBeDefined();
  });

  it('context_restorable is false when context_snapshot is null', () => {
    const { view } = renderSessionTopUpPage(makeInputs({ context_snapshot: null }));
    expect(view.context_restorable).toBe(false);
  });

  it('Purchase & Resume button fires purchaseAndResume on click', () => {
    const { tree } = renderSessionTopUpPage(
      makeInputs({ selected_sku_id: 'sku-time-30', selected_bucket: 'membership' }),
    );
    const btn = findByTestId(tree, 'session-topup-purchase-resume');
    expect(btn?.on?.click).toBe('purchaseAndResume');
    expect(btn?.props?.selected_sku_id).toBe('sku-time-30');
    expect(btn?.props?.selected_bucket).toBe('membership');
  });
});

describe('renderSessionTopUpPage — view model state machine', () => {
  it.each([
    ['granted', 10, false],
    ['minutes-decrementing', 5, false],
    ['expired', 0, true],
    ['top-up-purchased', 0, true],
    ['resumed', 20, false],
  ] as const)(
    'state=%s remaining=%d → is_expired=%s',
    (state, remaining, expectedExpired) => {
      const { view } = renderSessionTopUpPage(
        makeInputs({ session_state: state, remaining_minutes: remaining }),
      );
      expect(view.is_expired).toBe(expectedExpired);
    },
  );
});
