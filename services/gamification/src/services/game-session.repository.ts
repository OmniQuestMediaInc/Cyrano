// services/gamification/src/services/game-session.repository.ts
// Persistence contract for game_sessions inserts. Production wires Prisma;
// tests inject an in-memory implementation.

import type { GameType, PaymentMethod } from '../types/gamification.types';

export interface GameSessionRecord {
  session_id: string;
  user_id: string;
  creator_id: string;
  game_type: GameType;
  token_tier: number;
  tokens_paid: number;
  ledger_entry_id: string | null;
  outcome: Record<string, unknown>;
  prize_awarded: string;
  prize_table_version: string;
  idempotency_key: string;
  rule_applied_id: string;
  created_at_utc: string;
  payment_method: PaymentMethod;
  rrr_burn_id: string | null;
}

export interface GameSessionRepository {
  insert(record: GameSessionRecord): Promise<void>;
  findByIdempotencyKey(key: string): Promise<GameSessionRecord | null>;
  /** Returns history ordered by created_at_utc DESC, capped at 100. */
  listForUserCreator(user_id: string, creator_id: string): Promise<GameSessionRecord[]>;
}
