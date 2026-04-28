// Screen 03 — Persona Management (Creator + VIP) UI contracts.
// CyranoPersona scope hierarchy: global → template → per-VIP custom.
// Rendered on /creator/cyrano/personas.

import type { MembershipTier } from './session-topup-contracts';

/** Which scope level a persona belongs to. */
export type PersonaScope = 'global' | 'template' | 'custom';

/**
 * Tier gate on a persona's publish visibility.
 * null = visible to all eligible VIPs (no additional restriction).
 * A MembershipTier value = visible only at that tier or above.
 */
export type PersonaTierLock = MembershipTier | null;

/** One persona card as rendered in the management grid. */
export interface CyranoPersonaCard {
  persona_id: string;
  creator_id: string;
  display_name: string;
  /** Relative URL or null when no avatar has been uploaded. */
  avatar_url: string | null;
  tone: string;
  style_notes: string;
  scope: PersonaScope;
  /** Tier required to interact with this persona as a VIP guest. */
  tier_lock: PersonaTierLock;
  active: boolean;
  /** 1-based display order within the scope tab; controls drag-to-reorder. */
  sort_order: number;
  /** Whether this persona has been published to the Zone (tier-gated). */
  published: boolean;
}

/** The active tab on the Persona Management page. */
export type PersonaManagementTab = PersonaScope;

/** Inputs to the Persona Management page render function. */
export interface PersonaManagementPageInputs {
  creator_id: string;
  /** Which tab is currently selected. */
  active_tab: PersonaManagementTab;
  global_personas: CyranoPersonaCard[];
  template_personas: CyranoPersonaCard[];
  custom_personas: CyranoPersonaCard[];
}

/** Shape returned by renderPersonaManagementPage. */
export interface PersonaManagementPageView {
  creator_id: string;
  active_tab: PersonaManagementTab;
  active_personas: CyranoPersonaCard[];
  total_global: number;
  total_templates: number;
  total_custom: number;
}
