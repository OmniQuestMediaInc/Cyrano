// Payload #13 — CNZ × RRR micro-gift "Send Gift" panel (render plan).
// Adds a "Send Gift" button to the creator room and a modal that lists the
// canonical MICRO_GIFTS catalogue with both Tokens and RRR Points pricing.
// Pricing is canonicalised here from governance.config so that the modal
// can never quote a price the controller would reject.
//
// Doctrine notes:
//   • This file produces a framework-agnostic RenderPlan tree; Payload-7
//     adapters convert it to React.
//   • The modal is rendered as a sibling of the trigger button so the
//     adapter can hide/show via the `cnz-modal--hidden` class — no JS
//     state lives in the render plan.

import {
  GIFT_TOKEN_USD_VALUE,
  MICRO_GIFTS,
  MicroGiftDef,
  RRR_GIFT_COMMISSION_PCT,
  rrrPointsPriceFor,
} from '../../services/core-api/src/config/governance.config';
import { el, RenderElement } from './render-plan';

export const SEND_GIFT_PANEL_RULE_ID = 'CNZ_GIFT_PANEL_v1';

export interface SendGiftPanelInputs {
  creator_id: string;
  /** Sender's RRR member id, if linked. Drives whether POINTS is offered. */
  rrr_member_id?: string;
  /** Whether the modal should be open in the initial render. */
  modal_open?: boolean;
}

export interface SendGiftPanelRender {
  tree: RenderElement;
  rule_applied_id: string;
  /** Materialised gift options (token + RRR points pricing) for tests / SSR. */
  options: SendGiftOption[];
}

export interface SendGiftOption {
  gift_id: string;
  display_name: string;
  emoji: string;
  token_value: number;
  rrr_points_price: number;
  usd_equivalent: number;
}

export function buildSendGiftOptions(): SendGiftOption[] {
  return MICRO_GIFTS.map((g: MicroGiftDef) => ({
    gift_id: g.gift_id,
    display_name: g.display_name,
    emoji: g.emoji,
    token_value: g.token_value,
    rrr_points_price: rrrPointsPriceFor(g),
    usd_equivalent: Number((g.token_value * GIFT_TOKEN_USD_VALUE).toFixed(2)),
  }));
}

export function renderSendGiftPanel(inputs: SendGiftPanelInputs): SendGiftPanelRender {
  const options = buildSendGiftOptions();
  const pointsAllowed = Boolean(inputs.rrr_member_id);
  const modalHidden = !inputs.modal_open;

  const tree = el(
    'section',
    {
      test_id: 'creator-control-send-gift-panel',
      classes: ['cnz-panel', 'cnz-panel--send-gift'],
      aria: { 'aria-label': 'Send a micro-gift' },
      props: {
        creator_id: inputs.creator_id,
        rrr_linked: pointsAllowed,
        commission_pct: RRR_GIFT_COMMISSION_PCT,
      },
    },
    [
      el('header', {}, [
        el('h2', {}, ['Send Gift']),
        el(
          'button',
          {
            test_id: 'creator-control-send-gift-trigger',
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: 'openSendGiftModal' },
            props: { creator_id: inputs.creator_id },
          },
          ['Send Gift'],
        ),
      ]),
      el(
        'div',
        {
          test_id: 'creator-control-send-gift-modal',
          classes: ['cnz-modal', modalHidden ? 'cnz-modal--hidden' : 'cnz-modal--open'],
          aria: { 'aria-modal': 'true', role: 'dialog' },
          props: { open: !modalHidden },
        },
        [
          el('header', {}, [
            el('h3', {}, ['Choose a gift']),
            el(
              'button',
              {
                test_id: 'creator-control-send-gift-close',
                classes: ['cnz-button', 'cnz-button--ghost'],
                on: { click: 'closeSendGiftModal' },
              },
              ['Close'],
            ),
          ]),
          el(
            'ul',
            { classes: ['cnz-gift-grid'] },
            options.map((opt) => renderGiftOption(opt, pointsAllowed)),
          ),
          el('footer', { classes: ['cnz-modal__footer'] }, [
            el('span', { classes: ['cnz-gift-footer__commission'] }, [
              `RRR Points include ${(RRR_GIFT_COMMISSION_PCT * 100).toFixed(0)}% commission.`,
            ]),
          ]),
        ],
      ),
    ],
  );

  return {
    tree,
    options,
    rule_applied_id: SEND_GIFT_PANEL_RULE_ID,
  };
}

function renderGiftOption(opt: SendGiftOption, pointsAllowed: boolean): RenderElement {
  return el(
    'li',
    {
      test_id: `creator-control-send-gift-${opt.gift_id}`,
      classes: ['cnz-gift-card'],
      props: {
        gift_id: opt.gift_id,
        token_value: opt.token_value,
        rrr_points_price: opt.rrr_points_price,
      },
    },
    [
      el('span', { classes: ['cnz-gift-card__emoji'] }, [opt.emoji]),
      el('strong', { classes: ['cnz-gift-card__name'] }, [opt.display_name]),
      el('div', { classes: ['cnz-gift-card__pricing'] }, [
        el(
          'button',
          {
            test_id: `creator-control-send-gift-${opt.gift_id}-tokens`,
            classes: ['cnz-button', 'cnz-button--primary'],
            on: { click: 'sendGiftWithTokens' },
            props: {
              gift_id: opt.gift_id,
              token_value: opt.token_value,
              payment_method: 'TOKENS',
            },
          },
          [`${opt.token_value} CZT`],
        ),
        el(
          'button',
          {
            test_id: `creator-control-send-gift-${opt.gift_id}-points`,
            classes: [
              'cnz-button',
              pointsAllowed ? 'cnz-button--secondary' : 'cnz-button--disabled',
            ],
            on: { click: 'sendGiftWithPoints' },
            props: {
              gift_id: opt.gift_id,
              rrr_points_price: opt.rrr_points_price,
              payment_method: 'POINTS',
              disabled: !pointsAllowed,
            },
          },
          [`${opt.rrr_points_price} RRR pts`],
        ),
      ]),
    ],
  );
}
