// PAYLOAD 5+ — Cyrano shared prompt-template engine
// Phase 3.11 — Layers 1, 2, 3, and 4 share this template surface so the same
// (category, domain, tier) tuple resolves to the same baseline copy across
// runtimes. Concrete services may override individual lines via persona
// presets, but the canonical templates live here.

import type { CyranoCategory, CyranoDomain } from './cyrano.types';

export type CyranoTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

export interface CyranoPromptKey {
  category: CyranoCategory;
  domain: CyranoDomain;
  tier: CyranoTier;
}

export type CyranoPromptTemplate = (vars: { tone: string; tier: CyranoTier }) => string;

const ADULT_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open warmly — acknowledge the guest by name and set an expectation for this session.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Keep the flow — ask one open question tied to their last reply.`,
  CAT_ESCALATION: ({ tone, tier }) =>
    `[${tone}] The room is ${tier}. Escalate intimacy with a direct, on-brand line.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Reinforce the arc — reference the throughline you set up earlier.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Call back a detail from prior sessions to cement the bond.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Soft check-in — invite them to tell you what would make tonight memorable.`,
  CAT_MONETIZATION: ({ tone, tier }) =>
    `[${tone}] Make a confident, specific offer that matches room heat (${tier}).`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Close with anchored intimacy — name the highlight and hint at next time.`,
};

const TEACHING_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open with the learning objective and invite the student to set their own goal for the session.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Probe understanding — ask one diagnostic question rooted in the student's last attempt.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Tie the current concept back to a previously mastered skill.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference the student's earlier breakthrough to anchor confidence.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Reset gently — offer a worked example before the next attempt.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Recap the takeaway and surface one practice item for the next session.`,
};

const COACHING_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open with a one-sentence check-in: "What's the most important thing for today?"`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Reflect back the client's stated outcome before moving to the next question.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Surface the pattern across the last few sessions — name what you're noticing.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference the commitment made last session and ask what changed.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Slow down — invite the client to take 30 seconds before answering.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Lock the next concrete commitment and book the next session.`,
};

const FIRST_RESPONDER_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm scene safety and run a structured handoff briefing.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask the next decision-tree question (PLAN-A vs PLAN-B fork).`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Anchor the call narrative — restate the working hypothesis for the team.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference the last similar incident and the SOP that applied.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Pause for tactical breathing — re-establish situational awareness.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Run the post-incident debrief checklist; capture lessons-learned.`,
};

const FACTORY_SAFETY_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm PPE check and review the shift's hazard register.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask the operator to verbalise the next checkpoint before action.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Reinforce the shift narrative — restate the production goal and the safety margin.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference last shift's near-miss and the corrective action taken.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Halt the line — re-check the lockout/tagout state.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Capture the end-of-shift safety report.`,
};

/**
 * Non-adult template overlay for the ADULT_ENTERTAINMENT domain. When an
 * adult-domain tenant flips to `content_mode = 'non_adult'` (e.g. a creator
 * preparing a streaming-safe demo), Layer 4 swaps in this overlay so
 * adult-only categories stay suppressed and engagement/narrative copy
 * remains contextual without explicit intimacy cues.
 */
const ADULT_DOMAIN_NON_ADULT_OVERLAY: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open warmly — greet the guest and frame this session as a stream-safe conversation.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Keep the flow — ask one open, stream-safe question tied to their last reply.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Reinforce the throughline without intimacy cues — keep the arc story-led.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Call back a non-intimate detail from the prior session.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Soft check-in — invite them to share what they want from the next 5 minutes.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Close warmly with a stream-safe sign-off and a hint at next time.`,
};

const MEDICAL_TEMPLATES: Partial<Record<CyranoCategory, CyranoPromptTemplate>> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Confirm patient identity and consent before introducing the agenda.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask one open question to invite the patient's perspective.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Connect the current finding to the patient's stated goal.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference last visit's plan and check adherence.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Acknowledge difficulty before suggesting the next step.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Summarise the plan and confirm the next-step instructions are understood.`,
};

const TEMPLATES_BY_DOMAIN: Record<CyranoDomain, Partial<Record<CyranoCategory, CyranoPromptTemplate>>> = {
  ADULT_ENTERTAINMENT: ADULT_TEMPLATES,
  TEACHING: TEACHING_TEMPLATES,
  COACHING: COACHING_TEMPLATES,
  FIRST_RESPONDER: FIRST_RESPONDER_TEMPLATES,
  FACTORY_SAFETY: FACTORY_SAFETY_TEMPLATES,
  MEDICAL: MEDICAL_TEMPLATES,
};

/**
 * Resolve a prompt template for a (category, domain, tier) triple. Returns
 * `null` when the domain has intentionally suppressed the category (for
 * instance: ESCALATION/MONETIZATION are absent from non-adult domains).
 */
export function resolvePromptTemplate(key: CyranoPromptKey): CyranoPromptTemplate | null {
  const domainTemplates = TEMPLATES_BY_DOMAIN[key.domain];
  return domainTemplates[key.category] ?? null;
}

/**
 * Layer 4 specialised resolver. Adds the `content_mode` axis: an
 * ADULT_ENTERTAINMENT domain may serve `adult` OR `non_adult` templates;
 * every other domain is forced to `non_adult`. Adult-only categories
 * (ESCALATION, MONETIZATION) are NEVER served when `content_mode` is
 * `non_adult` even if the domain technically has them defined.
 */
export type CyranoLayer4ContentModeTemplate = 'adult' | 'non_adult';

export interface CyranoLayer4PromptKey extends CyranoPromptKey {
  content_mode: CyranoLayer4ContentModeTemplate;
}

const ADULT_ONLY_CATEGORIES: readonly CyranoCategory[] = [
  'CAT_ESCALATION',
  'CAT_MONETIZATION',
] as const;

/**
 * Layer 4 extension-point registry. Tenants (or platform plug-ins) can
 * register a non-adult domain overlay that takes priority over the
 * canonical domain templates. The registry is keyed by
 * `${domain}::${content_mode}::${category}` so a single tenant can plug
 * in surgical overrides without touching the canonical templates above.
 *
 * The registry is intentionally module-scoped — Layer 4 is the only
 * caller, and persistence across processes is out-of-scope for v1
 * (a platform-level governance config table replaces it in v2).
 */
const LAYER4_DOMAIN_OVERLAYS = new Map<string, CyranoPromptTemplate>();

function overlayKey(
  domain: CyranoDomain,
  content_mode: 'adult' | 'non_adult',
  category: CyranoCategory,
): string {
  return `${domain}::${content_mode}::${category}`;
}

/**
 * Register a non-adult overlay template for a (domain, category) pair.
 * Adult-only categories are silently rejected (no override path).
 */
export function registerLayer4DomainOverlay(args: {
  domain: CyranoDomain;
  content_mode: 'adult' | 'non_adult';
  category: CyranoCategory;
  template: CyranoPromptTemplate;
}): boolean {
  if (
    args.content_mode === 'non_adult' &&
    (ADULT_ONLY_CATEGORIES as readonly CyranoCategory[]).includes(args.category)
  ) {
    return false;
  }
  LAYER4_DOMAIN_OVERLAYS.set(
    overlayKey(args.domain, args.content_mode, args.category),
    args.template,
  );
  return true;
}

/** Test seam — clear all overlays. */
export function _resetLayer4DomainOverlays(): void {
  LAYER4_DOMAIN_OVERLAYS.clear();
}

/** Domain-neutral fallback applied when the domain template pack is silent. */
const NEUTRAL_FALLBACKS: Record<CyranoCategory, CyranoPromptTemplate> = {
  CAT_SESSION_OPEN: ({ tone }) =>
    `[${tone}] Open the session — set context and confirm the participant is ready.`,
  CAT_ENGAGEMENT: ({ tone }) =>
    `[${tone}] Ask one open question to keep the conversation moving forward.`,
  CAT_ESCALATION: ({ tone }) =>
    `[${tone}] Raise the urgency level — name the priority and request explicit acknowledgement.`,
  CAT_NARRATIVE: ({ tone }) =>
    `[${tone}] Restate the goal of this session in one sentence to anchor the participant.`,
  CAT_CALLBACK: ({ tone }) =>
    `[${tone}] Reference an earlier moment in the session to reinforce continuity.`,
  CAT_RECOVERY: ({ tone }) =>
    `[${tone}] Slow the pace and offer the participant space to reset.`,
  CAT_MONETIZATION: ({ tone }) =>
    `[${tone}] Surface the next paid action with a clear, specific call.`,
  CAT_SESSION_CLOSE: ({ tone }) =>
    `[${tone}] Close the session — summarise the takeaway and confirm the next step.`,
};

export function resolveLayer4PromptTemplate(
  key: CyranoLayer4PromptKey,
): CyranoPromptTemplate | null {
  // Hard guard: adult-only categories require content_mode = adult.
  if (
    key.content_mode === 'non_adult' &&
    (ADULT_ONLY_CATEGORIES as readonly CyranoCategory[]).includes(key.category)
  ) {
    return null;
  }

  // Hard guard: non-adult domains can never resolve the ADULT template
  // pack regardless of content_mode (defence-in-depth).
  if (key.domain !== 'ADULT_ENTERTAINMENT' && key.content_mode === 'adult') {
    return null;
  }

  // Tenant / plug-in overlay takes priority over canonical templates.
  const override = LAYER4_DOMAIN_OVERLAYS.get(
    overlayKey(key.domain, key.content_mode, key.category),
  );
  if (override) return override;

  // ADULT_ENTERTAINMENT in non-adult mode → use the explicit overlay.
  if (key.domain === 'ADULT_ENTERTAINMENT' && key.content_mode === 'non_adult') {
    return (
      ADULT_DOMAIN_NON_ADULT_OVERLAY[key.category] ??
      NEUTRAL_FALLBACKS[key.category] ??
      null
    );
  }

  // Domain-specific template, then domain-neutral fallback. Adult-only
  // categories never reach the neutral fallback (already filtered above).
  const dedicated = resolvePromptTemplate(key);
  if (dedicated) return dedicated;
  return NEUTRAL_FALLBACKS[key.category] ?? null;
}
