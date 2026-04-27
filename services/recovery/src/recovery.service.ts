// PAYLOAD 2 — REDBOOK Unified CS Recovery Engine
// Implements REDBOOK §5 Three Pillars + Happy-Path dispute flow.
// Append-only audit trail per OQMI Doctrine Invariant #1.
// NO writes to prisma/schema.prisma or ledger.service.ts (Payload 1 owned).
// Financial side-effects are gated — this service produces offers + audit rows
// only. Real ledger mutations are delegated to LedgerService via the Token
// Extension product pathway in a follow-up wiring step (see HANDOFF).

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { DIAMOND_TIER } from '../../core-api/src/config/governance.config';
import {
  ExpirationDistribution,
  RecoveryAction,
  RecoveryAuditEntry,
  RecoveryCase,
  RecoveryResultCode,
  RecoveryStage,
  ThreeFifthsExitOutcome,
  TokenBridgeOffer,
  WalletSnapshot,
} from './recovery.types';

export const RECOVERY_RULE_ID = 'REDBOOK_RECOVERY_v1';

// REDBOOK §5 doctrinal constants (non-FIZ-locked; revisable via REDBOOK commit).
export const RECOVERY_CONSTANTS = {
  TOKEN_BRIDGE_BONUS_PCT: 0.20,
  TOKEN_BRIDGE_OFFER_TTL_HOURS: 24,
  TOKEN_BRIDGE_RESTRICTION_HOURS: 24,

  THREE_FIFTHS_REFUND_PCT: 0.60,
  THREE_FIFTHS_LOCK_HOURS: 24,
  THREE_FIFTHS_PROCESSING_BUSINESS_DAYS: [7, 10] as [number, number],
  THREE_FIFTHS_PERMANENT_FLAG: 'AWARE_OF_POLICY_DECLINED_TWO_GOODWILL_OFFERS',

  // Governance reference: FIZ-002-REVISION-2026-04-11 removed the cash refund
  // path. Three-Fifths Exit remains in REDBOOK §5 as a recovery pattern but
  // cash movement is POLICY_GATED at runtime until a CEO-authorized override
  // is in force. See HANDOFF at bottom of this file.
  POLICY_GATE_REFERENCE: 'FIZ-002-REVISION-2026-04-11',

  HIGH_BALANCE_PERSONAL_TOUCH_USD: 10_000,
  EXPIRY_WARNING_WINDOW_HOURS: 48,
} as const;

export interface RecoveryDispatcher {
  publishCase(caseRecord: RecoveryCase): void | Promise<void>;
  enqueue48hWarning(snapshot: WalletSnapshot): void | Promise<void>;
  enqueuePersonalTouch(snapshot: WalletSnapshot): void | Promise<void>;
}

export interface CeoOverrideContext {
  override_id: string;
  authorized_by: string;
  authorized_at_utc: string;
  reason_code: string;
}

interface OpenCaseParams {
  wallet_id: string;
  user_id: string;
  remaining_balance_tokens: bigint;
  original_purchase_price_usd_cents: bigint;
  correlation_id?: string;
}

/**
 * RecoveryEngine — CS Recovery Dashboard back-end.
 *
 * State model: in-memory map keyed by case_id. A persistence layer can be
 * wired in via a repository pattern without changing this interface.
 * Every state change appends a RecoveryAuditEntry — nothing is mutated
 * destructively on the case record except the `stage` field advancing
 * forward through RecoveryStage in monotonic order.
 */
@Injectable()
export class RecoveryEngine {
  private readonly logger = new Logger(RecoveryEngine.name);
  private readonly RULE_ID = RECOVERY_RULE_ID;
  private readonly cases = new Map<string, RecoveryCase>();

  // Tracks the timestamp (ms) at which each wallet_id last had a 48h warning
  // enqueued. Used to enforce idempotency across repeated calls.
  private readonly warnedWallets = new Map<string, number>();

  constructor(private readonly dispatcher?: RecoveryDispatcher) {}

  // ── Case lifecycle ───────────────────────────────────────────────────────

  openCase(params: OpenCaseParams): RecoveryCase {
    const case_id = `rec_${randomUUID()}`;
    const correlation_id = params.correlation_id ?? `corr_${randomUUID()}`;
    const now = new Date().toISOString();

    const caseRecord: RecoveryCase = {
      case_id,
      wallet_id: params.wallet_id,
      user_id: params.user_id,
      opened_at_utc: now,
      stage: 'OPEN',
      remaining_balance_tokens: params.remaining_balance_tokens,
      original_purchase_price_usd_cents: params.original_purchase_price_usd_cents,
      rule_applied_id: this.RULE_ID,
      correlation_id,
      flags: [],
      audit_trail: [],
    };

    this.cases.set(case_id, caseRecord);
    this.logger.log('RecoveryEngine: case opened', {
      case_id,
      wallet_id: params.wallet_id,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    if (this.dispatcher) {
      Promise.resolve(this.dispatcher.publishCase(caseRecord)).catch((err) => {
        this.logger.error('RecoveryEngine: dispatcher.publishCase failed', err);
      });
    }

    return caseRecord;
  }

  getCase(case_id: string): RecoveryCase | undefined {
    return this.cases.get(case_id);
  }

  listOpenCases(): RecoveryCase[] {
    return [...this.cases.values()].filter(
      (c) => c.stage !== 'RESOLVED' && c.stage !== 'EXPIRATION_PROCESSED',
    );
  }

  // ── Pillar 1 — Token Bridge (soft offer, 20% bonus + waiver) ─────────────

  /**
   * REDBOOK §5 Pillar 1.
   * Produces a Token Bridge offer computed at 20% of remaining token balance.
   * No ledger credit. Soft offer only. Requires signed waiver on acceptance.
   * Places a temporary account restriction window flag for the offer duration.
   */
  tokenBridgeOffer(case_id: string, agent_id: string): TokenBridgeOffer {
    const caseRecord = this.requireCase(case_id);
    this.requireStage(caseRecord, ['OPEN', 'THREE_FIFTHS_EXIT_POLICY_GATED']);

    const bonus_tokens =
      (caseRecord.remaining_balance_tokens * 20n) / 100n;

    const offer_expires_at_utc = new Date(
      Date.now() +
        RECOVERY_CONSTANTS.TOKEN_BRIDGE_OFFER_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    caseRecord.stage = 'TOKEN_BRIDGE_OFFERED';
    caseRecord.flags.push('RESTRICTION_WINDOW_ACTIVE');
    this.appendAudit(caseRecord, {
      action: 'TOKEN_BRIDGE_OFFER',
      actor_id: agent_id,
      reason_code: 'PILLAR_1_TOKEN_BRIDGE',
      metadata: {
        bonus_tokens: bonus_tokens.toString(),
        bonus_pct: RECOVERY_CONSTANTS.TOKEN_BRIDGE_BONUS_PCT,
        offer_expires_at_utc,
      },
    });

    this.logger.log('RecoveryEngine: TOKEN_BRIDGE offer computed', {
      case_id,
      bonus_tokens: bonus_tokens.toString(),
      offer_expires_at_utc,
      rule_applied_id: this.RULE_ID,
    });

    return {
      case_id,
      bonus_tokens,
      bonus_pct: RECOVERY_CONSTANTS.TOKEN_BRIDGE_BONUS_PCT,
      requires_waiver_signature: true,
      restriction_window_hours: RECOVERY_CONSTANTS.TOKEN_BRIDGE_RESTRICTION_HOURS,
      offer_expires_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Records the guest's signed-waiver acceptance of a Token Bridge offer.
   * No ledger credit here — that happens when the credit is applied through
   * the LedgerService Token Extension pathway (see HANDOFF).
   */
  acceptTokenBridge(
    case_id: string,
    agent_id: string,
    waiver_signature_hash: string,
  ): RecoveryAuditEntry {
    const caseRecord = this.requireCase(case_id);
    this.requireStage(caseRecord, ['TOKEN_BRIDGE_OFFERED']);

    caseRecord.stage = 'TOKEN_BRIDGE_ACCEPTED';
    return this.appendAudit(caseRecord, {
      action: 'TOKEN_BRIDGE_ACCEPT',
      actor_id: agent_id,
      reason_code: 'PILLAR_1_ACCEPTED',
      metadata: {
        waiver_signature_hash,
      },
    });
  }

  // ── Pillar 2 — Three-Fifths Exit (policy-gated) ───────────────────────────

  /**
   * REDBOOK §5 Pillar 2.
   * Scaffolding for the Three-Fifths Exit flow. Cash-refund execution is
   * POLICY_GATED by FIZ-002-REVISION-2026-04-11. Without a CEO override this
   * method returns POLICY_GATED and records an audit entry — no money moves.
   * With an override, the method still only records intent here; the actual
   * refund is delegated to the finance pipeline (see HANDOFF).
   */
  threeFifthsExit(
    case_id: string,
    agent_id: string,
    ceo_override?: CeoOverrideContext,
  ): ThreeFifthsExitOutcome {
    const caseRecord = this.requireCase(case_id);
    this.requireStage(caseRecord, [
      'OPEN',
      'TOKEN_BRIDGE_OFFERED',
      'TOKEN_BRIDGE_ACCEPTED',
    ]);

    const gated = !ceo_override;

    caseRecord.flags.push(RECOVERY_CONSTANTS.THREE_FIFTHS_PERMANENT_FLAG);
    if (gated) {
      caseRecord.stage = 'THREE_FIFTHS_EXIT_POLICY_GATED';
    } else {
      caseRecord.stage = 'THREE_FIFTHS_EXIT_OFFERED';
      caseRecord.flags.push('BUY_SPEND_LOCK_ACTIVE');
    }

    const result_code: RecoveryResultCode = gated ? 'POLICY_GATED' : 'OK';

    this.appendAudit(caseRecord, {
      action: 'THREE_FIFTHS_EXIT_REQUEST',
      actor_id: agent_id,
      reason_code: gated
        ? 'POLICY_GATED_NO_CASH_REFUND_PATH'
        : 'CEO_OVERRIDE_APPLIED',
      metadata: {
        refund_percentage: RECOVERY_CONSTANTS.THREE_FIFTHS_REFUND_PCT,
        lock_hours: RECOVERY_CONSTANTS.THREE_FIFTHS_LOCK_HOURS,
        policy_gate_reference: RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE,
        ceo_override_id: ceo_override?.override_id,
        ceo_authorized_by: ceo_override?.authorized_by,
      },
    });

    if (gated) {
      this.logger.warn(
        'RecoveryEngine: Three-Fifths Exit POLICY_GATED (FIZ-002-REVISION)',
        {
          case_id,
          rule_applied_id: this.RULE_ID,
          policy_gate_reference: RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE,
        },
      );
    } else {
      this.logger.log(
        'RecoveryEngine: Three-Fifths Exit authorized via CEO override',
        {
          case_id,
          override_id: ceo_override.override_id,
          rule_applied_id: this.RULE_ID,
        },
      );
    }

    return {
      case_id,
      result_code,
      refund_percentage: RECOVERY_CONSTANTS.THREE_FIFTHS_REFUND_PCT,
      lock_hours: RECOVERY_CONSTANTS.THREE_FIFTHS_LOCK_HOURS,
      processing_business_days:
        RECOVERY_CONSTANTS.THREE_FIFTHS_PROCESSING_BUSINESS_DAYS,
      permanent_flag: RECOVERY_CONSTANTS.THREE_FIFTHS_PERMANENT_FLAG,
      policy_gate_reference: gated
        ? RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE
        : undefined,
      rule_applied_id: this.RULE_ID,
    };
  }

  // ── Pillar 3 — Expiration (70/30 split + fee schedule) ───────────────────

  /**
   * REDBOOK §5 Pillar 3.
   * Expired token distribution: 70% to creator bonus pool, 30% to platform
   * management fee. Extension fee ($49) and recovery fee ($79) are surfaced
   * for downstream product pricing.
   */
  handleExpiration(case_id: string, agent_id: string): ExpirationDistribution {
    const caseRecord = this.requireCase(case_id);
    this.requireStage(caseRecord, [
      'OPEN',
      'TOKEN_BRIDGE_OFFERED',
      'TOKEN_BRIDGE_ACCEPTED',
      'THREE_FIFTHS_EXIT_POLICY_GATED',
    ]);

    const expired = caseRecord.remaining_balance_tokens;
    const creator_bonus_pool_tokens = this.applyBps(
      expired,
      DIAMOND_TIER.EXPIRED_CREATOR_POOL_PCT,
    );
    // Residual goes to platform mgmt fee — avoids rounding drift.
    const platform_mgmt_fee_tokens = expired - creator_bonus_pool_tokens;

    caseRecord.stage = 'EXPIRATION_PROCESSED';
    this.appendAudit(caseRecord, {
      action: 'EXPIRATION_DISTRIBUTE',
      actor_id: agent_id,
      reason_code: 'PILLAR_3_EXPIRED_DISTRIBUTION',
      metadata: {
        expired_tokens: expired.toString(),
        creator_bonus_pool_tokens: creator_bonus_pool_tokens.toString(),
        platform_mgmt_fee_tokens: platform_mgmt_fee_tokens.toString(),
        creator_pool_pct: DIAMOND_TIER.EXPIRED_CREATOR_POOL_PCT,
        platform_mgmt_pct: DIAMOND_TIER.EXPIRED_PLATFORM_MGMT_PCT,
      },
    });

    return {
      wallet_id: caseRecord.wallet_id,
      expired_tokens: expired,
      creator_bonus_pool_tokens,
      platform_mgmt_fee_tokens,
      extension_fee_usd: DIAMOND_TIER.EXTENSION_FEE_14_DAY_USD,
      recovery_fee_usd: DIAMOND_TIER.RECOVERY_FEE_EXPIRED_USD,
      rule_applied_id: this.RULE_ID,
    };
  }

  // ── Notifications — 48h warnings & personal touch trigger ────────────────

  /**
   * Marks Diamond-tier wallets whose token expiry falls inside the 48-hour
   * window. Emits dispatcher enqueue calls for the NotificationEngine.
   * Returns the list of snapshots that were flagged.
   *
   * Idempotent per wallet: duplicate wallet_id entries within the input array
   * are collapsed (first occurrence wins), and wallets that were already warned
   * within the current 48h window on a previous call are silently skipped.
   */
  async send48HourWarning(
    diamondWallets: WalletSnapshot[],
    now_utc = new Date(),
  ): Promise<WalletSnapshot[]> {
    const windowMs =
      RECOVERY_CONSTANTS.EXPIRY_WARNING_WINDOW_HOURS * 60 * 60 * 1000;
    const nowMs = now_utc.getTime();
    const cutoff = nowMs + windowMs;

    // Prune stale dedup entries (older than one window) to bound memory growth.
    const staleThreshold = nowMs - windowMs;
    for (const [id, ts] of this.warnedWallets) {
      if (ts < staleThreshold) {
        this.warnedWallets.delete(id);
      }
    }

    // Deduplicate input by wallet_id — first occurrence wins.
    const seenIds = new Set<string>();
    const unique = diamondWallets.filter((w) => {
      if (seenIds.has(w.wallet_id)) return false;
      seenIds.add(w.wallet_id);
      return true;
    });

    const toWarn = unique.filter((w) => {
      const expiresAt = new Date(w.expires_at_utc).getTime();
      if (
        !w.is_diamond ||
        w.remaining_balance_tokens <= 0n ||
        expiresAt <= nowMs ||
        expiresAt > cutoff
      ) {
        return false;
      }
      // Cross-call dedup: skip if a warning was already enqueued for this
      // wallet within the current warning window.
      const lastWarned = this.warnedWallets.get(w.wallet_id);
      return lastWarned === undefined || lastWarned < nowMs - windowMs;
    });

    for (const snapshot of toWarn) {
      this.warnedWallets.set(snapshot.wallet_id, nowMs);
      if (this.dispatcher) {
        await this.dispatcher.enqueue48hWarning(snapshot);
      }
      this.logger.log('RecoveryEngine: 48h warning enqueued', {
        wallet_id: snapshot.wallet_id,
        user_id: snapshot.user_id,
        expires_at_utc: snapshot.expires_at_utc,
        rule_applied_id: this.RULE_ID,
      });
    }

    return toWarn;
  }

  /**
   * Triggers a CS personal-touch follow-up for wallets whose USD-equivalent
   * remaining balance exceeds the HIGH_BALANCE_PERSONAL_TOUCH_USD threshold.
   */
  async triggerPersonalTouch(
    wallets: WalletSnapshot[],
  ): Promise<WalletSnapshot[]> {
    const thresholdCents = BigInt(
      RECOVERY_CONSTANTS.HIGH_BALANCE_PERSONAL_TOUCH_USD * 100,
    );
    const flagged = wallets.filter(
      (w) => w.remaining_balance_usd_cents > thresholdCents,
    );

    for (const snapshot of flagged) {
      if (this.dispatcher) {
        await this.dispatcher.enqueuePersonalTouch(snapshot);
      }
      this.logger.log('RecoveryEngine: personal-touch follow-up triggered', {
        wallet_id: snapshot.wallet_id,
        user_id: snapshot.user_id,
        balance_usd_cents: snapshot.remaining_balance_usd_cents.toString(),
        rule_applied_id: this.RULE_ID,
      });
    }

    return flagged;
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  static computeAuditHash(
    case_id: string,
    action: RecoveryAction,
    timestamp_utc: string,
  ): string {
    return createHash('sha256')
      .update(`${case_id}:${action}:${timestamp_utc}`)
      .digest('hex');
  }

  private applyBps(amount: bigint, pct: number): bigint {
    // Avoids float drift on BigInt — multiplies in basis-points space.
    const bps = BigInt(Math.round(pct * 10_000));
    return (amount * bps) / 10_000n;
  }

  private appendAudit(
    caseRecord: RecoveryCase,
    entry: Omit<RecoveryAuditEntry, 'at_utc' | 'correlation_id' | 'rule_applied_id'>,
  ): RecoveryAuditEntry {
    const full: RecoveryAuditEntry = {
      ...entry,
      at_utc: new Date().toISOString(),
      correlation_id: caseRecord.correlation_id,
      rule_applied_id: this.RULE_ID,
    };
    caseRecord.audit_trail.push(full);
    return full;
  }

  private requireCase(case_id: string): RecoveryCase {
    const c = this.cases.get(case_id);
    if (!c) {
      throw new Error(`RECOVERY_CASE_NOT_FOUND: ${case_id}`);
    }
    return c;
  }

  private requireStage(
    caseRecord: RecoveryCase,
    allowed: RecoveryStage[],
  ): void {
    if (!allowed.includes(caseRecord.stage)) {
      throw new Error(
        `RECOVERY_INVALID_STAGE: case=${caseRecord.case_id} stage=${caseRecord.stage} allowed=${allowed.join(',')}`,
      );
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
## HANDOFF

Completed flows (Payload 2, Wave 1):
- Pillar 1 — Token Bridge offer (20% bonus, signed-waiver, 24h restriction flag)
- Pillar 1 — Token Bridge acceptance (waiver hash captured, stage advanced)
- Pillar 2 — Three-Fifths Exit scaffolding (POLICY_GATED by FIZ-002-REVISION-2026-04-11)
- Pillar 3 — Expiration distribution (70/30 split, $49/$79 fee surfaces)
- 48-hour Diamond expiry warning enqueue
- High-balance (>$10k USD) personal-touch enqueue
- Append-only audit trail with correlation_id + rule_applied_id on every row

Not wired (next priorities):
1. GateGuard Sentinel integration — recovery case open should flow through the
   Welfare Guardian pre-processor for Diamond-tier high-risk wallets. Surface
   the existing WalletSnapshot contract as the sentinel input type.
2. LedgerService wiring — TokenBridge acceptance and CEO-overridden ThreeFifths
   Exit must mint the corresponding ledger rows via LedgerService.recordEntry
   / handleDisputeReversal. Payload 1 owns the ledger; wire once it lands.
3. Prisma persistence for RecoveryCase + RecoveryAuditEntry. In-memory store is
   sufficient for unit/integration tests; production persistence requires a
   new prisma model (out of scope for Payload 2).
4. CEO override issuance/validation path. Right now the override context is
   accepted on trust — it must be verified through a step-up auth service.
5. Notification dispatcher wiring to Twilio/SendGrid via NotificationEngine
   (see services/notification/src/notification.service.ts).

Governance notes:
- FIZ-002-REVISION-2026-04-11 is authoritative over REDBOOK §5 cash-refund
  language. Three-Fifths Exit is therefore a documentation + scaffolding
  exercise until a CEO directive reinstates the path.
- DIAMOND_TIER.EXPIRED_CREATOR_POOL_PCT / EXPIRED_PLATFORM_MGMT_PCT drive
  Pillar 3 splits — do not hardcode 0.70/0.30 anywhere else.
───────────────────────────────────────────────────────────────────────────── */
