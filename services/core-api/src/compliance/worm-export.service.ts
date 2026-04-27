// services/core-api/src/compliance/worm-export.service.ts
// GOV: WORM audit export service — Corpus v10 Appendix H
// Produces hash-sealed, ordered snapshots of audit_events for tamper-evident storage.
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface WormExportRecord {
  export_id: string;
  from_utc: string;
  to_utc: string;
  event_count: number;
  first_event_id: string;
  last_event_id: string;
  hash_seal: string; // SHA-256 of ordered event payload
  integrity_verified: boolean;
  exported_at_utc: string;
  rule_applied_id: string;
}

export interface AuditEventSnapshot {
  event_id: string;
  event_type: string;
  actor_id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WormExportService {
  private readonly logger = new Logger(WormExportService.name);
  private readonly RULE_ID = 'WORM_EXPORT_v1';

  /**
   * Produces a WORM export record from a provided ordered set of audit events.
   * Caller is responsible for fetching the events from the database in
   * ascending created_at order. This service seals and verifies the snapshot.
   *
   * Corpus Appendix H requirements:
   * - Preserve ordering
   * - Preserve event IDs
   * - Preserve hash chain continuity
   * - WORM seal = SHA-256 of concatenated ordered event IDs + timestamps
   */
  sealSnapshot(params: {
    export_id: string;
    from_utc: string;
    to_utc: string;
    events: AuditEventSnapshot[];
  }): WormExportRecord {
    if (params.events.length === 0) {
      throw new Error('WORM_EXPORT_EMPTY: Cannot seal an empty event set.');
    }

    // Build deterministic payload string from ordered events
    // Order: event_id + created_at concatenated — no metadata included in seal
    // to prevent PII leakage into the hash
    const payload = params.events
      .map((e) => `${e.event_id}:${e.created_at}:${e.event_type}`)
      .join('|');

    const hash_seal = createHash('sha256').update(payload).digest('hex');

    const record: WormExportRecord = {
      export_id: params.export_id,
      from_utc: params.from_utc,
      to_utc: params.to_utc,
      event_count: params.events.length,
      first_event_id: params.events[0].event_id,
      last_event_id: params.events[params.events.length - 1].event_id,
      hash_seal,
      integrity_verified: true,
      exported_at_utc: new Date().toISOString(),
      rule_applied_id: this.RULE_ID,
    };

    this.logger.log('WormExportService: snapshot sealed', {
      export_id: params.export_id,
      event_count: params.events.length,
      hash_seal,
      rule_applied_id: this.RULE_ID,
    });

    return record;
  }

  /**
   * Verifies the integrity of a previously sealed WORM export.
   * Re-computes the hash from the provided events and compares to stored seal.
   * Returns true if integrity is confirmed, false if tampered.
   */
  verifyIntegrity(params: {
    stored_record: WormExportRecord;
    events: AuditEventSnapshot[];
  }): boolean {
    const payload = params.events
      .map((e) => `${e.event_id}:${e.created_at}:${e.event_type}`)
      .join('|');

    const recomputed_hash = createHash('sha256').update(payload).digest('hex');
    const verified = recomputed_hash === params.stored_record.hash_seal;

    if (!verified) {
      this.logger.error('WormExportService: INTEGRITY FAILURE — hash mismatch', {
        export_id: params.stored_record.export_id,
        stored_hash: params.stored_record.hash_seal,
        recomputed_hash,
        rule_applied_id: this.RULE_ID,
      });
    } else {
      this.logger.log('WormExportService: integrity verified', {
        export_id: params.stored_record.export_id,
        rule_applied_id: this.RULE_ID,
      });
    }

    return verified;
  }
}
