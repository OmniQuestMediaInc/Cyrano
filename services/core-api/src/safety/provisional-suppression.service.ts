// WO: WO-034
// ProvisionalSuppressionService — NCII Suppression Engine
// Phase 2 Safety Infrastructure (Corpus v10 Chapter 3 Alignment)
// Doctrine: No automated permanent enforcement without human confirmation.
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { db } from '../db';
import { logger } from '../logger';
import { PrismaService } from '../prisma.service';

export type SuppressionAction = 'SUPPRESS' | 'BLOCK_REUPLOAD';
export type SuppressionStatus = 'PROVISIONAL' | 'FINALIZED' | 'LIFTED';

export interface SuppressionRecord {
  content_id: string;
  case_id: string;
  rule_applied_id: string;
  status: SuppressionStatus;
  suppressed_at: Date;
  hash?: string;
}

export interface AuditEvent {
  event_type:
    | 'SUPPRESSION_APPLIED'
    | 'SUPPRESSION_LIFTED'
    | 'SUPPRESSION_FINALIZED'
    | 'UPLOAD_BLOCKED';
  severity: 'SEV1';
  content_id: string;
  case_id: string;
  rule_applied_id: string;
  timestamp_utc: string;
  actor?: string;
}

export interface EvidencePacket {
  case_id: string;
  hash_reference: string;
  rule_applied_id: string;
  incident_timeline: Array<{ event: string; timestamp: string }>;
  generated_at_utc: string;
}

// ---------------------------------------------------------------------------
// Typed accessor for the content_hash_registry table.
// The Prisma schema must include this table for runtime operation.
// ---------------------------------------------------------------------------
interface ContentHashRegistryRow {
  hash: string;
  case_id: string;
  action_taken: SuppressionAction;
  rule_applied_id: string;
  created_at_utc: Date;
  created_at_toronto: string;
}

interface ContentHashRegistryCreateInput {
  hash: string;
  case_id: string;
  action_taken: SuppressionAction;
  rule_applied_id: string;
}

interface ContentHashRegistryTable {
  create(args: { data: ContentHashRegistryCreateInput }): Promise<ContentHashRegistryRow>;
  findMany(args: {
    where?: { case_id?: string };
    orderBy?: { created_at_utc?: 'asc' | 'desc' };
  }): Promise<ContentHashRegistryRow[]>;
}

interface DbWithContentHashRegistry {
  content_hash_registry: ContentHashRegistryTable;
}

function getRegistry(): ContentHashRegistryTable {
  return (db as unknown as DbWithContentHashRegistry).content_hash_registry;
}

@Injectable()
export class ProvisionalSuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Immediately suppresses content provisionally upon receipt of a credible report.
   * Status is PROVISIONAL and REVERSIBLE until a human moderator finalizes it.
   * Emits a SEV1 Audit_Event with rule_applied_id.
   *
   * WO-034 Task 2 — Suppression-First Workflow Logic.
   */
  async suppressContent(
    contentId: string,
    caseId: string,
    ruleAppliedId: string,
  ): Promise<SuppressionRecord> {
    const row = await this.prisma.contentSuppressionQueue.create({
      data: {
        content_id: contentId,
        case_id: caseId,
        rule_applied_id: ruleAppliedId,
        status: 'PROVISIONAL',
      },
    });

    const record: SuppressionRecord = {
      content_id: row.content_id,
      case_id: row.case_id,
      rule_applied_id: row.rule_applied_id,
      status: row.status as SuppressionStatus,
      suppressed_at: row.suppressed_at,
    };

    const auditEvent: AuditEvent = {
      event_type: 'SUPPRESSION_APPLIED',
      severity: 'SEV1',
      content_id: contentId,
      case_id: caseId,
      rule_applied_id: ruleAppliedId,
      timestamp_utc: new Date().toISOString(),
    };

    logger.warn('ProvisionalSuppressionService: SEV1 — content provisionally suppressed', {
      context: 'ProvisionalSuppressionService',
      audit_event: auditEvent,
    });

    return record;
  }

  /**
   * Lifts a provisional suppression before human moderator finalization.
   * Only valid while status is PROVISIONAL. FINALIZED suppressions cannot be lifted.
   *
   * WO-034 Task 2 — Reversibility guarantee.
   */
  async liftSuppression(contentId: string, moderatorId: string): Promise<void> {
    const record = await this.prisma.contentSuppressionQueue.findFirst({
      where: { content_id: contentId, status: 'PROVISIONAL' },
    });

    if (!record) {
      logger.warn('ProvisionalSuppressionService: liftSuppression — no provisional record found', {
        context: 'ProvisionalSuppressionService',
        contentId,
        moderatorId,
      });
      return;
    }

    if (record.status === 'FINALIZED') {
      throw new Error(
        `Suppression for content ${contentId} is FINALIZED and cannot be lifted. ` +
          'Permanent suppressions require a formal legal reversal process.',
      );
    }

    await this.prisma.contentSuppressionQueue.update({
      where: { id: record.id },
      data: {
        status: 'LIFTED',
        lifted_at: new Date(),
        lifted_by: moderatorId,
      },
    });

    logger.info('ProvisionalSuppressionService: provisional suppression lifted by moderator', {
      context: 'ProvisionalSuppressionService',
      contentId,
      caseId: record.case_id,
      moderatorId,
    });
  }

  /**
   * Finalizes a provisional suppression after human moderator confirmation.
   * Writes the content hash to the append-only content_hash_registry.
   * This action is PERMANENT and IRREVERSIBLE per append-only doctrine.
   *
   * WO-034 Task 2 — Human-confirmed finalization.
   */
  async finalizeAndRegisterHash(
    contentId: string,
    contentHash: string,
    action: SuppressionAction,
  ): Promise<void> {
    const record = await this.prisma.contentSuppressionQueue.findFirst({
      where: { content_id: contentId, status: 'PROVISIONAL' },
    });

    if (!record) {
      throw new Error(
        `Cannot finalize: no PROVISIONAL suppression found for content ${contentId}. ` +
          'Human moderator must review a PROVISIONAL record before finalization.',
      );
    }

    await getRegistry().create({
      data: {
        hash: contentHash,
        case_id: record.case_id,
        action_taken: action,
        rule_applied_id: record.rule_applied_id,
      },
    });

    await this.prisma.contentSuppressionQueue.update({
      where: { id: record.id },
      data: {
        status: 'FINALIZED',
        content_hash: contentHash,
        finalized_at: new Date(),
      },
    });

    const auditEvent: AuditEvent = {
      event_type: 'SUPPRESSION_FINALIZED',
      severity: 'SEV1',
      content_id: contentId,
      case_id: record.case_id,
      rule_applied_id: record.rule_applied_id,
      timestamp_utc: new Date().toISOString(),
    };

    logger.warn('ProvisionalSuppressionService: SEV1 — suppression finalized and hash registered', {
      context: 'ProvisionalSuppressionService',
      audit_event: auditEvent,
      hash: contentHash,
    });
  }

  /**
   * Generates an Evidence Packet for a given case.
   * Collects the incident timeline, hash references (NOT the file content),
   * and the rule applied. Suitable for legal or compliance handoff.
   *
   * WO-034 Task 4 — Evidence Packet Stub.
   */
  async generateEvidencePacket(caseId: string): Promise<EvidencePacket> {
    const registryEntries = await getRegistry().findMany({
      where: { case_id: caseId },
      orderBy: { created_at_utc: 'asc' },
    });

    const timeline: Array<{ event: string; timestamp: string }> = registryEntries.map((entry) => ({
      event: `Hash registered: action=${entry.action_taken}, rule=${entry.rule_applied_id}`,
      timestamp: entry.created_at_utc.toISOString(),
    }));

    // Include provisional suppression events for this case from the DB
    const suppressionRecords = await this.prisma.contentSuppressionQueue.findMany({
      where: { case_id: caseId },
    });

    for (const record of suppressionRecords) {
      timeline.push({
        event: `Provisional suppression: status=${record.status}, rule=${record.rule_applied_id}`,
        timestamp: record.suppressed_at.toISOString(),
      });
    }

    timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const hashReferences = registryEntries.map((e) => e.hash);
    const ruleApplied = registryEntries.length > 0 ? registryEntries[0].rule_applied_id : 'UNKNOWN';

    const packet: EvidencePacket = {
      case_id: caseId,
      hash_reference: hashReferences.join(', '),
      rule_applied_id: ruleApplied,
      incident_timeline: timeline,
      generated_at_utc: new Date().toISOString(),
    };

    logger.info('ProvisionalSuppressionService: evidence packet generated', {
      context: 'ProvisionalSuppressionService',
      caseId,
      hashCount: hashReferences.length,
      timelineEvents: timeline.length,
    });

    return packet;
  }

  /**
   * Computes the SHA-256 hash of a file buffer.
   * Utility method for callers that need to pre-compute a hash before suppression.
   */
  static computeHash(fileBuffer: Buffer): string {
    return createHash('sha256').update(fileBuffer).digest('hex');
  }
}
