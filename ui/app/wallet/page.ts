// PAYLOAD 7 — /wallet three-bucket wallet page.

import {
  PublicWalletPresenter,
  type GovernanceSnapshot,
} from '../../view-models/public-wallet.presenter';
import { SEO } from '../../config/seo';
import { THEME } from '../../config/theme';
import { el, RenderElement } from '../../components/render-plan';
import type {
  GuestTier,
  SafetyNetOfferCard,
  WalletBucket,
  WalletThreeBucketView,
} from '../../types/public-wallet-contracts';

export const WALLET_PAGE_RULE_ID = 'WALLET_PAGE_v1';

export interface WalletPageRender {
  metadata: typeof SEO.wallet;
  view: WalletThreeBucketView;
  tree: RenderElement;
  rule_applied_id: string;
}

export function renderWalletPage(args: {
  wallet_id: string;
  user_id: string;
  tier: GuestTier;
  balances: Record<WalletBucket, bigint>;
  safety_net?: SafetyNetOfferCard | null;
  governance?: GovernanceSnapshot;
  now_utc?: Date;
}): WalletPageRender {
  const presenter = new PublicWalletPresenter();
  const view = presenter.buildWalletView({
    wallet_id: args.wallet_id,
    user_id: args.user_id,
    tier: args.tier,
    balances: args.balances,
    safety_net: args.safety_net,
    governance: args.governance,
    now_utc: args.now_utc,
  });

  const safetyNetSection = view.safety_net
    ? renderSafetyNet(view.safety_net)
    : el(
        'section',
        {
          test_id: 'wallet-safety-net-empty',
          classes: ['cnz-panel', 'cnz-panel--empty'],
        },
        [el('p', {}, ['No expiring balances — safety-net inactive.'])],
      );

  const tree = el(
    'main',
    {
      test_id: 'wallet-page',
      classes: ['cnz-public', 'cnz-public--wallet', 'cnz-theme-dark'],
      props: { mode: THEME.default_mode, tier: args.tier },
      aria: { 'aria-label': 'Wallet — three-bucket view' },
    },
    [
      el('header', { classes: ['cnz-public__header'] }, [
        el('h1', {}, ['Wallet']),
        el('p', { test_id: 'wallet-total-tokens' }, [`Total: ${view.total_tokens} CZT`]),
      ]),
      el(
        'section',
        {
          test_id: 'wallet-buckets',
          classes: ['cnz-panel'],
          aria: { 'aria-label': 'Three-bucket spend order' },
        },
        [
          el('h2', {}, ['Spend order (deterministic)']),
          el(
            'ol',
            { classes: ['cnz-bucket-list'] },
            view.buckets.map((b) =>
              el(
                'li',
                {
                  test_id: `wallet-bucket-${b.bucket}`,
                  classes: [b.will_drain_next ? 'cnz-bucket-list__item--draining' : ''],
                  props: {
                    spend_priority: b.spend_priority,
                    will_drain_next: b.will_drain_next,
                  },
                },
                [
                  el('header', {}, [
                    el('strong', {}, [`${b.spend_priority}. ${b.label}`]),
                    el('span', {}, [`${b.balance_tokens} CZT`]),
                  ]),
                  el('p', {}, [b.description]),
                ],
              ),
            ),
          ),
        ],
      ),
      safetyNetSection,
    ],
  );

  return {
    metadata: SEO.wallet,
    view,
    tree,
    rule_applied_id: WALLET_PAGE_RULE_ID,
  };
}

function renderSafetyNet(net: SafetyNetOfferCard): RenderElement {
  return el(
    'section',
    {
      test_id: 'wallet-safety-net',
      classes: ['cnz-panel', 'cnz-panel--safety-net'],
      aria: { 'aria-label': 'Expiration safety net' },
      props: {
        wallet_id: net.wallet_id,
        rule_applied_id: net.rule_applied_id,
      },
    },
    [
      el('h2', {}, ['Safety net']),
      el('dl', { classes: ['cnz-stat-grid'] }, [
        el('dt', {}, ['Expires']),
        el('dd', {}, [net.expires_at_utc]),
        el('dt', {}, ['Hours until expiry']),
        el('dd', {}, [String(net.hours_until_expiry)]),
        el('dt', {}, ['Remaining tokens']),
        el('dd', {}, [net.remaining_tokens]),
        el('dt', {}, ['Extension fee']),
        el('dd', {}, [`$${net.extension_fee_usd.toFixed(2)} for +${net.extension_grant_days}d`]),
        el('dt', {}, ['Recovery fee']),
        el('dd', {}, [`$${net.recovery_fee_usd.toFixed(2)}`]),
        el('dt', {}, ['3/5ths refund pct']),
        el('dd', {}, [`${(net.three_fifths_refund_pct * 100).toFixed(0)}%`]),
        el('dt', {}, ['3/5ths lock']),
        el('dd', {}, [`${net.three_fifths_lock_hours}h`]),
      ]),
      el('div', { classes: ['cnz-cta-row'] }, [
        el(
          'button',
          {
            test_id: 'wallet-safety-net-extend',
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: 'requestExtension' },
          },
          [`Extend $${net.extension_fee_usd.toFixed(2)}`],
        ),
        el(
          'button',
          {
            test_id: 'wallet-safety-net-recover',
            classes: ['cnz-button', 'cnz-button--secondary'],
            on: { click: 'requestRecovery' },
          },
          [`Recover $${net.recovery_fee_usd.toFixed(2)}`],
        ),
        net.has_token_bridge_eligible
          ? el(
              'button',
              {
                test_id: 'wallet-safety-net-token-bridge',
                classes: ['cnz-button', 'cnz-button--ghost'],
                on: { click: 'requestTokenBridge' },
              },
              [`Token Bridge +${(net.token_bridge_bonus_pct * 100).toFixed(0)}%`],
            )
          : null,
      ]),
    ],
  );
}
