// CYR: Wave K — Diamond Concierge Premium Service Layer
// Manages concierge session creation for Inferno-tier subscribers.
// Access gate: Subscription.tier === 'INFERNO' (Cyrano portal subscription).
//
// This service is the DB-layer counterpart to the pure pricing/quoting service
// in services/diamond-concierge/src/diamond.service.ts. It does NOT touch any
// financial balances — it is a session-routing surface only.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type ConciergeSessionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ConciergeSessionPriority = 'high' | 'normal';

export interface ConciergeSessionRecord {
  id: string;
  user_id: string;
  request: string;
  status: ConciergeSessionStatus;
  priority: ConciergeSessionPriority;
  correlation_id: string;
  reason_code: string;
  created_at: Date;
  updated_at: Date;
}

/** Minimal subscription view needed for the tier gate. */
export interface SubscriptionView {
  tier: string;
  status: string;
}

/** Repository contract — Prisma adapter in core-api; in-memory in tests. */
export interface ConciergeSessionRepository {
  findActiveSubscription(user_id: string): Promise<SubscriptionView | null>;
  insertSession(record: Omit<ConciergeSessionRecord, 'created_at' | 'updated_at'>): Promise<ConciergeSessionRecord>;
  findById(id: string): Promise<ConciergeSessionRecord | null>;
  findByUserId(user_id: string): Promise<ConciergeSessionRecord[]>;
}

export class ConciergeAccessDeniedError extends Error {
  readonly statusCode = 403;
  constructor() {
    super('Diamond Concierge requires Inferno tier');
    this.name = 'ConciergeAccessDeniedError';
  }
}

export class ConciergeRequestTooLongError extends Error {
  readonly statusCode = 400;
  constructor(max: number) {
    super(`Concierge request must be at most ${max} characters`);
    this.name = 'ConciergeRequestTooLongError';
  }
}

export const CONCIERGE_SESSION_RULE_ID = 'DIAMOND_CONCIERGE_SESSION_v1';
const MAX_REQUEST_CHARS = 2_000;

@Injectable()
export class DiamondConciergeSessionService {
  private readonly logger = new Logger(DiamondConciergeSessionService.name);
  private readonly RULE_ID = CONCIERGE_SESSION_RULE_ID;

  constructor(private readonly repo: ConciergeSessionRepository) {}

  /**
   * Create a concierge session for an Inferno-tier subscriber.
   * Access is denied if the user does not hold an ACTIVE INFERNO subscription.
   *
   * Invariants:
   *   • Subscription tier MUST be INFERNO (and status ACTIVE) — 403 otherwise.
   *   • Request body capped at MAX_REQUEST_CHARS characters — 400 otherwise.
   *   • Each session gets a unique correlation_id.
   */
  async createConciergeSession(
    userId: string,
    request: string,
    priority: ConciergeSessionPriority = 'high',
  ): Promise<ConciergeSessionRecord> {
    if (request.length > MAX_REQUEST_CHARS) {
      throw new ConciergeRequestTooLongError(MAX_REQUEST_CHARS);
    }

    const sub = await this.repo.findActiveSubscription(userId);
    if (sub?.tier !== 'INFERNO' || sub?.status !== 'ACTIVE') {
      throw new ConciergeAccessDeniedError();
    }

    const record = await this.repo.insertSession({
      id: randomUUID(),
      user_id: userId,
      request,
      status: 'pending',
      priority,
      correlation_id: `CONCIERGE:${userId}:${Date.now()}:${randomUUID().slice(0, 8)}`,
      reason_code: 'CONCIERGE_REQUEST',
    });

    this.logger.log('DiamondConciergeSessionService: session created', {
      session_id: record.id,
      user_id: userId,
      priority,
      rule_applied_id: this.RULE_ID,
    });

    return record;
  }

  /** Retrieve a session by its ID. */
  async getSession(id: string): Promise<ConciergeSessionRecord | null> {
    return this.repo.findById(id);
  }

  /** List all sessions for a user, ordered by most recent first. */
  async listUserSessions(userId: string): Promise<ConciergeSessionRecord[]> {
    const sessions = await this.repo.findByUserId(userId);
    return sessions.slice().sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );
  }
}

// ─── In-memory test repository ─────────────────────────────────────────────────

export class InMemoryConciergeSessionRepository implements ConciergeSessionRepository {
  private readonly subscriptions: Map<string, SubscriptionView> = new Map();
  private readonly sessions: ConciergeSessionRecord[] = [];

  seedSubscription(userId: string, sub: SubscriptionView): void {
    this.subscriptions.set(userId, sub);
  }

  async findActiveSubscription(user_id: string): Promise<SubscriptionView | null> {
    return this.subscriptions.get(user_id) ?? null;
  }

  async insertSession(
    record: Omit<ConciergeSessionRecord, 'created_at' | 'updated_at'>,
  ): Promise<ConciergeSessionRecord> {
    const now = new Date();
    const persisted: ConciergeSessionRecord = { ...record, created_at: now, updated_at: now };
    this.sessions.push(persisted);
    return persisted;
  }

  async findById(id: string): Promise<ConciergeSessionRecord | null> {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async findByUserId(user_id: string): Promise<ConciergeSessionRecord[]> {
    return this.sessions.filter((s) => s.user_id === user_id);
  }
}
