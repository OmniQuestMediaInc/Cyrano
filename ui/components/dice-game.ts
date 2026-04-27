// PAYLOAD G1 — Dice Game render plan with mouse-shake interaction.
// While the user holds the button, the client adapter samples mouse-move
// events and computes (duration_ms, samples, avg_amplitude_px). On release
// the payload is POSTed to /gamification/play with the shake_proof.

import { el, RenderElement } from './render-plan';
import { renderHoldRelease } from './wheel-of-fortune';
import type {
  PrizePoolEntryViewModel,
  PaymentMethod,
} from '../types/gamification-contracts';

export interface DiceGameInputs {
  creator_id: string;
  entries: PrizePoolEntryViewModel[];
  selected_token_tier: number;
  selected_payment: PaymentMethod;
  ready: boolean;
  cooldown_message: string | null;
}

export function renderDiceGame(inputs: DiceGameInputs): RenderElement {
  const slot_to_entry = new Map(inputs.entries.map((e) => [e.prize_slot, e]));

  return el(
    'section',
    {
      test_id: 'game-dice',
      classes: ['cnz-game', 'cnz-game--dice'],
      aria: { 'aria-label': 'Dice Game' },
      props: {
        creator_id: inputs.creator_id,
        token_tier: inputs.selected_token_tier,
        payment_method: inputs.selected_payment,
      },
    },
    [
      el('h2', {}, ['Dice (2d6)']),
      el(
        'div',
        { classes: ['cnz-dice__board'] },
        Array.from({ length: 11 }, (_, i) => i + 2).map((sum) => {
          const entry = slot_to_entry.get(String(sum));
          return el(
            'span',
            {
              test_id: `game-dice-slot-${sum}`,
              classes: [
                'cnz-dice__slot',
                entry ? `cnz-rarity-${entry.rarity.toLowerCase()}` : 'cnz-dice__slot--empty',
              ],
              props: {
                sum,
                rarity: entry?.rarity ?? null,
                prize_name: entry?.name ?? null,
              },
            },
            [String(sum), entry ? ` — ${entry.name}` : ''],
          );
        }),
      ),
      renderHoldRelease({
        test_id: 'game-dice-roll-button',
        label: inputs.ready
          ? 'Hold + shake to roll'
          : (inputs.cooldown_message ?? 'Cooling down'),
        disabled: !inputs.ready,
        on_release: 'diceRollRelease',
        require_shake: true,                  // dice REQUIRES shake telemetry
      }),
    ],
  );
}
