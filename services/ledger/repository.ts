// FIZ: PAYLOAD-001 — Canonical Financial Ledger repository abstraction
// Decouples services/ledger/* from Prisma so the same service code runs against
// an in-memory backend in unit tests and Postgres in production. Production
// adapter is a thin wrapper around PrismaClient and lives alongside this file
// once the core-api wiring branch lands; for now the in-memory adapter is
// authoritative for the test suite.

import {
  TOKEN_TYPE_CZT,
  type LedgerEntry,
  type TokenExpirationRecord,
  type TokenExpirationStatus,
  type UserType,
  type WalletSnapshot,
} from './types';

export interface LedgerRepository {
  findWalletById(walletId: string): Promise<WalletSnapshot | null>;
  findWalletByUserId(userId: string): Promise<WalletSnapshot | null>;
  createWallet(input: {
    userId: string;
    userType: UserType;
    organizationId: string;
    tenantId: string;
  }): Promise<WalletSnapshot>;

  findLedgerEntryByCorrelationId(correlationId: string): Promise<LedgerEntry | null>;
  getLatestLedgerEntry(walletId: string): Promise<LedgerEntry | null>;
  listLedgerEntries(walletId: string): Promise<LedgerEntry[]>;

  /**
   * Atomically: append a ledger entry and adjust the wallet bucket column.
   * Implementations must reject duplicate correlationId values.
   */
  appendEntryAndAdjustWallet(args: {
    entry: Omit<LedgerEntry, 'id' | 'createdAt'>;
  }): Promise<{ wallet: WalletSnapshot; entry: LedgerEntry }>;

  listActiveExpirations(walletId: string): Promise<TokenExpirationRecord[]>;
  createExpiration(input: {
    walletId: string;
    tokens: number;
    expiresAt: Date;
  }): Promise<TokenExpirationRecord>;
  updateExpirationStatus(
    id: string,
    status: TokenExpirationStatus,
    recoveryFee?: number,
  ): Promise<TokenExpirationRecord>;
}

// ── In-memory adapter — authoritative for unit tests ─────────────────────────

interface WalletRow extends WalletSnapshot {
  organizationId: string;
  tenantId: string;
}

export class InMemoryLedgerRepository implements LedgerRepository {
  private wallets = new Map<string, WalletRow>();
  private byUserId = new Map<string, string>();
  private entries: LedgerEntry[] = [];
  private byCorrelation = new Map<string, LedgerEntry>();
  private expirations: TokenExpirationRecord[] = [];
  private idSeq = 0;

  private nextId(prefix: string): string {
    this.idSeq += 1;
    return `${prefix}_${this.idSeq.toString().padStart(8, '0')}`;
  }

  async findWalletById(walletId: string): Promise<WalletSnapshot | null> {
    const row = this.wallets.get(walletId);
    return row ? this.snapshot(row) : null;
  }

  async findWalletByUserId(userId: string): Promise<WalletSnapshot | null> {
    const id = this.byUserId.get(userId);
    if (!id) return null;
    const row = this.wallets.get(id);
    return row ? this.snapshot(row) : null;
  }

  async createWallet(input: {
    userId: string;
    userType: UserType;
    organizationId: string;
    tenantId: string;
  }): Promise<WalletSnapshot> {
    if (this.byUserId.has(input.userId)) {
      throw new Error(`wallet already exists for user ${input.userId}`);
    }
    const id = this.nextId('wal');
    const row: WalletRow = {
      id,
      userId: input.userId,
      userType: input.userType,
      purchasedTokens: 0,
      membershipTokens: 0,
      bonusTokens: 0,
      totalTokens: 0,
      lastUpdated: new Date(),
      organizationId: input.organizationId,
      tenantId: input.tenantId,
    };
    this.wallets.set(id, row);
    this.byUserId.set(input.userId, id);
    return this.snapshot(row);
  }

  async findLedgerEntryByCorrelationId(correlationId: string): Promise<LedgerEntry | null> {
    return this.byCorrelation.get(correlationId) ?? null;
  }

  async getLatestLedgerEntry(walletId: string): Promise<LedgerEntry | null> {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (this.entries[i].walletId === walletId) return this.entries[i];
    }
    return null;
  }

  async listLedgerEntries(walletId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((e) => e.walletId === walletId);
  }

  async appendEntryAndAdjustWallet(args: {
    entry: Omit<LedgerEntry, 'id' | 'createdAt'>;
  }): Promise<{ wallet: WalletSnapshot; entry: LedgerEntry }> {
    const { entry } = args;
    if (this.byCorrelation.has(entry.correlationId)) {
      throw new Error(`duplicate correlation_id ${entry.correlationId}`);
    }
    const row = this.wallets.get(entry.walletId);
    if (!row) throw new Error(`wallet ${entry.walletId} not found`);

    const column = this.bucketColumn(entry.bucket);
    const next = row[column] + entry.amount;
    if (next < 0) {
      throw new Error(`bucket ${entry.bucket} would go negative (${next})`);
    }
    row[column] = next;
    row.totalTokens = row.purchasedTokens + row.membershipTokens + row.bonusTokens;
    row.lastUpdated = new Date();

    const persisted: LedgerEntry = {
      ...entry,
      tokenType: entry.tokenType ?? TOKEN_TYPE_CZT,
      id: this.nextId('led'),
      createdAt: new Date(),
    };
    this.entries.push(persisted);
    this.byCorrelation.set(persisted.correlationId, persisted);
    return { wallet: this.snapshot(row), entry: persisted };
  }

  async listActiveExpirations(walletId: string): Promise<TokenExpirationRecord[]> {
    return this.expirations.filter(
      (e) => e.walletId === walletId && e.status === 'active',
    );
  }

  async createExpiration(input: {
    walletId: string;
    tokens: number;
    expiresAt: Date;
  }): Promise<TokenExpirationRecord> {
    const rec: TokenExpirationRecord = {
      id: this.nextId('exp'),
      walletId: input.walletId,
      tokens: input.tokens,
      expiresAt: input.expiresAt,
      status: 'active',
      createdAt: new Date(),
    };
    this.expirations.push(rec);
    return rec;
  }

  async updateExpirationStatus(
    id: string,
    status: TokenExpirationStatus,
    recoveryFee?: number,
  ): Promise<TokenExpirationRecord> {
    const idx = this.expirations.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error(`expiration ${id} not found`);
    const updated: TokenExpirationRecord = {
      ...this.expirations[idx],
      status,
      recoveryFee: recoveryFee ?? this.expirations[idx].recoveryFee,
    };
    this.expirations[idx] = updated;
    return updated;
  }

  private bucketColumn(
    bucket: LedgerEntry['bucket'],
  ): 'purchasedTokens' | 'membershipTokens' | 'bonusTokens' {
    switch (bucket) {
      case 'purchased':
        return 'purchasedTokens';
      case 'membership':
        return 'membershipTokens';
      case 'bonus':
        return 'bonusTokens';
    }
  }

  private snapshot(row: WalletRow): WalletSnapshot {
    return {
      id: row.id,
      userId: row.userId,
      userType: row.userType,
      purchasedTokens: row.purchasedTokens,
      membershipTokens: row.membershipTokens,
      bonusTokens: row.bonusTokens,
      totalTokens: row.purchasedTokens + row.membershipTokens + row.bonusTokens,
      lastUpdated: row.lastUpdated,
    };
  }
}
