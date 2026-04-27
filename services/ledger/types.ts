// FIZ: PAYLOAD-001 — Canonical Financial Ledger types
// All identifiers, reason codes, bucket names, and rate-card tier names consumed
// across services/ledger/*. Mirrors the Prisma models added in 20260424000000.

/**
 * Single CZT Token Economy — `token_type` is immutable across every ledger
 * entry and every wallet row. The constant lives at the type layer so any code
 * attempting to widen the alias fails the compile, and at the value layer so
 * services can stamp the column on every write without inventing a literal.
 *
 * DB-layer guarantees: token_type CHECK constraints in migrations
 * 20260426010000_czt_single_token_enforcement and
 * 20260426200000_add_token_type_to_token_balances.
 */
export type TokenType = 'CZT';
export const TOKEN_TYPE_CZT: TokenType = 'CZT';

/**
 * LedgerBucket — the canonical three-bucket wallet partitioning.
 * Spend order is enforced by governance.config.LEDGER_SPEND_ORDER.
 */
export const BUCKETS = ['purchased', 'membership', 'bonus'] as const;
export type LedgerBucket = (typeof BUCKETS)[number];

/**
 * UserType for wallet owners. Drives rate-card selection (member vs guest).
 */
export type UserType = 'guest' | 'creator' | 'diamond';

/**
 * Reason codes — mandatory on every ledger entry. Narrowing this union prevents
 * free-form strings from landing in the append-only log.
 */
export type ReasonCode =
  | 'PURCHASE'
  | 'SPEND'
  | 'PAYOUT'
  | 'EXPIRY_RECOVERY'
  | 'EXPIRY_REDISTRIBUTION'
  | 'TOKEN_BRIDGE'
  | 'THREE_FIFTHS_EXIT'
  | 'EXTENSION_FEE'
  | 'MEMBERSHIP_STIPEND'
  | 'BONUS_GRANT'
  | 'REFUND';

/**
 * Rate card tiers (REDBOOK §3). Tease Regular / Diamond Floor / VIP.
 * NOTE: `tease_showzone` was retired with the Single CZT Economy spec
 * (services/showzone/RETIRED.md). Do not re-add.
 */
export type RateCardTier =
  | 'tease_regular'
  | 'diamond_floor'
  | 'vip_baseline';

/**
 * Heat levels — Flicker n'Flame Scoring (FFS) output (PAY-001…005). Drives creator payout per
 * token via governance.config.GovernanceConfig.RATE_* bands.
 */
export type HeatLevel = 'cold' | 'warm' | 'hot' | 'inferno';

/**
 * TokenExpirationStatus — lifecycle of a token-lot inside a Diamond wallet.
 */
export type TokenExpirationStatus = 'active' | 'expired' | 'recovered' | 'extended';

/**
 * RecoveryAction — enumerates every Unified CS workflow exposed by the Recovery
 * Engine (REDBOOK §5).
 */
export type RecoveryAction =
  | 'WARN_48H'                  // pre-expiry warning notification
  | 'EXTEND'                    // $49 extension, +14 days
  | 'RECOVER'                   // $79 recovery of expired balance
  | 'TOKEN_BRIDGE'              // 20% bonus credit + waiver
  | 'THREE_FIFTHS_EXIT'         // 60% refund + 24h lock
  | 'REDISTRIBUTE';             // 70/30 creator-pool / platform split on pure expiry

// ── Value types carried across service boundaries ───────────────────────────

export interface LedgerEntryInput {
  walletId: string;
  correlationId: string;            // idempotency key
  reasonCode: ReasonCode;
  amount: number;                   // signed: +credit, -debit
  bucket: LedgerBucket;
  metadata?: Record<string, unknown>;
  /**
   * Optional on input — defaulted to TOKEN_TYPE_CZT by LedgerService.record().
   * The value is rejected if it is anything other than 'CZT'.
   */
  tokenType?: TokenType;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  hashPrev: string | null;
  hashCurrent: string;
  createdAt: Date;
  /** Always 'CZT'. Stamped by LedgerService.record() and pinned by DB CHECK. */
  tokenType: TokenType;
}

export interface WalletSnapshot {
  id: string;
  userId: string;
  userType: UserType;
  purchasedTokens: number;
  membershipTokens: number;
  bonusTokens: number;
  totalTokens: number;              // virtual: sum of three buckets
  lastUpdated: Date;
}

export interface SpendResult {
  entries: LedgerEntry[];           // one entry per bucket touched
  totalDebited: number;
  breakdown: Record<LedgerBucket, number>;
}

export interface TokenExpirationRecord {
  id: string;
  walletId: string;
  tokens: number;
  expiresAt: Date;
  status: TokenExpirationStatus;
  recoveryFee?: number;
  createdAt: Date;
}

// Error classes — stable names for service consumers to assert against.
export class LedgerError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'LedgerError';
  }
}

export class InsufficientBalanceError extends LedgerError {
  constructor(shortfall: number, walletId: string) {
    super(
      'INSUFFICIENT_BALANCE',
      `Wallet ${walletId} cannot cover spend — shortfall ${shortfall} tokens across all three buckets.`,
    );
  }
}

export class IdempotencyReplayError extends LedgerError {
  constructor(correlationId: string) {
    super('IDEMPOTENCY_REPLAY', `correlation_id ${correlationId} already applied.`);
  }
}

export class HashChainBrokenError extends LedgerError {
  constructor(walletId: string, atEntryId: string) {
    super(
      'HASH_CHAIN_BROKEN',
      `Wallet ${walletId} ledger integrity failed at entry ${atEntryId}.`,
    );
  }
}
