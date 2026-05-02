// PAYLOAD G1 — Slot Machine render plan.
//
// @retired — RETIRED across OQMI properties (CEO directive 2026-05-02 via
// docs/UX_INTEGRATION_BRIEF.md §8). Slot machine has no place in the
// product. Presenter is a throw-stub: any caller surfaces a clear runtime
// error, preventing accidental render. SLOT_MACHINE remains on the
// gamification-contracts.ts GameType enum for backend type-compat only
// (the service DTO still emits it on inventory queries) and is marked
// @deprecated there.
//
// Wheel of Fortune (./wheel-of-fortune.ts) and Dice (./dice-game.ts) are
// the in-scope gamification UI surfaces. See docs/UX_INTEGRATION_BRIEF.md §8.

import type { RenderElement } from './render-plan';
import type { PrizePoolEntryViewModel, PaymentMethod } from '../types/gamification-contracts';

export interface SlotMachineInputs {
  creator_id: string;
  entries: PrizePoolEntryViewModel[];
  selected_token_tier: number;
  selected_payment: PaymentMethod;
  ready: boolean;
  cooldown_message: string | null;
}

/**
 * @retired — see file header. Throws on call.
 * Type signature retained for compile-time compatibility with any historical
 * import; runtime invocation is blocked by design.
 */
export function renderSlotMachine(_inputs: SlotMachineInputs): RenderElement {
  throw new Error(
    '[RETIRED] Slot machine has been retired across OQMI properties ' +
      '(CEO directive 2026-05-02). See docs/UX_INTEGRATION_BRIEF.md §8. ' +
      'Use renderSpinWheel or renderDiceGame instead.',
  );
}
