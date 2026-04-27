// CYR: Wave L — Red Room Rewards Full Gamification + Earning Rules
// User-facing RRR points engine: earning rules, point awards, burn shop.
//
// Architecture:
//   • Points are tracked in an append-only UserRrPointsLedger (no balance column
//     updates — OQMI APPEND-ONLY FINANCE invariant).
//   • Balance = SUM(amount) across all ledger entries for the user.
//   • Burn creates a negative ledger entry + a BurnRewardGrant record.
//   • Daily-login batch (awardDailyLoginBatch) is called by the Bull scheduler;
//     wire via the GZ_SCHEDULING queue or a dedicated rr-rewards queue.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

// ─── Earning rules ────────────────────────────────────────────────────────────

export const EARNING_RULES = {
  DAILY_LOGIN:       50,
  MESSAGE_SENT:      10,
  IMAGE_GENERATED:   25,
  VOICE_CALL:        40,
  REFERRAL:         500,
  HOUSE_MODEL_CHAT:  15,
  PORTAL_SWITCH:     20,
} as const;

export type EarningAction = keyof typeof EARNING_RULES;

export const BURN_COSTS = {
  EXTRA_IMAGES:  200,
  TEMP_INFERNO:  500,
  CUSTOM_TWIN:  1_000,
} as const;

export type BurnReward = keyof typeof BURN_COSTS;

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface UserRrPointsEntry {
  id: string;
  user_id: string;
  /** Signed: positive = award, negative = burn. */
  amount: number;
  action: string;
  description: string;
  correlation_id: string;
  reason_code: string;
  created_at: Date;
}

export interface BurnRewardGrantRecord {
  id: string;
  user_id: string;
  points_burned: number;
  reward_type: BurnReward;
  expires_at: Date | null;
  fulfilled_at: Date | null;
  correlation_id: string;
  reason_code: string;
  created_at: Date;
}

export interface AwardResult {
  entry: UserRrPointsEntry;
  new_balance: number;
}

export interface BurnResult {
  debit_entry: UserRrPointsEntry;
  grant: BurnRewardGrantRecord;
  new_balance: number;
}

// ─── Repository contracts ─────────────────────────────────────────────────────

export interface RrPointsLedgerRepository {
  appendEntry(entry: Omit<UserRrPointsEntry, 'id' | 'created_at'>): Promise<UserRrPointsEntry>;
  getBalance(user_id: string): Promise<number>;
  /** Returns entries newest-first. */
  listEntries(user_id: string, limit?: number): Promise<UserRrPointsEntry[]>;
  /** Check if user already received DAILY_LOGIN today (UTC date). */
  hasDailyLogin(user_id: string, dateUtc: string): Promise<boolean>;
}

export interface BurnRewardGrantRepository {
  insert(grant: Omit<BurnRewardGrantRecord, 'id' | 'created_at'>): Promise<BurnRewardGrantRecord>;
  findByUserId(user_id: string): Promise<BurnRewardGrantRecord[]>;
}

/** All active user IDs — used by the daily-login batch. */
export interface ActiveUserProvider {
  listActiveUserIds(): Promise<string[]>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class InsufficientRrrPointsError extends Error {
  readonly statusCode = 402;
  constructor(balance: number, required: number) {
    super(`Insufficient RRR points: have ${balance}, need ${required}`);
    this.name = 'InsufficientRrrPointsError';
  }
}

export class AlreadyAwardedTodayError extends Error {
  readonly statusCode = 409;
  constructor(userId: string) {
    super(`DAILY_LOGIN already awarded today for user ${userId}`);
    this.name = 'AlreadyAwardedTodayError';
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const RR_REWARDS_RULE_ID = 'RR_REWARDS_v1';

/** Build a unique correlation_id for an RRR action. */
function makeCorrelationId(prefix: string, userId: string): string {
  return `${prefix}:${userId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
}

/**
 * Reward expiry windows by reward type (calendar days from grant).
 * EXTRA_IMAGES: 30 days; TEMP_INFERNO: 7 days; CUSTOM_TWIN: no expiry.
 */
const BURN_REWARD_EXPIRY_DAYS: Record<BurnReward, number | null> = {
  EXTRA_IMAGES:  30,
  TEMP_INFERNO:  7,
  CUSTOM_TWIN:   null,
};

@Injectable()
export class RedRoomRewardsService {
  private readonly logger = new Logger(RedRoomRewardsService.name);
  private readonly RULE_ID = RR_REWARDS_RULE_ID;

  readonly earningRules = { ...EARNING_RULES };

  constructor(
    private readonly ledger: RrPointsLedgerRepository,
    private readonly grants: BurnRewardGrantRepository,
    private readonly activeUsers?: ActiveUserProvider,
  ) {}

  /**
   * Award points to a user for a specific earning action.
   * Idempotency is the caller's responsibility via correlation_id.
   */
  async awardPoints(userId: string, action: EarningAction): Promise<AwardResult> {
    const points = this.earningRules[action];
    const entry = await this.ledger.appendEntry({
      user_id: userId,
      amount: points,
      action,
      description: `Earned ${points} points for ${action}`,
      correlation_id: makeCorrelationId(`RRR:${action}`, userId),
      reason_code: 'RRR_AWARD',
    });

    const new_balance = await this.ledger.getBalance(userId);
    this.logger.log('RedRoomRewardsService: points awarded', {
      user_id: userId,
      action,
      points,
      new_balance,
      rule_applied_id: this.RULE_ID,
    });

    return { entry, new_balance };
  }

  /**
   * Award DAILY_LOGIN points if not already awarded for today (UTC).
   * Throws AlreadyAwardedTodayError if duplicate detected.
   */
  async awardDailyLogin(userId: string): Promise<AwardResult> {
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const already = await this.ledger.hasDailyLogin(userId, todayUtc);
    if (already) {
      throw new AlreadyAwardedTodayError(userId);
    }
    return this.awardPoints(userId, 'DAILY_LOGIN');
  }

  /**
   * Award DAILY_LOGIN points to all active users for the current UTC day.
   * Skips users who have already received login points today.
   * Intended to be called by the Bull scheduling queue at midnight UTC.
   */
  async awardDailyLoginBatch(): Promise<{ awarded: number; skipped: number }> {
    if (!this.activeUsers) {
      throw new Error('RR_REWARDS: ActiveUserProvider is required for batch award');
    }
    const userIds = await this.activeUsers.listActiveUserIds();
    let awarded = 0;
    let skipped = 0;

    for (const userId of userIds) {
      try {
        await this.awardDailyLogin(userId);
        awarded += 1;
      } catch (err) {
        if (err instanceof AlreadyAwardedTodayError) {
          skipped += 1;
        } else {
          this.logger.error('RedRoomRewardsService: awardDailyLoginBatch error', {
            user_id: userId,
            error: (err as Error).message,
          });
        }
      }
    }

    this.logger.log('RedRoomRewardsService: daily login batch complete', {
      total: userIds.length,
      awarded,
      skipped,
      rule_applied_id: this.RULE_ID,
    });
    return { awarded, skipped };
  }

  /**
   * Burn RRR points to redeem a reward.
   * Validates sufficient balance, creates a debit ledger entry, and records
   * the BurnRewardGrant.
   * Throws InsufficientRrrPointsError if balance < cost.
   */
  async burnPoints(
    userId: string,
    reward: BurnReward,
  ): Promise<BurnResult> {
    const cost = BURN_COSTS[reward];
    const balance = await this.ledger.getBalance(userId);

    if (balance < cost) {
      throw new InsufficientRrrPointsError(balance, cost);
    }

    const correlationId = makeCorrelationId(`RRR:BURN:${reward}`, userId);

    const debit_entry = await this.ledger.appendEntry({
      user_id: userId,
      amount: -cost,
      action: `BURN_${reward}`,
      description: `Burned ${cost} points for ${reward}`,
      correlation_id: correlationId,
      reason_code: 'RRR_BURN',
    });

    const expiryDays = BURN_REWARD_EXPIRY_DAYS[reward];
    const expires_at = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const grant = await this.grants.insert({
      user_id: userId,
      points_burned: cost,
      reward_type: reward,
      expires_at,
      fulfilled_at: null,
      correlation_id: `GRANT:${correlationId}`,
      reason_code: 'RRR_BURN_REWARD',
    });

    const new_balance = await this.ledger.getBalance(userId);

    this.logger.log('RedRoomRewardsService: points burned', {
      user_id: userId,
      reward,
      cost,
      new_balance,
      grant_id: grant.id,
      rule_applied_id: this.RULE_ID,
    });

    return { debit_entry, grant, new_balance };
  }

  /** Current point balance for a user. */
  async getBalance(userId: string): Promise<number> {
    return this.ledger.getBalance(userId);
  }

  /** Earning history, newest-first. */
  async getHistory(userId: string, limit = 50): Promise<UserRrPointsEntry[]> {
    return this.ledger.listEntries(userId, limit);
  }

  /** Active burn reward grants for a user. */
  async getActiveGrants(userId: string): Promise<BurnRewardGrantRecord[]> {
    const all = await this.grants.findByUserId(userId);
    const now = new Date();
    return all.filter(
      (g) => !g.fulfilled_at && (g.expires_at === null || g.expires_at > now),
    );
  }
}

// ─── In-memory test repositories ─────────────────────────────────────────────

export class InMemoryRrPointsLedgerRepository implements RrPointsLedgerRepository {
  private readonly entries: UserRrPointsEntry[] = [];
  private seq = 0;

  async appendEntry(
    entry: Omit<UserRrPointsEntry, 'id' | 'created_at'>,
  ): Promise<UserRrPointsEntry> {
    const persisted: UserRrPointsEntry = {
      ...entry,
      id: `rrr_${++this.seq}`,
      created_at: new Date(),
    };
    this.entries.push(persisted);
    return persisted;
  }

  async getBalance(user_id: string): Promise<number> {
    return this.entries
      .filter((e) => e.user_id === user_id)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  async listEntries(user_id: string, limit = 50): Promise<UserRrPointsEntry[]> {
    return this.entries
      .filter((e) => e.user_id === user_id)
      .slice()
      .sort((a, b) => {
        const timeDiff = b.created_at.getTime() - a.created_at.getTime();
        if (timeDiff !== 0) return timeDiff;
        // Tiebreak by sequence number (id format: "rrr_N") — higher N = newer.
        const seqA = Number(a.id.replace('rrr_', ''));
        const seqB = Number(b.id.replace('rrr_', ''));
        return seqB - seqA;
      })
      .slice(0, limit);
  }

  async hasDailyLogin(user_id: string, dateUtc: string): Promise<boolean> {
    return this.entries.some(
      (e) =>
        e.user_id === user_id &&
        e.action === 'DAILY_LOGIN' &&
        e.created_at.toISOString().startsWith(dateUtc),
    );
  }
}

export class InMemoryBurnRewardGrantRepository implements BurnRewardGrantRepository {
  private readonly grants: BurnRewardGrantRecord[] = [];
  private seq = 0;

  async insert(
    grant: Omit<BurnRewardGrantRecord, 'id' | 'created_at'>,
  ): Promise<BurnRewardGrantRecord> {
    const persisted: BurnRewardGrantRecord = {
      ...grant,
      id: `grant_${++this.seq}`,
      created_at: new Date(),
    };
    this.grants.push(persisted);
    return persisted;
  }

  async findByUserId(user_id: string): Promise<BurnRewardGrantRecord[]> {
    return this.grants.filter((g) => g.user_id === user_id);
  }
}
