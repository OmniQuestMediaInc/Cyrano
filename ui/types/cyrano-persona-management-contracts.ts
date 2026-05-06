// Screen 03 v2 — Persona Management (Creator + VIP) UI contracts.
// CyranoPersona scope hierarchy: global → template → per-VIP custom.
// Rendered on /creator/cyrano/personas.
//
// Note: this is the v2 contracts module for the `/creator/cyrano/personas`
// route. The v1 contracts in `cyrano-persona-contracts.ts` use UPPERCASE
// scope literals and remain in use by `/creator/personas`.

import type { MembershipTier } from './session-topup-contracts';

/** Which scope level a persona belongs to. */
export type CyranoPersonaScope = 'global' | 'template' | 'custom';

/**
 * Tier gate on a persona's publish visibility.
 * null = visible to all eligible VIPs (no additional restriction).
 * A MembershipTier value = visible only at that tier or above.
 */
export type CyranoPersonaTierLock = MembershipTier | null;

/** One persona card as rendered in the management grid. */
export interface CyranoPersonaCard {
  persona_id: string;
  creator_id: string;
  display_name: string;
  /** Relative URL or null when no avatar has been uploaded. */
  avatar_url: string | null;
  tone: string;
  style_notes: string;
  scope: CyranoPersonaScope;
  /** Tier required to interact with this persona as a VIP guest. */
  tier_lock: CyranoPersonaTierLock;
  active: boolean;
  /** 1-based display order within the scope tab; controls drag-to-reorder. */
  sort_order: number;
  /** Whether this persona has been published to the Zone (tier-gated). */
  published: boolean;
}

/** The active tab on the Persona Management page. */
export type CyranoPersonaManagementTab = CyranoPersonaScope;

/** Inputs to the Persona Management page render function. */
export interface PersonaManagementPageInputs {
  creator_id: string;
  /** Which tab is currently selected. */
  active_tab: CyranoPersonaManagementTab;
  global_personas: CyranoPersonaCard[];
  template_personas: CyranoPersonaCard[];
  custom_personas: CyranoPersonaCard[];
}

/** Shape returned by renderPersonaManagementPage. */
export interface PersonaManagementPageView {
  creator_id: string;
  active_tab: CyranoPersonaManagementTab;
  active_personas: CyranoPersonaCard[];
  total_global: number;
  total_templates: number;
  total_custom: number;
}
