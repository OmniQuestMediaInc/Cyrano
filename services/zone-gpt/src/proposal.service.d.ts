export type ProposalType = 'PRICE_ADVISORY' | 'MODERATION_SUGGESTION' | 'RISK_FLAG' | 'CONTENT_DRAFT' | 'INCIDENT_SUMMARY' | 'COMPLIANCE_GUIDANCE';
export type ProposalDecision = 'ACCEPT' | 'REJECT' | 'MODIFY';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'EXPIRED';
export interface Proposal {
    proposal_id: string;
    proposal_type: ProposalType;
    reference_object_id: string;
    rationale: string;
    canonical_basis: string;
    suggested_action: string;
    confidence_score: number;
    status: ProposalStatus;
    created_at_utc: string;
    expires_at_utc: string;
    decision?: {
        decision: ProposalDecision;
        decision_actor_id: string;
        decided_at_utc: string;
        reason_code: string;
        modified_action?: string;
    };
}
export interface CreateProposalInput {
    proposal_type: ProposalType;
    reference_object_id: string;
    rationale: string;
    canonical_basis: string;
    suggested_action: string;
    confidence_score: number;
    ttl_hours?: number;
}
export interface RecordDecisionInput {
    proposal_id: string;
    decision: ProposalDecision;
    decision_actor_id: string;
    reason_code: string;
    modified_action?: string;
}
export declare class ProposalService {
    private readonly logger;
    private readonly proposals;
    private readonly RULE_ID;
    private readonly DEFAULT_TTL_HOURS;
    createProposal(input: CreateProposalInput): Proposal;
    recordDecision(input: RecordDecisionInput): Proposal;
    getProposal(proposal_id: string): Proposal | undefined;
    getPendingProposals(): Proposal[];
}
