"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProposalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let ProposalService = ProposalService_1 = class ProposalService {
    constructor() {
        this.logger = new common_1.Logger(ProposalService_1.name);
        this.proposals = new Map();
        this.RULE_ID = 'ZONE_GPT_PROPOSAL_v1';
        this.DEFAULT_TTL_HOURS = 24;
    }
    createProposal(input) {
        if (input.confidence_score < 0 || input.confidence_score > 1) {
            throw new Error('INVALID_CONFIDENCE: confidence_score must be between 0.00 and 1.00');
        }
        const now = new Date();
        const ttl = input.ttl_hours ?? this.DEFAULT_TTL_HOURS;
        const expires = new Date(now.getTime() + ttl * 60 * 60 * 1000);
        const proposal_id = (0, crypto_1.createHash)('sha256')
            .update(`${input.proposal_type}:${input.reference_object_id}:${now.toISOString()}`)
            .digest('hex')
            .substring(0, 32);
        const proposal = {
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
    recordDecision(input) {
        const proposal = this.proposals.get(input.proposal_id);
        if (!proposal) {
            throw new Error(`PROPOSAL_NOT_FOUND: ${input.proposal_id}`);
        }
        if (proposal.status !== 'PENDING') {
            throw new Error(`PROPOSAL_ALREADY_DECIDED: proposal ${input.proposal_id} ` +
                `is already in status ${proposal.status}`);
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
        const new_status = input.decision === 'ACCEPT' ? 'ACCEPTED' :
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
    getProposal(proposal_id) {
        return this.proposals.get(proposal_id);
    }
    getPendingProposals() {
        const now = new Date();
        return Array.from(this.proposals.values()).filter(p => {
            if (p.status !== 'PENDING')
                return false;
            if (new Date(p.expires_at_utc) < now) {
                p.status = 'EXPIRED';
                return false;
            }
            return true;
        });
    }
};
exports.ProposalService = ProposalService;
exports.ProposalService = ProposalService = ProposalService_1 = __decorate([
    (0, common_1.Injectable)()
], ProposalService);
//# sourceMappingURL=proposal.service.js.map