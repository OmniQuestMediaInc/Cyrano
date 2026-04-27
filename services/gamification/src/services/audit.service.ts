// services/gamification/src/services/audit.service.ts
// Append-only audit adapter: every play emits a row to immutable_audit_events
// with reason_code=GAME_PLAY and correlation_id linking the wallet debit (or
// RRR burn) to the resolved outcome.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PlayRecord } from '../types/gamification.types';

export interface AuditEventRow {
  event_id: string;
  user_id: string;
  creator_id: string;
  reason_code: 'GAME_PLAY';
  correlation_id: string;
  payload: Record<string, unknown>;
  occurred_at_utc: string;
}

export interface AuditRepository {
  insert(row: AuditEventRow): Promise<void>;
}

@Injectable()
export class GameAuditService {
  private readonly logger = new Logger(GameAuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async recordPlay(record: PlayRecord, correlation_id: string): Promise<AuditEventRow> {
    const row: AuditEventRow = {
      event_id: randomUUID(),
      user_id: record.user_id,
      creator_id: record.creator_id,
      reason_code: 'GAME_PLAY',
      correlation_id,
      payload: {
        session_id: record.session_id,
        game_type: record.game_type,
        token_tier: record.token_tier,
        payment_method: record.payment_method,
        tokens_paid: record.tokens_paid,
        rrr_burn_id: record.rrr_burn_id,
        ledger_entry_id: record.ledger_entry_id,
        prize_slot: record.prize_slot,
        prize_name: record.prize_name,
        rarity: record.rarity,
        outcome_data: record.outcome_data,
        idempotency_key: record.idempotency_key,
        rule_applied_id: record.rule_applied_id,
      },
      occurred_at_utc: record.resolved_at_utc,
    };
    await this.repo.insert(row);
    this.logger.debug('GameAuditService: audit row written', {
      event_id: row.event_id,
      session_id: record.session_id,
    });
    return row;
  }
}
