// services/zone-gpt/src/proposal.service.ts
// GOV: ZONE-GPT Proposal Object service — Corpus v10 Ch.8 §6
// AI is advisory only. Every proposal requires human ACCEPT/REJECT/MODIFY.
// No execution occurs without a logged human decision.
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export type ProposalType =
  | 'PRICE_ADVISORY'
  | 'MODERATION_SUGGESTION'
  | 'RISK_FLAG'
  | 'CONTENT_DRAFT'
  | 'INCIDENT_SUMMARY'
  | 'COMPLIANCE_GUIDANCE';

export type ProposalDecision = 'ACCEPT' | 'REJECT' | 'MODIFY';

export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'EXPIRED';

export interface Proposal {
  proposal_id: string;
  proposal_type: ProposalType;
  reference_object_id: string;   // ID of the entity this proposal concerns
  rationale: string;
  canonical_basis: string;       // Corpus section or rule that grounds this proposal
  suggested_action: string;
  confidence_score: number;      // 0.00–1.00
  status: ProposalStatus;
  created_at_utc: string;
  expires_at_utc: string;        // Proposals auto-expire — no indefinite pending states
  decision?: {
    decision: ProposalDecision;
    decision_actor_id: string;
    decided_at_utc: string;
    reason_code: string;
    modified_action?: string;    // Populated when decision = MODIFY
  };
}

export interface CreateProposalInput {
  proposal_type: ProposalType;
  reference_object_id: string;
  rationale: string;
  canonical_basis: string;
  suggested_action: string;
  confidence_score: number;
  ttl_hours?: number;            // Default 24h
}

export interface RecordDecisionInput {
  proposal_id: string;
  decision: ProposalDecision;
  decision_actor_id: string;
  reason_code: string;
  modified_action?: string;
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name);
  // In-memory store for MVP — replace with DB-backed table in GM-003 / follow-on
  private readonly proposals = new Map<string, Proposal>();
  private readonly RULE_ID = 'ZONE_GPT_PROPOSAL_v1';
  private readonly DEFAULT_TTL_HOURS = 24;

  /**
   * Creates a new AI proposal. Does not execute any action.
   * All proposals begin in PENDING status.
   */
  createProposal(input: CreateProposalInput): Proposal {
    if (input.confidence_score < 0 || input.confidence_score > 1) {
      throw new Error('INVALID_CONFIDENCE: confidence_score must be between 0.00 and 1.00');
    }

    const now = new Date();
    const ttl = input.ttl_hours ?? this.DEFAULT_TTL_HOURS;
    const expires = new Date(now.getTime() + ttl * 60 * 60 * 1000);

    const proposal_id = createHash('sha256')
      .update(`${input.proposal_type}:${input.reference_object_id}:${now.toISOString()}`)
      .digest('hex')
      .substring(0, 32);

    const proposal: Proposal = {
      proposal_id,
      proposal_type: input.proposal_type,
      reference_object_id: input.reference_object_id,
      rationale: input.rationale,
      canonical_basis: input.canonical_basis,
      suggested_action: input.suggested_action,
      confidence_score: input.confidence_score,
      status: 'PENDING',
      created_at_utc: now.toISOString(),
      expires_at_utc: expires.toISOString(),
    };

    this.proposals.set(proposal_id, proposal);

    this.logger.log('ProposalService: proposal created — awaiting human decision', {
      proposal_id,
      proposal_type: input.proposal_type,
      reference_object_id: input.reference_object_id,
      confidence_score: input.confidence_score,
      rule_applied_id: this.RULE_ID,
    });

    return proposal;
  }

  /**
   * Records a human decision on a proposal.
   * This is the ONLY way a proposal transitions from PENDING.
   * No silent acceptance — decision_actor_id is mandatory.
   */
  recordDecision(input: RecordDecisionInput): Proposal {
    const proposal = this.proposals.get(input.proposal_id);

    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: ${input.proposal_id}`);
    }

    if (proposal.status !== 'PENDING') {
      throw new Error(
        `PROPOSAL_ALREADY_DECIDED: proposal ${input.proposal_id} ` +
        `is already in status ${proposal.status}`
      );
    }

    if (!input.decision_actor_id || input.decision_actor_id.trim().length === 0) {
      throw new Error('ACTOR_REQUIRED: decision_actor_id is mandatory. No silent acceptance.');
    }

    if (!input.reason_code || input.reason_code.trim().length === 0) {
      throw new Error('REASON_CODE_REQUIRED: reason_code must be provided with every decision.');
    }

    if (input.decision === 'MODIFY' && !input.modified_action) {
      throw new Error('MODIFIED_ACTION_REQUIRED: modified_action must be provided when decision = MODIFY.');
    }

    const new_status: ProposalStatus =
      input.decision === 'ACCEPT' ? 'ACCEPTED' :
      input.decision === 'REJECT' ? 'REJECTED' : 'MODIFIED';

    proposal.status = new_status;
    proposal.decision = {
      decision: input.decision,
      decision_actor_id: input.decision_actor_id,
      decided_at_utc: new Date().toISOString(),
      reason_code: input.reason_code,
      modified_action: input.modified_action,
    };

    this.proposals.set(input.proposal_id, proposal);

    this.logger.log('ProposalService: human decision recorded', {
      proposal_id: input.proposal_id,
      decision: input.decision,
      decision_actor_id: input.decision_actor_id,
      reason_code: input.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    return proposal;
  }

  getProposal(proposal_id: string): Proposal | undefined {
    return this.proposals.get(proposal_id);
  }

  getPendingProposals(): Proposal[] {
    const now = new Date();
    return Array.from(this.proposals.values()).filter(p => {
      if (p.status !== 'PENDING') return false;
      if (new Date(p.expires_at_utc) < now) {
        p.status = 'EXPIRED';
        return false;
      }
      return true;
    });
  }
}
