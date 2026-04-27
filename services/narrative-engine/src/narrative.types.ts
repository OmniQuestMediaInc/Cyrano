// services/narrative-engine/src/narrative.types.ts
// CYR: Narrative Engine — persistent memory + cinematic branching type definitions

export type MemoryType =
  | 'FACT'         // Hard fact about the user stated in conversation
  | 'PREFERENCE'   // User preference learned over time
  | 'EMOTION'      // Emotional state / tone cue
  | 'STORY_BEAT'   // Key moment in the narrative arc
  | 'RELATIONSHIP' // Relationship development milestone
  | 'SECRET';      // Revealed secret / confession

export type BranchDecision = 'ACCEPT' | 'REJECT' | 'DEFER';

export interface MemoryEntry {
  memory_id: string;
  session_id: string;
  twin_id: string;
  user_id: string;
  memory_type: MemoryType;
  content: string;
  importance_score: number; // 0.0 – 1.0; used for recall prioritisation
  created_at_utc: string;
  expires_at_utc: string | null;
}

export interface NarrativeBranch {
  branch_id: string;
  twin_id: string;
  user_id: string;
  branch_title: string;
  branch_premise: string;
  decision_prompt: string;
  options: BranchOption[];
  created_at_utc: string;
}

export interface BranchOption {
  option_key: string; // e.g. 'A', 'B', 'C'
  label: string;
  consequence_hint: string; // Shown to user — teases next story direction
}

export interface BranchResolution {
  branch_id: string;
  chosen_option_key: string;
  decision: BranchDecision;
  narrative_consequence: string; // Written into memory bank as STORY_BEAT
  resolved_at_utc: string;
}

export interface BuildContextRequest {
  twin_id: string;
  user_id: string;
  current_message: string;
  max_memory_entries?: number; // Default 20 — top by importance_score
}

export interface NarrativeContext {
  twin_id: string;
  user_id: string;
  recalled_memories: MemoryEntry[];
  active_branch: NarrativeBranch | null;
  persona_prompt_injection: string; // Assembled context string for the LLM
}
