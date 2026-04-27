// PAYLOAD G1 — Wheel of Fortune render plan.
// Renders an SVG wheel with one segment per active prize entry. The "spin"
// button is a hold-and-release control: client-side adapter records pointerdown
// → pointerup, with optional shake telemetry, then POSTs /gamification/play.

import { el, RenderElement } from './render-plan';
import type {
  PrizePoolEntryViewModel,
  PaymentMethod,
} from '../types/gamification-contracts';

export interface WheelOfFortuneInputs {
  creator_id: string;
  entries: PrizePoolEntryViewModel[];
  selected_token_tier: number;
  selected_payment: PaymentMethod;
  ready: boolean;                  // false when in cooldown
  cooldown_message: string | null; // e.g. "Next spin in 12s"
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: 'var(--cnz-rarity-common)',
  RARE: 'var(--cnz-rarity-rare)',
  EPIC: 'var(--cnz-rarity-epic)',
  LEGENDARY: 'var(--cnz-rarity-legendary)',
};

export function renderWheelOfFortune(inputs: WheelOfFortuneInputs): RenderElement {
  const { entries, ready, cooldown_message } = inputs;
  const segCount = Math.max(entries.length, 1);
  const arc = 360 / segCount;

  return el(
    'section',
    {
      test_id: 'game-wheel-of-fortune',
      classes: ['cnz-game', 'cnz-game--wheel'],
      aria: { 'aria-label': 'Wheel of Fortune' },
      props: {
        creator_id: inputs.creator_id,
        token_tier: inputs.selected_token_tier,
        payment_method: inputs.selected_payment,
      },
    },
    [
      el('h2', {}, ['Wheel of Fortune']),
      el(
        'svg',
        {
          test_id: 'game-wheel-svg',
          classes: ['cnz-wheel__svg'],
          props: { viewBox: '-100 -100 200 200', role: 'img' },
        },
        entries.map((entry, i) =>
          el(
            'g',
            {
              test_id: `game-wheel-segment-${entry.prize_slot}`,
              classes: ['cnz-wheel__segment'],
              props: {
                prize_slot: entry.prize_slot,
                rarity: entry.rarity,
                start_deg: i * arc,
                end_deg: (i + 1) * arc,
                fill: RARITY_COLOR[entry.rarity] ?? 'var(--cnz-rarity-common)',
              },
            },
            [el('title', {}, [`${entry.name} (${entry.rarity})`])],
          ),
        ),
      ),
      renderHoldRelease({
        test_id: 'game-wheel-spin-button',
        label: ready ? 'Hold to spin' : (cooldown_message ?? 'Cooling down'),
        disabled: !ready,
        on_release: 'wheelSpinRelease',
        require_shake: false,
      }),
    ],
  );
}

export interface HoldReleaseAttrs {
  test_id: string;
  label: string;
  disabled: boolean;
  on_release: string;
  require_shake: boolean;
}

/** Hold-and-release button shared by all three games. */
export function renderHoldRelease(attrs: HoldReleaseAttrs): RenderElement {
  return el(
    'button',
    {
      test_id: attrs.test_id,
      classes: [
        'cnz-button',
        'cnz-button--hold',
        attrs.disabled ? 'cnz-button--disabled' : 'cnz-button--primary',
      ],
      on: {
        pointerdown: 'gamePlayPointerDown',
        pointerup: attrs.on_release,
        pointercancel: 'gamePlayPointerCancel',
      },
      props: { disabled: attrs.disabled, require_shake: attrs.require_shake },
      aria: {
        'aria-disabled': String(attrs.disabled),
        'aria-label': attrs.label,
      },
    },
    [attrs.label],
  );
}
