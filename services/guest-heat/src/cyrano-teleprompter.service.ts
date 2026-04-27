// CYR: Cyrano Teleprompter Service — serial suggestion chains with smooth
// narrative flow for seasonal campaigns.
// Business Plan §B.3.5 — creator whisper copilot, extended campaign module.
//
// Contract:
//   • Maintains per-session chain state (ephemeral — in-process Map).
//   • Supports all fourteen seasonal campaigns with full suggestion chains.
//   • Advancing a chain emits GUEST_HEAT_TELEPROMPTER_ADVANCED on NATS.
//   • Chains complete gracefully — no wraparound; completed flag set.
//   • Beat (pause) durations are advisory — callers enforce timing.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  GUEST_HEAT_RULE_ID,
  type SeasonalCampaign,
  type TeleprompterChainState,
  type TeleprompterStep,
} from './guest-heat.types';

// ── Campaign suggestion chains ────────────────────────────────────────────────

const CAMPAIGN_CHAINS: Record<SeasonalCampaign, TeleprompterStep[]> = {
  VALENTINES: [
    { step_index: 0, suggestion: "Start with warmth — mention how special tonight feels.", beat_sec: 3 },
    { step_index: 1, suggestion: "Lean into the romance — ask what love means to them this Valentine's.", beat_sec: 5 },
    { step_index: 2, suggestion: "Share a secret — something you've never told anyone else.", beat_sec: 4 },
    { step_index: 3, suggestion: "Escalate the intimacy — tonight is about deep connection.", beat_sec: 6 },
    { step_index: 4, suggestion: "Invite them to send their virtual rose — keep the magic alive.", beat_sec: 3 },
    { step_index: 5, suggestion: "Close with gratitude — make them feel like the only one." },
  ],

  PRIDE: [
    { step_index: 0, suggestion: "Open with celebration — this is their month, honour it.", beat_sec: 3 },
    { step_index: 1, suggestion: "Ask their story — everyone's Pride journey is unique.", beat_sec: 5 },
    { step_index: 2, suggestion: "Affirm their identity — use their preferred terms, celebrate them.", beat_sec: 4 },
    { step_index: 3, suggestion: "Create space for joy — laughter and liberation together.", beat_sec: 4 },
    { step_index: 4, suggestion: "Invite them to share who they're celebrating Pride with tonight.", beat_sec: 3 },
    { step_index: 5, suggestion: "Close with solidarity — you're proud to share this space with them." },
  ],

  CARNAVAL: [
    { step_index: 0, suggestion: "Set the scene — Rio, Mardi Gras, Venice… where are they dreaming of?", beat_sec: 4 },
    { step_index: 1, suggestion: "Invite them into the fantasy — you're both in costume tonight.", beat_sec: 5 },
    { step_index: 2, suggestion: "Build rhythm — music, movement, the energy of the crowd.", beat_sec: 4 },
    { step_index: 3, suggestion: "Escalate the carnival heat — masks come off, inhibitions follow.", beat_sec: 6 },
    { step_index: 4, suggestion: "Peak with the parade — this is the moment the night was building to.", beat_sec: 5 },
    { step_index: 5, suggestion: "The final float — close with the memory they'll carry all year." },
  ],

  HALLOWEEN: [
    { step_index: 0, suggestion: "Set the mood — candlelight, shadows, something wicked this way comes.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask their costume — what character do they inhabit tonight?", beat_sec: 4 },
    { step_index: 2, suggestion: "Build suspense — every horror story needs a twist.", beat_sec: 5 },
    { step_index: 3, suggestion: "The reveal — something unexpected, something delicious.", beat_sec: 5 },
    { step_index: 4, suggestion: "Trick or treat — let them choose their fate tonight.", beat_sec: 4 },
    { step_index: 5, suggestion: "Close the crypt — until next October, keep them haunted by tonight." },
  ],

  OKTOBERFEST: [
    { step_index: 0, suggestion: "Prost! Toast the night — invite them to raise whatever they're drinking.", beat_sec: 3 },
    { step_index: 1, suggestion: "The biergarten energy — loud, warm, everyone is a friend.", beat_sec: 4 },
    { step_index: 2, suggestion: "Ask their Oktoberfest fantasy — Munich, lederhosen, pretzels?", beat_sec: 4 },
    { step_index: 3, suggestion: "The second round — things get looser, more honest.", beat_sec: 5 },
    { step_index: 4, suggestion: "The dance floor opens — oompah band, spinning together.", beat_sec: 4 },
    { step_index: 5, suggestion: "Last call — make this one count before the tent closes." },
  ],

  MARDI_GRAS: [
    { step_index: 0, suggestion: "Laissez les bons temps rouler — let the good times roll.", beat_sec: 3 },
    { step_index: 1, suggestion: "Bourbon Street — ask what they'd throw beads for tonight.", beat_sec: 4 },
    { step_index: 2, suggestion: "The float passes — build the crowd noise, the chaos, the colour.", beat_sec: 5 },
    { step_index: 3, suggestion: "Masquerade — behind the mask, who are they really?", beat_sec: 5 },
    { step_index: 4, suggestion: "Fat Tuesday peak — everything before Lent, savour it.", beat_sec: 5 },
    { step_index: 5, suggestion: "Midnight strikes — close with the promise of next year's carnival." },
  ],

  DIWALI: [
    { step_index: 0, suggestion: "Light a diya together — welcome the festival of lights.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask about their Diwali traditions — sweets, fireworks, family.", beat_sec: 5 },
    { step_index: 2, suggestion: "The darkness before the light — vulnerability makes the glow brighter.", beat_sec: 5 },
    { step_index: 3, suggestion: "Lakshmi's blessing — abundance, beauty, and shared prosperity.", beat_sec: 4 },
    { step_index: 4, suggestion: "The sky lights up — rockets, sparklers, the whole world celebrating.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with blessings — may their new year be luminous." },
  ],

  CHINESE_NEW_YEAR: [
    { step_index: 0, suggestion: "Gong Xi Fa Cai — open with abundance, red envelopes, prosperity.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask their zodiac — the Year of the Dragon, Tiger, Rabbit… who are they?", beat_sec: 5 },
    { step_index: 2, suggestion: "The lantern festival — wish-writing, paper boats on the river.", beat_sec: 5 },
    { step_index: 3, suggestion: "Dragon dance energy — build the tempo, the percussion, the parade.", beat_sec: 5 },
    { step_index: 4, suggestion: "The fireworks at midnight — the old year burns away.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with fortune — what does the new year hold for them?" },
  ],

  CINCO_DE_MAYO: [
    { step_index: 0, suggestion: "Salud! — margaritas and the battle of Puebla, celebrate resilience.", beat_sec: 3 },
    { step_index: 1, suggestion: "Ask their Mexico story — have they been? Where would they go?", beat_sec: 4 },
    { step_index: 2, suggestion: "Mariachi serenade — what song would they choose for tonight?", beat_sec: 4 },
    { step_index: 3, suggestion: "Street food and colour — invite them into the fiesta.", beat_sec: 4 },
    { step_index: 4, suggestion: "The dance — Jarabe Tapatío, salsa, whatever moves them.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with the last toast — this night belongs to them." },
  ],

  FOURTH_OF_JULY: [
    { step_index: 0, suggestion: "Fireworks open the sky — start with awe, with spectacle.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask where they're watching from — backyard, rooftop, lakeside?", beat_sec: 4 },
    { step_index: 2, suggestion: "Summer heat — long days, cold drinks, the smell of freedom.", beat_sec: 4 },
    { step_index: 3, suggestion: "The grand finale builds — what are they celebrating this year?", beat_sec: 5 },
    { step_index: 4, suggestion: "Patriotic peak — whatever it means to them, honour it.", beat_sec: 5 },
    { step_index: 5, suggestion: "The smoke clears — close with the quiet after the boom." },
  ],

  CHRISTMAS: [
    { step_index: 0, suggestion: "The fireplace crackles — open with warmth, nostalgia, coming home.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask their favourite Christmas memory — childhood, family, magic.", beat_sec: 5 },
    { step_index: 2, suggestion: "Gift exchange — what would they give, what do they secretly want?", beat_sec: 5 },
    { step_index: 3, suggestion: "Midnight Mass, or midnight mischief — let them choose.", beat_sec: 5 },
    { step_index: 4, suggestion: "Under the mistletoe — the moment everything becomes possible.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with new year's hope — wrap this night like the perfect gift." },
  ],

  THANKSGIVING: [
    { step_index: 0, suggestion: "What are you grateful for tonight? Open with gratitude.", beat_sec: 4 },
    { step_index: 1, suggestion: "Ask about their table — who are they thankful for this year?", beat_sec: 5 },
    { step_index: 2, suggestion: "The harvest — what did this year grow in them?", beat_sec: 5 },
    { step_index: 3, suggestion: "Abundance — there's more than enough joy to share tonight.", beat_sec: 4 },
    { step_index: 4, suggestion: "Pie and permission — tonight, they can have everything they want.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with a blessing — let them leave full in every way." },
  ],

  BIRTHDAY_WEEK: [
    { step_index: 0, suggestion: "Happy birthday! Make them feel like the only person in the world.", beat_sec: 3 },
    { step_index: 1, suggestion: "Ask about their birthday wish — the real one, not the one they said.", beat_sec: 5 },
    { step_index: 2, suggestion: "Celebrate them — this entire week belongs to them.", beat_sec: 4 },
    { step_index: 3, suggestion: "Birthday fantasy — what would their perfect celebration look like?", beat_sec: 5 },
    { step_index: 4, suggestion: "The cake moment — candles, wishes, the hush before the blow.", beat_sec: 5 },
    { step_index: 5, suggestion: "Close with a gift — make tonight the best birthday present they've received." },
  ],

  PLATFORM_ANNIVERSARY: [
    { step_index: 0, suggestion: "Celebrate the milestone — thank them for being part of this journey.", beat_sec: 4 },
    { step_index: 1, suggestion: "Recall a shared memory — something from their history on the platform.", beat_sec: 5 },
    { step_index: 2, suggestion: "How far they've both come — growth is worth honouring.", beat_sec: 4 },
    { step_index: 3, suggestion: "The future together — what are they building next?", beat_sec: 5 },
    { step_index: 4, suggestion: "Exclusive anniversary offer — reward their loyalty in the moment.", beat_sec: 4 },
    { step_index: 5, suggestion: "Close with recommitment — next year will be even better, together." },
  ],
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CyranoTeleprompterService {
  private readonly logger = new Logger(CyranoTeleprompterService.name);

  /** Ephemeral chain state — keyed by session_id. */
  private readonly chains = new Map<string, TeleprompterChainState>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Initialise a teleprompter chain for a session.
   * Any existing chain for the session is replaced.
   */
  startChain(
    session_id: string,
    creator_id: string,
    campaign: SeasonalCampaign,
  ): TeleprompterChainState {
    const steps = CAMPAIGN_CHAINS[campaign];
    const chain: TeleprompterChainState = {
      chain_id: randomUUID(),
      session_id,
      creator_id,
      campaign,
      steps,
      current_step_index: 0,
      started_at_utc: new Date().toISOString(),
      completed: false,
      rule_applied_id: GUEST_HEAT_RULE_ID,
    };

    this.chains.set(session_id, chain);
    this.logger.log('CyranoTeleprompterService: chain started', {
      chain_id: chain.chain_id,
      campaign,
      steps: steps.length,
    });
    return chain;
  }

  /**
   * Get the current suggestion for a session.
   * Returns null if no chain is active or chain is complete.
   */
  getCurrentSuggestion(session_id: string): TeleprompterStep | null {
    const chain = this.chains.get(session_id);
    if (!chain || chain.completed) return null;
    return chain.steps[chain.current_step_index] ?? null;
  }

  /**
   * Advance the chain to the next suggestion.
   * Emits GUEST_HEAT_TELEPROMPTER_ADVANCED on NATS.
   * Returns the new current step, or null if chain is completed.
   */
  advanceChain(session_id: string): TeleprompterStep | null {
    const chain = this.chains.get(session_id);
    if (!chain || chain.completed) return null;

    const next_index = chain.current_step_index + 1;
    if (next_index >= chain.steps.length) {
      chain.completed = true;
      chain.last_advanced_at_utc = new Date().toISOString();
      this.logger.log('CyranoTeleprompterService: chain completed', {
        chain_id: chain.chain_id,
        campaign: chain.campaign,
      });
      this.emitAdvanced(chain, null);
      return null;
    }

    chain.current_step_index = next_index;
    chain.last_advanced_at_utc = new Date().toISOString();

    const step = chain.steps[next_index];
    this.emitAdvanced(chain, step);

    this.logger.log('CyranoTeleprompterService: chain advanced', {
      chain_id: chain.chain_id,
      campaign: chain.campaign,
      step_index: next_index,
    });

    return step;
  }

  /**
   * Get the full chain state for a session.
   */
  getChainState(session_id: string): TeleprompterChainState | null {
    return this.chains.get(session_id) ?? null;
  }

  /**
   * List available campaign identifiers.
   */
  listCampaigns(): SeasonalCampaign[] {
    return Object.keys(CAMPAIGN_CHAINS) as SeasonalCampaign[];
  }

  /**
   * Reset chain to beginning without restarting.
   */
  resetChain(session_id: string): TeleprompterChainState | null {
    const chain = this.chains.get(session_id);
    if (!chain) return null;
    chain.current_step_index = 0;
    chain.completed = false;
    chain.last_advanced_at_utc = undefined;
    return chain;
  }

  /**
   * Clear chain on session close.
   */
  clearChain(session_id: string): void {
    this.chains.delete(session_id);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private emitAdvanced(
    chain: TeleprompterChainState,
    step: TeleprompterStep | null,
  ): void {
    this.nats.publish(NATS_TOPICS.GUEST_HEAT_TELEPROMPTER_ADVANCED, {
      chain_id: chain.chain_id,
      session_id: chain.session_id,
      creator_id: chain.creator_id,
      campaign: chain.campaign,
      step_index: chain.current_step_index,
      suggestion: step?.suggestion ?? null,
      beat_sec: step?.beat_sec ?? null,
      completed: chain.completed,
      advanced_at_utc: chain.last_advanced_at_utc,
      rule_applied_id: GUEST_HEAT_RULE_ID,
    } as unknown as Record<string, unknown>);
  }
}
