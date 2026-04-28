// CYR: Cyrano Session / Narrative Chat — UI view model contracts.
// These types mirror but do not import the service-layer narrative.types.ts;
// the presenter layer is responsible for translation.

export type SessionTier = 'SPARK' | 'FLAME' | 'INFERNO';

export type SessionStatus =
  | 'IDLE'       // No active session
  | 'ACTIVE'     // Session in progress
  | 'EXPIRING'   // <5 minutes remaining — top-up prompt surfaced
  | 'EXPIRED';   // Session ended; top-up required to continue

export type ChatMessageRole = 'twin' | 'user' | 'system';

export type BranchResolutionStatus = 'PENDING' | 'RESOLVED';

export interface TierBadge {
  tier: SessionTier;
  label: string;          // Display label e.g. "Spark", "Flame", "Inferno"
  css_class: string;      // e.g. "cnz-tier-badge--inferno"
}

export interface ChatMessage {
  message_id: string;
  role: ChatMessageRole;
  content: string;
  timestamp_utc: string;
  is_haptic?: boolean;    // True if this message triggered FFS heat / haptic event
}

export interface BranchOption {
  option_key: string;     // 'A' | 'B' | 'C'
  label: string;
  consequence_hint: string;
}

export interface ActiveBranchCard {
  branch_id: string;
  branch_title: string;
  decision_prompt: string;
  options: BranchOption[];
  status: BranchResolutionStatus;
}

export interface MemorySidebarEntry {
  memory_id: string;
  memory_type: 'FACT' | 'PREFERENCE' | 'EMOTION' | 'STORY_BEAT' | 'RELATIONSHIP' | 'SECRET';
  content_preview: string;  // truncated for sidebar display
  importance_score: number;
}

export interface SessionWalletBucket {
  bucket: 'purchased' | 'membership' | 'bonus';
  label: string;
  balance_tokens: string; // bigint as string
  spend_priority: number;
  will_drain_next: boolean;
}

export interface TopUpMinutesCta {
  visible: boolean;
  minutes_remaining: number;
  cta_label: string;
  cta_disabled: boolean;
}

export interface VoiceCallButton {
  available: boolean;
  label: string;
  disabled_reason: string | null;
}

/** Top-level view model consumed by renderCyranoSessionPage(). */
export interface CyranoSessionView {
  session_id: string;
  twin_id: string;
  user_id: string;
  twin_display_name: string;
  tier_badge: TierBadge;
  session_status: SessionStatus;
  minutes_remaining: number;
  messages: ChatMessage[];
  active_branch: ActiveBranchCard | null;
  memory_sidebar: MemorySidebarEntry[];
  wallet_buckets: SessionWalletBucket[];
  voice_call: VoiceCallButton;
  top_up_cta: TopUpMinutesCta;
  generated_at_utc: string;
  rule_applied_id: string;
}

/** Input shape accepted by renderCyranoSessionPage(). */
export interface CyranoSessionPageInputs {
  session_id: string;
  twin_id: string;
  user_id: string;
  twin_display_name: string;
  tier: SessionTier;
  session_status: SessionStatus;
  minutes_remaining: number;
  messages?: ChatMessage[];
  active_branch?: ActiveBranchCard | null;
  memory_sidebar?: MemorySidebarEntry[];
  wallet_buckets?: SessionWalletBucket[];
  voice_call_available?: boolean;
}
