// Screen 04 — Session Top-Up & Recovery page spec.
import {
  renderSessionTopUpPage,
  SESSION_TOPUP_PAGE_RULE_ID,
  type SessionTopUpPageInputs,
} from './page';
import { findByTestId, collectTestIds } from '../../../components/render-plan';
import type { TopUpSku, TopUpWalletBucketRow } from '../../../types/cyrano-persona-contracts';

const SKU_TIME: TopUpSku = {
  sku_id: 'sku_time_30',
  label: '30 min session',
  sku_type: 'TIME',
  minutes_granted: 30,
  price_tokens: 150,
  price_usd: 12.0,
};

const SKU_VOICE: TopUpSku = {
  sku_id: 'sku_voice_15',
  label: '15 min voice add-on',
  sku_type: 'VOICE',
  minutes_granted: 15,
  price_tokens: 90,
  price_usd: 7.2,
};

const SKU_NARRATIVE: TopUpSku = {
  sku_id: 'sku_narrative_1',
  label: 'Narrative package',
  sku_type: 'NARRATIVE',
  minutes_granted: 0,
  price_tokens: 60,
  price_usd: 4.8,
};

const BUCKETS: TopUpWalletBucketRow[] = [
  { bucket: 'purchased', balance_tokens: 500, spend_priority: 1, label: 'Purchased tokens', sufficient: true },
  { bucket: 'membership', balance_tokens: 100, spend_priority: 2, label: 'Membership tokens', sufficient: true },
  { bucket: 'bonus', balance_tokens: 20, spend_priority: 3, label: 'Bonus tokens', sufficient: false },
];

const BASE_INPUTS: SessionTopUpPageInputs = {
  session_id: 'sess_abc123',
  vip_id: 'vip_007',
  lifecycle_state: 'EXPIRED',
  remaining_minutes: 0,
  recommended_skus: [SKU_TIME, SKU_VOICE, SKU_NARRATIVE],
  wallet_buckets: BUCKETS,
  selected_sku_id: null,
  selected_bucket: null,
};

describe('renderSessionTopUpPage', () => {
  it('returns the canonical rule_applied_id', () => {
    const { rule_applied_id } = renderSessionTopUpPage(BASE_INPUTS);
    expect(rule_applied_id).toBe(SESSION_TOPUP_PAGE_RULE_ID);
  });

  it('renders the page root with correct test_id', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-page')).toBeDefined();
  });

  it('exposes lifecycle_state on page root props', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const page = findByTestId(tree, 'session-topup-page');
    expect(page?.props?.lifecycle_state).toBe('EXPIRED');
  });

  it('renders the expiry banner when lifecycle_state is EXPIRED', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const banner = findByTestId(tree, 'session-topup-banner');
    expect(banner).toBeDefined();
    expect(banner?.classes).toContain('cnz-banner--warn');
  });

  it('renders success banner when lifecycle_state is RESUMED', () => {
    const { tree } = renderSessionTopUpPage({ ...BASE_INPUTS, lifecycle_state: 'RESUMED' });
    const banner = findByTestId(tree, 'session-topup-banner');
    expect(banner?.classes).toContain('cnz-banner--success');
  });

  it('renders idle element (hidden) when lifecycle_state is GRANTED', () => {
    const { tree } = renderSessionTopUpPage({ ...BASE_INPUTS, lifecycle_state: 'GRANTED' });
    expect(findByTestId(tree, 'session-topup-banner-idle')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-banner')).toBeUndefined();
  });

  it('renders session status panel with session ID and state', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-status')).toBeDefined();
    const idCell = findByTestId(tree, 'session-topup-session-id');
    expect(idCell?.children).toContain('sess_abc123');
    const stateCell = findByTestId(tree, 'session-topup-state');
    expect(stateCell?.children).toContain('EXPIRED');
  });

  it('shows remaining minutes as 0 with danger class', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const minutes = findByTestId(tree, 'session-topup-remaining-minutes');
    expect(minutes?.children).toContain('0');
    expect(minutes?.classes).toContain('cnz-stat--danger');
  });

  it('renders a card for each recommended SKU', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-sku-sku_time_30')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-sku-sku_voice_15')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-sku-sku_narrative_1')).toBeDefined();
  });

  it('renders Select button on each SKU card', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-sku-select-sku_time_30')).toBeDefined();
  });

  it('marks selected SKU with cnz-sku-card--selected class', () => {
    const { tree } = renderSessionTopUpPage({ ...BASE_INPUTS, selected_sku_id: 'sku_time_30' });
    const card = findByTestId(tree, 'session-topup-sku-sku_time_30');
    expect(card?.classes).toContain('cnz-sku-card--selected');
    const otherCard = findByTestId(tree, 'session-topup-sku-sku_voice_15');
    expect(otherCard?.classes).not.toContain('cnz-sku-card--selected');
  });

  it('renders all three wallet buckets in the selector', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-bucket-purchased')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-bucket-membership')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-bucket-bonus')).toBeDefined();
  });

  it('marks insufficient bucket with cnz-bucket-row--insufficient class', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const bonusBucket = findByTestId(tree, 'session-topup-bucket-bonus');
    expect(bonusBucket?.classes).toContain('cnz-bucket-row--insufficient');
  });

  it('renders Purchase & Resume button', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-purchase-btn')).toBeDefined();
  });

  it('disables Purchase & Resume when no SKU or bucket selected', () => {
    const { tree, view } = renderSessionTopUpPage(BASE_INPUTS);
    expect(view.can_purchase).toBe(false);
    const btn = findByTestId(tree, 'session-topup-purchase-btn');
    expect(btn?.props?.disabled).toBe(true);
    expect(btn?.classes).toContain('cnz-button--disabled');
  });

  it('enables Purchase & Resume when sufficient bucket and SKU both selected', () => {
    const { tree, view } = renderSessionTopUpPage({
      ...BASE_INPUTS,
      selected_sku_id: 'sku_time_30',
      selected_bucket: 'purchased',
    });
    expect(view.can_purchase).toBe(true);
    const btn = findByTestId(tree, 'session-topup-purchase-btn');
    expect(btn?.props?.disabled).toBe(false);
    expect(btn?.classes).not.toContain('cnz-button--disabled');
  });

  it('disables Purchase & Resume when bucket has insufficient balance', () => {
    const { view } = renderSessionTopUpPage({
      ...BASE_INPUTS,
      selected_sku_id: 'sku_time_30',   // costs 150 tokens
      selected_bucket: 'bonus',          // only 20 tokens
    });
    expect(view.can_purchase).toBe(false);
  });

  it('attaches gateguard_action to the purchase button props', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const btn = findByTestId(tree, 'session-topup-purchase-btn');
    expect(btn?.props?.gateguard_action).toBe('SESSION_TOPUP');
  });

  it('renders GateGuard note below purchase button', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    expect(findByTestId(tree, 'session-topup-gateguard-note')).toBeDefined();
  });

  it('exposes cyrano_session_topup SEO metadata', () => {
    const { metadata } = renderSessionTopUpPage(BASE_INPUTS);
    expect(metadata.canonical_url).toContain('/diamond/session-topup');
    expect(metadata.robots).toBe('noindex,nofollow');
  });

  it('renders empty SKU section when no SKUs provided', () => {
    const { tree } = renderSessionTopUpPage({ ...BASE_INPUTS, recommended_skus: [] });
    expect(findByTestId(tree, 'session-topup-skus-empty')).toBeDefined();
    expect(findByTestId(tree, 'session-topup-skus')).toBeUndefined();
  });

  it('collectTestIds covers a reasonable surface area', () => {
    const { tree } = renderSessionTopUpPage(BASE_INPUTS);
    const ids = collectTestIds(tree);
    expect(ids.length).toBeGreaterThan(20);
  });
});
