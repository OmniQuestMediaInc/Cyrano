// finance/token-extension.service.ts
// FIZ: TokenExtensionService — Token Extension product (Option A pathway)
// FIZ-002-REVISION-2026-04-11: Renamed from DisputeResolutionService.
// Three-Fifths Exit cash refund path removed. No cash refund path exists on the platform.
// Doctrine: Append-Only — original purchase entry is NEVER deleted or modified.
// All extension actions produce NEW ledger entries via LedgerService.handleDisputeReversal().
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export type DisputeStage = 'OPEN' | 'TOKEN_BRIDGE_OFFERED' | 'RESOLVED';

export interface DisputeRecord {
  dispute_id: string;
  user_id: string;
  original_transaction_ref: string;
  original_amount_cents: bigint;
  stage: DisputeStage;
  rule_applied_id: string;
  opened_at_utc: string;
  resolved_at_utc?: string;
  resolution_type?: 'TOKEN_BRIDGE' | 'POLICY_UPHELD';
  audit_hash: string;
}

export interface DisputeResolutionResult {
  success: boolean;
  new_stage: DisputeStage;
  offer?: {
    type: 'TOKEN_BRIDGE';
    bonus_tokens?: bigint;           // For TOKEN_BRIDGE offer
  };
  requires_step_up: boolean;
  ledger_entry_ref?: string;
  message: string;
}

/**
 * TokenExtensionService — Token Extension Option A Pathway
 *
 * Option A (TOKEN_BRIDGE): 20% bonus tokens on remaining balance in exchange
 *                          for signed waiver. Soft offer. No ledger credit yet.
 *
 * Token Extension is a paid commercial product for expired tokens.
 * Not a refund. Not a grace period. Extension fee framing only.
 * All actions are append-only via LedgerService. Original purchase never touched.
 * Requires step-up auth (stepUpToken presence) before executing any money movement.
 */
@Injectable()
export class TokenExtensionService {
  private readonly logger = new Logger(TokenExtensionService.name);
  private readonly RULE_ID = 'TOKEN_EXTENSION_v1';
  private readonly TOKEN_BRIDGE_BONUS_PCT = 0.20;   // 20% bonus tokens

  /**
   * Stage 1: Offer the Token Bridge.
   * Computes 20% bonus token offer. Does NOT credit ledger yet.
   * Returns offer details for display to guest. Human must confirm acceptance.
   */
  offerTokenBridge(params: {
    dispute_id: string;
    user_id: string;
    remaining_token_balance: bigint;
    original_amount_cents: bigint;
  }): DisputeResolutionResult {
    const bonus_tokens = BigInt(Math.floor(
      Number(params.remaining_token_balance) * this.TOKEN_BRIDGE_BONUS_PCT
    ));

    this.logger.log('TokenExtensionService: TOKEN_BRIDGE offer computed', {
      dispute_id: params.dispute_id,
      user_id: params.user_id,
      bonus_tokens: bonus_tokens.toString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      success: true,
      new_stage: 'TOKEN_BRIDGE_OFFERED',
      offer: { type: 'TOKEN_BRIDGE', bonus_tokens },
      requires_step_up: false,
      message: `Offer: ${bonus_tokens} bonus tokens (20% of remaining balance) in exchange for a signed dispute waiver. Account remains active.`,
    };
  }

  /** Utility: generate a deterministic audit hash for a dispute event. */
  static computeAuditHash(dispute_id: string, stage: DisputeStage, timestamp_utc: string): string {
    return createHash('sha256')
      .update(`${dispute_id}:${stage}:${timestamp_utc}`)
      .digest('hex');
  }
}
