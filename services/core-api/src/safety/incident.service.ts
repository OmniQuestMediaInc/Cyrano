// services/core-api/src/safety/incident.service.ts
// MOD: MOD-001 — Incident lifecycle state machine
// Canonical Corpus v10, Chapter 7 §6 + Appendix B + Appendix G
// Lifecycle: OPEN → UNDER_REVIEW → ACTIONED → CLOSED
// All transitions logged. No silent state changes.
// TAKE IT DOWN Act (effective May 2026): NCII incidents require 48-hour SLA enforcement.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export type IncidentStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACTIONED' | 'CLOSED';
export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3';
export type IncidentAssignedRole = 'MODERATOR' | 'COMPLIANCE' | 'ADMIN';
export type IncidentCategory =
  | 'NCII' // Non-consensual intimate imagery — 48h SLA (TAKE IT DOWN Act)
  | 'CSAM' // Child sexual abuse material — immediate SEV1
  | 'HATE_SPEECH'
  | 'VIOLENCE'
  | 'FRAUD'
  | 'OPERATIONAL'
  | 'OTHER';

// SLA window in milliseconds for categories requiring timed removal
const SLA_WINDOWS_MS: Partial<Record<IncidentCategory, number>> = {
  NCII: 48 * 60 * 60 * 1000, // 48 hours — TAKE IT DOWN Act, FTC enforced, effective May 2026
  CSAM: 0, // Immediate — no window, block on creation
};

export interface Incident {
  incident_id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  incident_category: IncidentCategory;
  assigned_role: IncidentAssignedRole;
  actor_id: string;
  content_id: string | null;
  evidence_hash: string | null;
  reason_code: string;
  resolution_summary: string | null;
  sla_deadline_utc: string | null; // null for non-SLA categories; set at creation for NCII/CSAM
  created_at_utc: string;
  updated_at_utc: string;
  closed_at_utc: string | null;
  rule_applied_id: string;
}

// Valid lifecycle transitions — enforced as allow-list
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ACTIONED'],
  ACTIONED: ['CLOSED'],
  CLOSED: [],
};

// Minimum role required to transition by severity
const SEVERITY_ROLE_REQUIREMENT: Record<IncidentSeverity, IncidentAssignedRole> = {
  SEV1: 'COMPLIANCE',
  SEV2: 'MODERATOR',
  SEV3: 'MODERATOR',
};

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);
  private readonly RULE_ID = 'INCIDENT_LIFECYCLE_v1';

  constructor(private readonly nats: NatsService) {}

  /**
   * Transitions an incident to a new status.
   * Validates transition is permitted.
   * Requires reason_code on every transition.
   * Publishes NATS event for every transition.
   * Throws on invalid transition — no silent state corruption.
   */
  transition(
    incident: Incident,
    to: IncidentStatus,
    params: {
      actor_id: string;
      reason_code: string;
      resolution_summary?: string;
      evidence_hash?: string;
    },
  ): Incident {
    const allowed = VALID_TRANSITIONS[incident.status];
    if (!allowed.includes(to)) {
      const msg =
        `INVALID_TRANSITION: ${incident.status} → ${to} is not permitted ` +
        `for incident ${incident.incident_id}. Allowed: [${allowed.join(', ')}]`;
      this.logger.error(msg, undefined, { incident_id: incident.incident_id });
      throw new Error(msg);
    }

    const now = new Date().toISOString();
    const updated: Incident = {
      ...incident,
      status: to,
      actor_id: params.actor_id,
      reason_code: params.reason_code,
      resolution_summary: params.resolution_summary ?? incident.resolution_summary,
      evidence_hash: params.evidence_hash ?? incident.evidence_hash,
      updated_at_utc: now,
      closed_at_utc: to === 'CLOSED' ? now : incident.closed_at_utc,
    };

    this.logger.log('IncidentService: status transition', {
      incident_id: incident.incident_id,
      from: incident.status,
      to,
      severity: incident.severity,
      actor_id: params.actor_id,
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.INCIDENT_TRANSITION, {
      incident_id: incident.incident_id,
      from: incident.status,
      to,
      severity: incident.severity,
      actor_id: params.actor_id,
      reason_code: params.reason_code,
      updated_at_utc: now,
      rule_applied_id: this.RULE_ID,
    });

    return updated;
  }

  /**
   * Returns the minimum role required to act on an incident of given severity.
   * Used for RBAC pre-check before transition — caller enforces.
   */
  getRequiredRole(severity: IncidentSeverity): IncidentAssignedRole {
    return SEVERITY_ROLE_REQUIREMENT[severity];
  }

  /**
   * Computes the SLA deadline UTC string for a given category at creation time.
   * Returns null for categories without a mandatory SLA window.
   * NCII: 48h (TAKE IT DOWN Act, FTC enforced, effective May 2026)
   * CSAM: immediate (SLA window = 0 — block must occur at creation)
   */
  computeSlaDeadline(category: IncidentCategory, created_at_utc: string): string | null {
    const windowMs = SLA_WINDOWS_MS[category];
    if (windowMs === undefined) return null;
    const deadline = new Date(new Date(created_at_utc).getTime() + windowMs);
    return deadline.toISOString();
  }

  /**
   * Returns true if an incident has breached its SLA window without being closed.
   * Advisory only — caller must execute removal or escalation.
   * TAKE IT DOWN Act compliance hook for NCII category.
   */
  isSlaBreach(incident: Incident): boolean {
    if (!incident.sla_deadline_utc) return false;
    if (incident.status === 'CLOSED') return false;
    return new Date() > new Date(incident.sla_deadline_utc);
  }
}
