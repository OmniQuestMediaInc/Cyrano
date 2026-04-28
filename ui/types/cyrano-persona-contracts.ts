// Screen 03 — Persona Management + Screen 04 — Session Top-Up contracts.
// Pure UI types — no service imports. Presenter layer translates service
// payloads into these shapes.

import type { WalletBucket } from './public-wallet-contracts';

// ── Screen 03 — Persona Management ──────────────────────────────────────────

/** Scope of a Cyrano persona in the inheritance hierarchy. */
export type PersonaScope = 'GLOBAL' | 'TEMPLATE' | 'CUSTOM';

/**
 * Minimum tier a VIP must hold to access a published persona.
 * 'OPEN' = any tier; 'HOT' = HOT+ only; 'INFERNO' = Inferno only.
 */
export type PersonaTierLock = 'OPEN' | 'HOT' | 'INFERNO';

/** Active tab selection on the persona management page. */
export type PersonaManagementTab = 'GLOBAL' | 'TEMPLATES' | 'MY_CUSTOM';

/** One card on the persona grid. */
export interface PersonaCard {
  persona_id: string;
  creator_id: string;
  display_name: string;
  /** Short tone descriptor — e.g. "playful_dominant". */
  tone: string;
  style_notes: string;
  scope: PersonaScope;
  tier_lock: PersonaTierLock;
  active: boolean;
  /** 1-based priority order used for drag-to-reorder. */
  sort_order: number;
  /** Whether the persona has been published and is visible to eligible VIPs. */
  published: boolean;
}

/** Aggregate view model for /creator/personas. */
export interface PersonaManagementView {
  creator_id: string;
  active_tab: PersonaManagementTab;
  /** Filtered + sorted card list for the active tab. */
  personas: PersonaCard[];
  generated_at_utc: string;
  rule_applied_id: string;
}

// ── Screen 04 — Session Top-Up & Recovery ───────────────────────────────────

/** State machine for a VIP Cyrano session. */
export type SessionLifecycleState =
  | 'GRANTED'
  | 'DECREMENTING'
  | 'EXPIRED'
  | 'TOP_UP_PURCHASED'
  | 'RESUMED';

/** Bucket of a top-up SKU — time minutes, voice add-on, or narrative package. */
export type TopUpSkuType = 'TIME' | 'VOICE' | 'NARRATIVE';

/** One purchasable top-up SKU shown in the recommendation row. */
export interface TopUpSku {
  sku_id: string;
  label: string;
  sku_type: TopUpSkuType;
  minutes_granted: number;
  price_tokens: number;
  /** USD display price for receipts. */
  price_usd: number;
}

/** Wallet bucket row in the three-bucket selector on the top-up page. */
export interface TopUpWalletBucketRow {
  bucket: WalletBucket;
  balance_tokens: number;
  spend_priority: number;
  label: string;
  /** Whether this bucket has enough balance to cover the selected SKU. */
  sufficient: boolean;
}

/** Aggregate view model for /diamond/session-topup. */
export interface SessionTopUpView {
  session_id: string;
  vip_id: string;
  lifecycle_state: SessionLifecycleState;
  remaining_minutes: number;
  recommended_skus: TopUpSku[];
  wallet_buckets: TopUpWalletBucketRow[];
  /** SKU selected by the VIP — null until they pick one. */
  selected_sku_id: string | null;
  /** Wallet bucket the VIP chose to pay from — null until selected. */
  selected_bucket: WalletBucket | null;
  /** Whether Purchase & Resume is enabled (sku + bucket both chosen + sufficient). */
  can_purchase: boolean;
  generated_at_utc: string;
  rule_applied_id: string;
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
