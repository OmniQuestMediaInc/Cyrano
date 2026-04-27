// PAYLOAD 7 — /diamond/purchase Diamond Tier purchase quote page.

import {
  PublicWalletPresenter,
  type GovernanceSnapshot,
} from '../../../view-models/public-wallet.presenter';
import { SEO } from '../../../config/seo';
import { THEME } from '../../../config/theme';
import { el, RenderElement } from '../../../components/render-plan';
import type { DiamondPurchaseQuoteCard } from '../../../types/public-wallet-contracts';

export const DIAMOND_PURCHASE_PAGE_RULE_ID = 'DIAMOND_PURCHASE_PAGE_v1';

export interface DiamondPurchasePageRender {
  metadata: typeof SEO.diamond_purchase;
  view: DiamondPurchaseQuoteCard;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderDiamondPurchasePage(args: {
  tokens: number;
  velocity_days: number;
  governance?: GovernanceSnapshot;
  now_utc?: Date;
}): DiamondPurchasePageRender {
  const presenter = new PublicWalletPresenter();
  const view = presenter.buildDiamondQuote({
    tokens: args.tokens,
    velocity_days: args.velocity_days,
    governance: args.governance,
    now_utc: args.now_utc,
  });

  const tree = el(
    'main',
    {
      test_id: 'diamond-purchase-page',
      classes: ['cnz-public', 'cnz-public--diamond', 'cnz-theme-dark'],
      aria: { 'aria-label': 'Diamond Tier purchase quote' },
      props: { mode: THEME.default_mode },
    },
    [
      el('header', { classes: ['cnz-public__header'] }, [
        el('h1', {}, ['Diamond Tier Purchase']),
        el('p', {}, ['Volume + velocity pricing with the platform floor guarantee.']),
      ]),
      el(
        'section',
        {
          test_id: 'diamond-quote-card',
          classes: ['cnz-panel', 'cnz-panel--quote'],
          aria: { 'aria-label': 'Diamond pricing quote' },
        },
        [
          el('dl', { classes: ['cnz-stat-grid'] }, [
            el('dt', {}, ['Tokens']),
            el('dd', {}, [view.tokens.toLocaleString('en-US')]),
            el('dt', {}, ['Velocity']),
            el('dd', {}, [`${view.velocity_days} days (${view.velocity_band})`]),
            el('dt', {}, ['Base rate']),
            el('dd', {}, [`$${view.base_rate_usd.toFixed(3)}/CZT`]),
            el('dt', {}, ['Velocity multiplier']),
            el('dd', {}, [`${view.velocity_multiplier.toFixed(2)}×`]),
            el('dt', {}, ['Effective rate']),
            el('dd', {}, [`$${view.platform_rate_usd.toFixed(3)}/CZT`]),
            el(
              'dt',
              {
                test_id: 'diamond-quote-floor-flag',
                classes: [view.platform_floor_applied ? 'cnz-flag--floor' : ''],
              },
              [view.platform_floor_applied ? 'Platform floor applied' : 'Above floor'],
            ),
            el('dd', {}, [`$${view.platform_floor_per_token_usd.toFixed(3)}`]),
            el('dt', {}, ['Total USD cents']),
            el('dd', {}, [view.usd_total_cents]),
            el('dt', {}, ['Expires']),
            el('dd', {}, [view.expires_at_utc]),
            el('dt', {}, ['Extension fee']),
            el('dd', {}, [`$${view.extension_fee_usd.toFixed(2)}`]),
            el('dt', {}, ['Recovery fee']),
            el('dd', {}, [`$${view.recovery_fee_usd.toFixed(2)}`]),
          ]),
          el(
            'button',
            {
              test_id: 'diamond-purchase-confirm',
              classes: ['cnz-button', 'cnz-button--primary', 'cnz-button--xl'],
              on: { click: 'confirmDiamondPurchase' },
              props: {
                tokens: view.tokens,
                velocity_days: view.velocity_days,
                rule_applied_id: view.rule_applied_id,
              },
            },
            [`Purchase ${view.tokens.toLocaleString('en-US')} CZT`],
          ),
        ],
      ),
    ],
  );

  return {
    metadata: SEO.diamond_purchase,
    view,
    tree,
    rule_applied_id: DIAMOND_PURCHASE_PAGE_RULE_ID,
  };
}
