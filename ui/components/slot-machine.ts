// PAYLOAD G1 — Slot Machine render plan.

import { el, RenderElement } from './render-plan';
import { renderHoldRelease } from './wheel-of-fortune';
import type {
  PrizePoolEntryViewModel,
  PaymentMethod,
} from '../types/gamification-contracts';

export interface SlotMachineInputs {
  creator_id: string;
  entries: PrizePoolEntryViewModel[];
  selected_token_tier: number;
  selected_payment: PaymentMethod;
  ready: boolean;
  cooldown_message: string | null;
}

export function renderSlotMachine(inputs: SlotMachineInputs): RenderElement {
  const symbols = inputs.entries.slice(0, 8); // visual symbol set capped at 8

  return el(
    'section',
    {
      test_id: 'game-slot-machine',
      classes: ['cnz-game', 'cnz-game--slots'],
      aria: { 'aria-label': 'Slot Machine' },
      props: {
        creator_id: inputs.creator_id,
        token_tier: inputs.selected_token_tier,
        payment_method: inputs.selected_payment,
      },
    },
    [
      el('h2', {}, ['Slot Machine']),
      el(
        'div',
        { classes: ['cnz-slots__reels'] },
        ['reel1', 'reel2', 'reel3'].map((reel) =>
          el(
            'div',
            {
              test_id: `game-slot-${reel}`,
              classes: ['cnz-slots__reel'],
              props: { reel_id: reel, symbol_count: symbols.length },
            },
            symbols.map((s, i) =>
              el(
                'span',
                {
                  test_id: `game-slot-${reel}-symbol-${i}`,
                  classes: ['cnz-slots__symbol', `cnz-rarity-${s.rarity.toLowerCase()}`],
                  props: { rarity: s.rarity, prize_slot: s.prize_slot },
                },
                [s.name],
              ),
            ),
          ),
        ),
      ),
      renderHoldRelease({
        test_id: 'game-slot-pull-button',
        label: inputs.ready
          ? 'Hold to pull'
          : (inputs.cooldown_message ?? 'Cooling down'),
        disabled: !inputs.ready,
        on_release: 'slotPullRelease',
        require_shake: false,
      }),
    ],
  );
}
