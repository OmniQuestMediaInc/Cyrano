// Payload #13 — Send Gift panel render-plan spec.
import {
  buildSendGiftOptions,
  renderSendGiftPanel,
  SEND_GIFT_PANEL_RULE_ID,
} from './send-gift-panel';
import { findByTestId, collectTestIds } from './render-plan';
import {
  MICRO_GIFTS,
  RRR_GIFT_COMMISSION_PCT,
  rrrPointsPriceFor,
} from '../../services/core-api/src/config/governance.config';

describe('renderSendGiftPanel', () => {
  it('exposes 6–10 gift options sourced from MICRO_GIFTS', () => {
    const options = buildSendGiftOptions();
    expect(options.length).toBeGreaterThanOrEqual(6);
    expect(options.length).toBeLessThanOrEqual(10);
    expect(options.map((o) => o.gift_id).sort()).toEqual(
      [...MICRO_GIFTS].map((g) => g.gift_id).sort(),
    );
  });

  it('quotes RRR points using the canonical commission helper (no client-side math)', () => {
    const options = buildSendGiftOptions();
    for (const opt of options) {
      const def = MICRO_GIFTS.find((g) => g.gift_id === opt.gift_id)!;
      expect(opt.rrr_points_price).toBe(rrrPointsPriceFor(def));
      expect(opt.rrr_points_price).toBeGreaterThan(def.token_value); // 25% commission ⇒ always above raw token value at $0.08/$0.01 parity
    }
  });

  it('renders trigger + modal with Tokens and RRR Points buttons per gift', () => {
    const { tree, options, rule_applied_id } = renderSendGiftPanel({
      creator_id: 'cnz_creator_42',
      rrr_member_id: 'rrr_member_123',
      modal_open: true,
    });
    expect(rule_applied_id).toBe(SEND_GIFT_PANEL_RULE_ID);
    expect(findByTestId(tree, 'creator-control-send-gift-panel')).toBeDefined();
    expect(findByTestId(tree, 'creator-control-send-gift-trigger')).toBeDefined();
    const modal = findByTestId(tree, 'creator-control-send-gift-modal');
    expect(modal).toBeDefined();
    expect(modal!.classes).toContain('cnz-modal--open');

    for (const opt of options) {
      expect(findByTestId(tree, `creator-control-send-gift-${opt.gift_id}`)).toBeDefined();
      expect(findByTestId(tree, `creator-control-send-gift-${opt.gift_id}-tokens`)).toBeDefined();
      const pointsBtn = findByTestId(tree, `creator-control-send-gift-${opt.gift_id}-points`);
      expect(pointsBtn).toBeDefined();
      expect(pointsBtn!.props?.disabled).toBe(false);
    }

    const ids = collectTestIds(tree);
    expect(ids.length).toBeGreaterThan(options.length * 2);
  });

  it('disables the Points button when the sender has no linked RRR member', () => {
    const { tree } = renderSendGiftPanel({ creator_id: 'cnz_creator_42' });
    const sample = findByTestId(tree, 'creator-control-send-gift-rose-points');
    expect(sample).toBeDefined();
    expect(sample!.props?.disabled).toBe(true);
    expect(sample!.classes).toContain('cnz-button--disabled');
  });

  it('hides the modal by default', () => {
    const { tree } = renderSendGiftPanel({ creator_id: 'cnz_creator_42' });
    const modal = findByTestId(tree, 'creator-control-send-gift-modal');
    expect(modal!.classes).toContain('cnz-modal--hidden');
  });

  it('exposes the commission percentage on the panel root for governance audit', () => {
    const { tree } = renderSendGiftPanel({ creator_id: 'c' });
    expect(tree.props?.commission_pct).toBe(RRR_GIFT_COMMISSION_PCT);
  });
});
