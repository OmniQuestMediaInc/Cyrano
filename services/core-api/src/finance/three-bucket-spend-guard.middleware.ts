// services/core-api/src/finance/three-bucket-spend-guard.middleware.ts
// PAYLOAD 6 — Canonical Compliance Lockdown
//
// Final enforcement gate for the three-bucket wallet spend order:
//   Priority 1 — PROMOTIONAL_BONUS
//   Priority 2 — MEMBERSHIP_ALLOCATION
//   Priority 3 — PURCHASED
//
// The canonical order is already honoured inside LedgerService.debitWallet()
// (services/core-api/src/finance/ledger.service.ts). This middleware is the
// defence-in-depth layer: any controller that attaches an explicit spend
// plan to the request (via body.spendOrder / header x-spend-order) is
// checked here before the handler runs. A mis-ordered plan is rejected
// with 422 and an immutable audit event.

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ImmutableAuditService } from '../audit/immutable-audit.service';

export const THREE_BUCKET_RULE_ID = 'THREE_BUCKET_SPEND_GUARD_v1';

const CANONICAL_SPEND_ORDER = [
  'PROMOTIONAL_BONUS',
  'MEMBERSHIP_ALLOCATION',
  'MEMBERSHIP',
  'PURCHASED',
] as const;

type CanonicalBucket = (typeof CANONICAL_SPEND_ORDER)[number];

const BUCKET_PRIORITY: Record<string, number> = {
  PROMOTIONAL_BONUS:     1,
  MEMBERSHIP_ALLOCATION: 2,
  MEMBERSHIP:            2, // legacy alias — same priority
  PURCHASED:             3,
};

function extractSpendOrder(req: Request): string[] | null {
  const header = req.headers['x-spend-order'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.split(',').map((b) => b.trim().toUpperCase());
  }
  const body = (req as Request & { body?: Record<string, unknown> }).body;
  const bodyOrder = body?.spendOrder;
  if (Array.isArray(bodyOrder)) {
    return bodyOrder.map((b) => String(b).toUpperCase());
  }
  return null;
}

function violatesCanonicalOrder(order: string[]): { violated: boolean; reason: string | null } {
  let lastPriority = 0;
  for (const bucket of order) {
    const priority = BUCKET_PRIORITY[bucket];
    if (priority === undefined) {
      return {
        violated: true,
        reason: `UNKNOWN_BUCKET:${bucket}`,
      };
    }
    if (priority < lastPriority) {
      return {
        violated: true,
        reason: `OUT_OF_ORDER:${bucket}_AFTER_PRIORITY_${lastPriority}`,
      };
    }
    lastPriority = priority;
  }
  return { violated: false, reason: null };
}

@Injectable()
export class ThreeBucketSpendGuardMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ThreeBucketSpendGuardMiddleware.name);

  constructor(private readonly audit: ImmutableAuditService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const order = extractSpendOrder(req);
    if (!order || order.length === 0) {
      // No explicit plan — LedgerService.debitWallet will choose canonical
      // order internally. Nothing to enforce here.
      return next();
    }

    const check = violatesCanonicalOrder(order);
    if (!check.violated) {
      return next();
    }

    const correlation_id = `spend_guard_${randomUUID()}`;
    const actor_id =
      (req.headers['x-actor-id'] as string | undefined) ?? 'unknown_actor';

    this.logger.warn('ThreeBucketSpendGuard: mis-ordered spend plan rejected', {
      actor_id,
      order,
      reason: check.reason,
      correlation_id,
      rule_applied_id: THREE_BUCKET_RULE_ID,
    });

    await this.audit.emit({
      eventType: 'SPEND',
      correlationId: correlation_id,
      actorId: actor_id,
      actorRole: 'system',
      reasonCode: 'THREE_BUCKET_ORDER_VIOLATION',
      redactedPayload: {
        violation_reason: check.reason,
        attempted_order: order,
        canonical_order: CANONICAL_SPEND_ORDER,
      },
      metadata: {
        path: req.path,
        rule_applied_id: THREE_BUCKET_RULE_ID,
      },
    });

    res.status(422).json({
      error: 'THREE_BUCKET_ORDER_VIOLATION',
      failure_reason: check.reason,
      canonical_order: ['PROMOTIONAL_BONUS', 'MEMBERSHIP_ALLOCATION', 'PURCHASED'],
      correlation_id,
      rule_applied_id: THREE_BUCKET_RULE_ID,
    });
  }
}

export type { CanonicalBucket };
