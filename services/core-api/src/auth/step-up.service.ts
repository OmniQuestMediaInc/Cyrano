// services/core-api/src/auth/step-up.service.ts
// AUTH: AUTH-001 — Step-up authentication service
// Canonical Corpus v10, Chapter 7 §8.2
// Required for: wallet modification, payout changes, takedown, freeze, deletion, refund override.
// TOTP (RFC 6238) only. SMS is prohibited as primary method.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export type StepUpAction =
  | 'WALLET_MODIFICATION'
  | 'PAYOUT_CHANGE'
  | 'TAKEDOWN_SUBMISSION'
  | 'ACCOUNT_FREEZE'
  | 'CONTENT_DELETION'
  | 'REFUND_OVERRIDE'
  | 'GEO_BLOCK_MODIFICATION'
  | 'PAYMENT_DETAIL_CHANGE';

export type StepUpMethod = 'TOTP' | 'BACKUP_CODE';

export interface StepUpChallenge {
  challenge_id: string;
  actor_id: string;
  action: StepUpAction;
  method: StepUpMethod;
  issued_at_utc: string;
  expires_at_utc: string;
  device_fingerprint: string;
  rule_applied_id: string;
}

export interface StepUpVerificationResult {
  verified: boolean;
  challenge_id: string;
  actor_id: string;
  action: StepUpAction;
  verified_at_utc: string | null;
  failure_reason: string | null;
  rule_applied_id: string;
}

const CHALLENGE_WINDOW_SECS = 300;

const STEP_UP_REQUIRED_ACTIONS = new Set<StepUpAction>([
  'WALLET_MODIFICATION',
  'PAYOUT_CHANGE',
  'TAKEDOWN_SUBMISSION',
  'ACCOUNT_FREEZE',
  'CONTENT_DELETION',
  'REFUND_OVERRIDE',
  'GEO_BLOCK_MODIFICATION',
  'PAYMENT_DETAIL_CHANGE',
]);

@Injectable()
export class StepUpService {
  private readonly logger = new Logger(StepUpService.name);
  private readonly RULE_ID = 'STEP_UP_AUTH_v1';

  constructor(private readonly nats: NatsService) {}

  requiresStepUp(action: StepUpAction): boolean {
    return STEP_UP_REQUIRED_ACTIONS.has(action);
  }

  issueChallenge(params: {
    challenge_id: string;
    actor_id: string;
    action: StepUpAction;
    method: StepUpMethod;
    device_fingerprint: string;
  }): StepUpChallenge {
    if (!this.requiresStepUp(params.action)) {
      throw new Error(
        `STEP_UP_NOT_REQUIRED: action ${params.action} does not require step-up authentication.`,
      );
    }
    const now = new Date();
    const expires = new Date(now.getTime() + CHALLENGE_WINDOW_SECS * 1000);
    const challenge: StepUpChallenge = {
      challenge_id: params.challenge_id,
      actor_id: params.actor_id,
      action: params.action,
      method: params.method,
      issued_at_utc: now.toISOString(),
      expires_at_utc: expires.toISOString(),
      device_fingerprint: params.device_fingerprint,
      rule_applied_id: this.RULE_ID,
    };
    this.logger.log('StepUpService: challenge issued', {
      challenge_id: challenge.challenge_id,
      actor_id: challenge.actor_id,
      action: challenge.action,
      method: challenge.method,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.STEP_UP_CHALLENGE_ISSUED, {
      challenge_id: challenge.challenge_id,
      actor_id: challenge.actor_id,
      action: challenge.action,
      method: challenge.method,
      expires_at_utc: challenge.expires_at_utc,
      device_fingerprint: challenge.device_fingerprint,
      rule_applied_id: this.RULE_ID,
    });
    return challenge;
  }

  verifyChallenge(params: {
    challenge: StepUpChallenge;
    token_valid: boolean;
    device_fingerprint: string;
  }): StepUpVerificationResult {
    const now = new Date();
    const expired = now > new Date(params.challenge.expires_at_utc);
    if (expired) {
      this.logger.warn('StepUpService: challenge expired', {
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        rule_applied_id: this.RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.STEP_UP_CHALLENGE_FAILED, {
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        failure_reason: 'CHALLENGE_EXPIRED',
        device_fingerprint: params.device_fingerprint,
        rule_applied_id: this.RULE_ID,
      });
      return {
        verified: false,
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        verified_at_utc: null,
        failure_reason: 'CHALLENGE_EXPIRED',
        rule_applied_id: this.RULE_ID,
      };
    }
    if (!params.token_valid) {
      this.logger.warn('StepUpService: token invalid', {
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        rule_applied_id: this.RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.STEP_UP_CHALLENGE_FAILED, {
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        failure_reason: 'TOKEN_INVALID',
        device_fingerprint: params.device_fingerprint,
        rule_applied_id: this.RULE_ID,
      });
      return {
        verified: false,
        challenge_id: params.challenge.challenge_id,
        actor_id: params.challenge.actor_id,
        action: params.challenge.action,
        verified_at_utc: null,
        failure_reason: 'TOKEN_INVALID',
        rule_applied_id: this.RULE_ID,
      };
    }
    const verified_at_utc = now.toISOString();
    this.logger.log('StepUpService: challenge verified', {
      challenge_id: params.challenge.challenge_id,
      actor_id: params.challenge.actor_id,
      action: params.challenge.action,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.STEP_UP_CHALLENGE_VERIFIED, {
      challenge_id: params.challenge.challenge_id,
      actor_id: params.challenge.actor_id,
      action: params.challenge.action,
      verified_at_utc,
      device_fingerprint: params.device_fingerprint,
      rule_applied_id: this.RULE_ID,
    });
    return {
      verified: true,
      challenge_id: params.challenge.challenge_id,
      actor_id: params.challenge.actor_id,
      action: params.challenge.action,
      verified_at_utc,
      failure_reason: null,
      rule_applied_id: this.RULE_ID,
    };
  }
}
