// PAYLOAD 7 — /tokens guest-facing token bundle rate card page.

import {
  PublicWalletPresenter,
  type GovernanceSnapshot,
} from '../../view-models/public-wallet.presenter';
import { SEO } from '../../config/seo';
import { THEME } from '../../config/theme';
import { el, RenderElement } from '../../components/render-plan';
import type { GuestTier, TokenBundleRateCard } from '../../types/public-wallet-contracts';

export const TOKENS_PAGE_RULE_ID = 'PUBLIC_TOKENS_PAGE_v1';

export interface TokensPageRender {
  metadata: typeof SEO.tokens;
  view: TokenBundleRateCard;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderTokensPage(args: {
  tier: GuestTier;
  governance?: GovernanceSnapshot;
  promoted_bundle_tokens?: number;
  now_utc?: Date;
}): TokensPageRender {
  const presenter = new PublicWalletPresenter();
  const view = presenter.buildTokenBundleRateCard({
    tier: args.tier,
    governance: args.governance,
    promoted_bundle_tokens: args.promoted_bundle_tokens,
    now_utc: args.now_utc,
  });

  const tree = el(
    'main',
    {
      test_id: 'tokens-page',
      classes: ['cnz-public', 'cnz-public--tokens', 'cnz-theme-dark'],
      aria: { 'aria-label': 'Token bundle rate card' },
      props: { mode: THEME.default_mode, tier: args.tier },
    },
    [
      el('header', { classes: ['cnz-public__header'] }, [
        el('h1', {}, ['Token bundles']),
        el('p', {}, ['REDBOOK §3 — locked pricing across every guest tier.']),
      ]),
      el(
        'section',
        {
          test_id: 'tokens-tease-regular',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Tease Regular bundles' },
        },
        [
          el('h2', {}, ['Tease Regular']),
          el('table', { classes: ['cnz-table', 'cnz-table--bundles'] }, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', {}, ['Tokens']),
                el('th', {}, ['Guest USD']),
                el('th', {}, ['Member USD']),
                el('th', {}, ['Member discount']),
                el('th', {}, ['Per token']),
              ]),
            ]),
            el(
              'tbody',
              {},
              view.rows.map((r) =>
                el(
                  'tr',
                  {
                    test_id: `tokens-row-${r.tokens}`,
                    classes: [r.is_promoted ? 'cnz-row--promoted' : ''],
                    props: {
                      is_promoted: r.is_promoted,
                      reason_code: r.reason_code,
                    },
                  },
                  [
                    el('td', {}, [r.tokens.toLocaleString('en-US')]),
                    el('td', {}, [`$${r.guest_price_usd.toFixed(2)}`]),
                    el('td', {}, [`$${r.member_price_usd.toFixed(2)}`]),
                    el('td', {}, [
                      r.discount_for_members_pct !== null
                        ? `${r.discount_for_members_pct.toFixed(1)}%`
                        : '—',
                    ]),
                    el('td', {}, [`$${r.per_token_usd.toFixed(4)}`]),
                  ],
                ),
              ),
            ),
          ]),
        ],
      ),
    ],
  );

  return {
    metadata: SEO.tokens,
    view,
    tree,
    rule_applied_id: TOKENS_PAGE_RULE_ID,
  };
}
