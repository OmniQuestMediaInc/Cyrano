// FIZ: PAYLOAD-001 — Canonical Financial Ledger service
// Three-bucket wallet + hash-chained append-only ledger + idempotent writes.
// Spend order + constants are sourced exclusively from governance.config —
// no rate, fee, or bucket name is hardcoded here.

import { createHash } from 'crypto';

import {
  LEDGER_SPEND_ORDER,
  type LedgerBucket as ConfigLedgerBucket,
} from '../core-api/src/config/governance.config';
import type { LedgerRepository } from './repository';
import {
  HashChainBrokenError,
  IdempotencyReplayError,
  InsufficientBalanceError,
  LedgerError,
  TOKEN_TYPE_CZT,
  type LedgerBucket,
  type LedgerEntry,
  type LedgerEntryInput,
  type ReasonCode,
  type SpendResult,
  type TokenType,
  type UserType,
  type WalletSnapshot,
} from './types';

// Compile-time assertion that the governance spend-order constant matches the
// types used by this service. Adding a new bucket anywhere raises a ts error.
const _SPEND_ORDER_CHECK: readonly LedgerBucket[] = LEDGER_SPEND_ORDER;
void _SPEND_ORDER_CHECK;
// Widened alias to avoid read-only literal narrowing in function arguments.
type SpendBucket = ConfigLedgerBucket;

export interface LedgerServiceDeps {
  repo: LedgerRepository;
  clock?: () => Date;     // test seam — default Date.now
}

export class LedgerService {
  private readonly repo: LedgerRepository;
  private readonly clock: () => Date;

  constructor(deps: LedgerServiceDeps) {
    this.repo = deps.repo;
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * Idempotent: returns the existing entry unchanged if correlationId was
   * already applied. A replay with a diverging payload is rejected.
   */
  async record(input: LedgerEntryInput): Promise<{ wallet: WalletSnapshot; entry: LedgerEntry }> {
    this.validateInput(input);

    const existing = await this.repo.findLedgerEntryByCorrelationId(input.correlationId);
    if (existing) {
      this.assertReplayMatches(existing, input);
      const wallet = await this.walletForEntry(existing);
      return { wallet, entry: existing };
    }

    // Single CZT economy: token_type is immutable. The DB-layer CHECK
    // constraint (migration 20260426010000) is the runtime backstop.
    const tokenType: TokenType = TOKEN_TYPE_CZT;

    const prev = await this.repo.getLatestLedgerEntry(input.walletId);
    const hashPrev = prev ? prev.hashCurrent : null;
    const hashCurrent = this.computeHash({
      walletId: input.walletId,
      correlationId: input.correlationId,
      reasonCode: input.reasonCode,
      amount: input.amount,
      bucket: input.bucket,
      metadata: input.metadata ?? {},
      hashPrev,
    });

    const { wallet, entry } = await this.repo.appendEntryAndAdjustWallet({
      entry: {
        walletId: input.walletId,
        correlationId: input.correlationId,
        reasonCode: input.reasonCode,
        amount: input.amount,
        bucket: input.bucket,
        metadata: input.metadata,
        tokenType,
        hashPrev,
        hashCurrent,
      },
    });
    return { wallet, entry };
  }

  /**
   * Spend against a wallet using the canonical three-bucket order
   * (governance.config.LEDGER_SPEND_ORDER). Each bucket touched produces
   * its own append-only entry. Idempotent on `correlationId` — a replay
   * returns the original debit set.
   */
  async spend(args: {
    walletId: string;
    amount: number;                  // positive integer: tokens to spend
    correlationId: string;
    reasonCode?: ReasonCode;
    metadata?: Record<string, unknown>;
  }): Promise<SpendResult> {
    if (!Number.isInteger(args.amount) || args.amount <= 0) {
      throw new LedgerError('INVALID_AMOUNT', `spend amount must be a positive integer (got ${args.amount})`);
    }
    const reason: ReasonCode = args.reasonCode ?? 'SPEND';

    // Replay short-circuit — return prior debits tagged with this correlationId.
    const replay = await this.findExistingSpend(args.walletId, args.correlationId);
    if (replay) return replay;

    const wallet = await this.requireWalletById(args.walletId);
    const available = wallet.purchasedTokens + wallet.membershipTokens + wallet.bonusTokens;
    if (available < args.amount) {
      throw new InsufficientBalanceError(args.amount - available, args.walletId);
    }

    let remaining = args.amount;
    const entries: LedgerEntry[] = [];
    const breakdown: Record<LedgerBucket, number> = {
      purchased: 0,
      membership: 0,
      bonus: 0,
    };

    for (const bucket of LEDGER_SPEND_ORDER) {
      if (remaining <= 0) break;
      const current = this.readBucket(wallet, bucket);
      if (current <= 0) continue;
      const debit = Math.min(current, remaining);
      const { entry } = await this.record({
        walletId: args.walletId,
        correlationId: `${args.correlationId}:${bucket}`,
        reasonCode: reason,
        amount: -debit,
        bucket,
        metadata: {
          ...args.metadata,
          spend_correlation_id: args.correlationId,
          spend_priority: LEDGER_SPEND_ORDER.indexOf(bucket) + 1,
        },
      });
      entries.push(entry);
      breakdown[bucket] = debit;
      remaining -= debit;
    }

    if (remaining > 0) {
      // Defensive — bucket arithmetic drifted; balance check above should prevent this.
      throw new InsufficientBalanceError(remaining, args.walletId);
    }

    return { entries, totalDebited: args.amount, breakdown };
  }

  /**
   * Credits a bucket with a positive amount. Wrapper around `record()` for the
   * common PURCHASE / MEMBERSHIP_STIPEND / BONUS_GRANT paths.
   */
  async credit(args: {
    walletId: string;
    bucket: LedgerBucket;
    amount: number;
    correlationId: string;
    reasonCode: ReasonCode;
    metadata?: Record<string, unknown>;
  }): Promise<{ wallet: WalletSnapshot; entry: LedgerEntry }> {
    if (!Number.isInteger(args.amount) || args.amount <= 0) {
      throw new LedgerError('INVALID_AMOUNT', `credit amount must be a positive integer (got ${args.amount})`);
    }
    return this.record({
      walletId: args.walletId,
      correlationId: args.correlationId,
      reasonCode: args.reasonCode,
      amount: args.amount,
      bucket: args.bucket,
      metadata: args.metadata,
    });
  }

  /**
   * Verify the append-only hash chain for a wallet. Used by audit jobs and
   * pre-payout guards. Returns { ok: true } or throws HashChainBrokenError.
   */
  async verifyChain(walletId: string): Promise<{ ok: true; entries: number }> {
    const entries = await this.repo.listLedgerEntries(walletId);
    let prevHash: string | null = null;
    for (const e of entries) {
      if (e.hashPrev !== prevHash) {
        throw new HashChainBrokenError(walletId, e.id);
      }
      const recomputed = this.computeHash({
        walletId: e.walletId,
        correlationId: e.correlationId,
        reasonCode: e.reasonCode,
        amount: e.amount,
        bucket: e.bucket,
        metadata: e.metadata ?? {},
        hashPrev: e.hashPrev,
      });
      if (recomputed !== e.hashCurrent) {
        throw new HashChainBrokenError(walletId, e.id);
      }
      prevHash = e.hashCurrent;
    }
    return { ok: true, entries: entries.length };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private validateInput(input: LedgerEntryInput): void {
    if (!input.walletId) throw new LedgerError('INVALID_WALLET', 'walletId is required');
    if (!input.correlationId) throw new LedgerError('INVALID_CORRELATION', 'correlationId is required');
    if (!Number.isInteger(input.amount)) {
      throw new LedgerError('INVALID_AMOUNT', `amount must be an integer (got ${input.amount})`);
    }
    if (input.amount === 0) {
      throw new LedgerError('INVALID_AMOUNT', 'amount must be non-zero');
    }
    if (!LEDGER_SPEND_ORDER.includes(input.bucket as SpendBucket)) {
      throw new LedgerError('INVALID_BUCKET', `unknown bucket ${input.bucket}`);
    }
    if (input.tokenType !== undefined && input.tokenType !== TOKEN_TYPE_CZT) {
      throw new LedgerError(
        'INVALID_TOKEN_TYPE',
        `only '${TOKEN_TYPE_CZT}' is accepted (got '${input.tokenType}'). ShowToken / SZT and other token types are retired.`,
      );
    }
  }

  private assertReplayMatches(existing: LedgerEntry, input: LedgerEntryInput): void {
    if (
      existing.walletId !== input.walletId ||
      existing.amount !== input.amount ||
      existing.bucket !== input.bucket ||
      existing.reasonCode !== input.reasonCode
    ) {
      throw new IdempotencyReplayError(input.correlationId);
    }
  }

  private async findExistingSpend(
    walletId: string,
    correlationId: string,
  ): Promise<SpendResult | null> {
    const buckets = LEDGER_SPEND_ORDER;
    const entries: LedgerEntry[] = [];
    for (const b of buckets) {
      const e = await this.repo.findLedgerEntryByCorrelationId(`${correlationId}:${b}`);
      if (e) entries.push(e);
    }
    if (entries.length === 0) return null;
    const breakdown: Record<LedgerBucket, number> = {
      purchased: 0,
      membership: 0,
      bonus: 0,
    };
    let total = 0;
    for (const e of entries) {
      breakdown[e.bucket] = -e.amount;
      total += -e.amount;
    }
    return { entries, totalDebited: total, breakdown };
  }

  private async requireWalletById(walletId: string): Promise<WalletSnapshot> {
    const row = await this.repo.findWalletById(walletId);
    if (!row) throw new LedgerError('WALLET_NOT_FOUND', `wallet ${walletId} not found`);
    return row;
  }

  private async walletForEntry(entry: LedgerEntry): Promise<WalletSnapshot> {
    const row = await this.repo.findWalletById(entry.walletId);
    if (row) return row;
    throw new LedgerError('WALLET_NOT_FOUND', `wallet ${entry.walletId} not found`);
  }

  private readBucket(wallet: WalletSnapshot, bucket: SpendBucket): number {
    switch (bucket) {
      case 'purchased':
        return wallet.purchasedTokens;
      case 'membership':
        return wallet.membershipTokens;
      case 'bonus':
        return wallet.bonusTokens;
    }
  }

  /**
   * Deterministic hash chain: sha256 over a canonical JSON serialization of
   * the entry + prior hash. Metadata is sorted before hashing so object-key
   * order never perturbs the chain.
   */
  private computeHash(parts: {
    walletId: string;
    correlationId: string;
    reasonCode: string;
    amount: number;
    bucket: string;
    metadata: Record<string, unknown>;
    hashPrev: string | null;
  }): string {
    const stable = JSON.stringify({
      w: parts.walletId,
      c: parts.correlationId,
      r: parts.reasonCode,
      a: parts.amount,
      b: parts.bucket,
      m: sortKeys(parts.metadata),
      p: parts.hashPrev,
    });
    return createHash('sha256').update(stable).digest('hex');
  }

  /**
   * Convenience wrapper: create a wallet if none exists, else return existing.
   * Callers who already manage provisioning can ignore this.
   */
  async bootstrapWallet(args: {
    userId: string;
    userType: UserType;
    organizationId: string;
    tenantId: string;
  }): Promise<WalletSnapshot> {
    const existing = await this.repo.findWalletByUserId(args.userId);
    if (existing) return existing;
    return this.repo.createWallet(args);
  }
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// Three-bucket enforcement: the canonical spend order
//   [purchased → membership → bonus]
// is sourced from governance.config.LEDGER_SPEND_ORDER and is the sole authority
// consulted by LedgerService.spend(). Any bucket edit requires a FIZ: commit.
// Bucket columns on `wallets` are CHECK-constrained NON-NEGATIVE at the DB
// layer (migration 20260424000000); the hash chain is verified by
// verifyChain().
//
// STATUS: canonical ledger + REDBOOK rate cards + Recovery Engine shipped.
// Legacy services/core-api/src/finance/ledger.service.ts still drives the
// PROMOTIONAL_BONUS-first FIZ-003 path; the two coexist intentionally until
// the core-api wiring branch cuts over consumers to this module.
//
// NEXT PRIORITY: RedBook Dashboard (admin read surface for wallet state,
// expirations, and rate-card overrides). GateGuard (policy-enforcement layer
// that consumes LedgerService + Recovery Engine from behind REST) follows.
