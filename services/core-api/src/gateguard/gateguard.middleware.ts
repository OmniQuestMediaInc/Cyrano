// services/core-api/src/gateguard/gateguard.middleware.ts
// PAYLOAD 3: Pre-Processor Middleware for /purchase, /spend, /payout.
//
// Wires the GateGuardService in front of every financial mutation route.
// Route handlers discover the evaluation via `req.gateGuard` — a typed
// GateGuardResult attached to the incoming request. If the decision is not
// APPROVE, the middleware responds with 402 (PURCHASE GATE BLOCKED) and
// the route handler NEVER runs.
//
// The middleware expects the route to advertise its action via a header
// (x-gateguard-action) OR the path itself (/purchase, /spend, /payout).
// Callers that need richer control can bypass the middleware and invoke
// GateGuardService.preProcess() directly.

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  GateGuardAction,
  GateGuardResult,
  GateGuardInput,
} from './gateguard.types';
import { GateGuardService } from './gateguard.service';

/** Paths handled by the pre-processor, mapped to their canonical action. */
const GATED_ROUTES: Array<{ prefix: string; action: GateGuardAction }> = [
  { prefix: '/purchase', action: 'PURCHASE' },
  { prefix: '/spend', action: 'SPEND' },
  { prefix: '/payout', action: 'PAYOUT' },
];

/**
 * Requests passed through GateGuard gain a typed `gateGuard` property.
 * Route handlers read this and consume the cleared score.
 */
export type GateGuardedRequest = Request & { gateGuard?: GateGuardResult };

/**
 * Extract the GateGuard action for this request. Explicit header wins; path
 * prefix falls through. Returns undefined when the route is not gated.
 */
function resolveAction(req: Request): GateGuardAction | undefined {
  const header = (req.headers['x-gateguard-action'] as string | undefined)?.toUpperCase();
  if (header === 'PURCHASE' || header === 'SPEND' || header === 'PAYOUT') {
    return header;
  }
  const match = GATED_ROUTES.find(r => req.path.startsWith(r.prefix));
  return match?.action;
}

/**
 * Robust BigInt coercion. Request bodies arrive as strings or numbers. We
 * insist on BigInt to match the ledger's append-only contract (WO-032).
 */
function coerceBigInt(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      throw new Error('INVALID_AMOUNT: amount must be an integer');
    }
    return BigInt(raw);
  }
  if (typeof raw === 'string') {
    if (!/^-?\d+$/.test(raw)) {
      throw new Error('INVALID_AMOUNT: amount must be a decimal integer string');
    }
    return BigInt(raw);
  }
  throw new Error('INVALID_AMOUNT: amount is required');
}

/**
 * Maps the GateGuardInput off of the request body. Callers that want full
 * control should bypass this middleware and invoke preProcess() explicitly.
 */
function buildInputFromRequest(req: Request, action: GateGuardAction): GateGuardInput {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const transactionId =
    (body.transactionId as string | undefined) ??
    (body.transaction_id as string | undefined) ??
    (req.headers['x-transaction-id'] as string | undefined);

  if (!transactionId) {
    throw new Error('GateGuardMiddleware: transactionId is required on gated routes');
  }

  const correlationId =
    (body.correlationId as string | undefined) ??
    (req.headers['x-correlation-id'] as string | undefined) ??
    randomUUID();

  const userId =
    (body.userId as string | undefined) ??
    (body.user_id as string | undefined) ??
    (req.headers['x-user-id'] as string | undefined);

  if (!userId) {
    throw new Error('GateGuardMiddleware: userId is required on gated routes');
  }

  const amountTokens = coerceBigInt(
    body.amountTokens ?? body.amount_tokens ?? body.amount,
  );

  return {
    transactionId,
    correlationId,
    userId,
    action,
    amountTokens,
    currency: 'CZT',
    welfareSignals: body.welfareSignals as GateGuardInput['welfareSignals'],
    fraudSignals: body.fraudSignals as GateGuardInput['fraudSignals'],
    avStatus: body.avStatus as GateGuardInput['avStatus'],
    federated: body.federated as GateGuardInput['federated'],
    metadata: body.metadata as Record<string, unknown> | undefined,
  };
}

@Injectable()
export class GateGuardMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GateGuardMiddleware.name);

  constructor(private readonly gateGuard: GateGuardService) {}

  async use(req: GateGuardedRequest, res: Response, next: NextFunction): Promise<void> {
    const action = resolveAction(req);
    if (!action) {
      // Not a gated route — pass through untouched.
      next();
      return;
    }

    let input: GateGuardInput;
    try {
      input = buildInputFromRequest(req, action);
    } catch (error) {
      this.logger.warn('GateGuardMiddleware: rejected — malformed input', {
        path: req.path,
        error: String(error),
      });
      res.status(400).json({
        error: 'GATEGUARD_BAD_REQUEST',
        message: String(error),
      });
      return;
    }

    try {
      const result = await this.gateGuard.evaluate(input);
      req.gateGuard = result;

      if (result.decision === 'APPROVE') {
        next();
        return;
      }

      // Non-approve paths never reach the route handler. Response payloads
      // are intentionally minimal — reason codes are persisted server-side.
      const statusCode =
        result.decision === 'HARD_DECLINE' || result.decision === 'HUMAN_ESCALATE'
          ? 402 // Payment Required — canonical "do not retry"
          : 409; // Conflict — safe-retry after cool-off

      res.status(statusCode).json({
        error: `GATEGUARD_${result.decision}`,
        decision: result.decision,
        transaction_id: result.transactionId,
        correlation_id: result.correlationId,
        reason_codes: result.riskFactors.reasonCodes,
        fraud_score: result.fraudScore,
        welfare_score: result.welfareScore,
        rule_applied_id: result.ruleAppliedId,
      });
    } catch (error) {
      this.logger.error('GateGuardMiddleware: evaluation failed', {
        path: req.path,
        error: String(error),
      });
      res.status(500).json({
        error: 'GATEGUARD_EVALUATION_FAILED',
        message: String(error),
      });
    }
  }
}
