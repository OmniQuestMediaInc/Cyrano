// WO: WO-032
import { createHash } from 'crypto';
import { GovernanceConfigService } from '../config/governance.config';
import { logger } from '../logger';

/**
 * WO-032: Cryptographic Hash-Chaining Audit Service.
 * Enforces an immutable, tamper-evident audit chain on Audit_Events.
 * - hash_current = SHA256(hash_prev + timestamp_utc + platform_time + actor_id + payload_hash)
 * - UPDATE and DELETE on Audit_Events are blocked with DOCTRINE_VIOLATION_ERROR.
 * - Every entry carries dual timestamps (UTC + America/Toronto).
 * - rule_applied_id is mandatory; defaults to GENERAL_GOVERNANCE_v10 when omitted.
 */

export const DOCTRINE_VIOLATION_ERROR = 'DOCTRINE_VIOLATION_ERROR';
export const DEFAULT_RULE_ID = 'GENERAL_GOVERNANCE_v10';

export interface AuditEventInput {
  actorId: string;
  payloadHash: string;
  metadata?: Record<string, unknown>;
  ruleAppliedId?: string;
}

export interface AuditEventRecord {
  hashPrev: string;
  hashCurrent: string;
  timestampUtc: string;
  platformTime: string;
  actorId: string;
  payloadHash: string;
  ruleAppliedId: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  private readonly config: GovernanceConfigService;
  private lastHash = '0'.repeat(64); // Genesis sentinel for the first entry

  constructor(config?: GovernanceConfigService) {
    this.config = config ?? new GovernanceConfigService();
  }

  /** Formats a Date as an ISO 8601 string in the given IANA timezone (e.g. America/Toronto). */
  private static toZonedISO(date: Date, timezone: string): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const p: Record<string, string> = {};
    for (const { type, value } of parts) p[type] = value;
    // Compute UTC offset: treating local parts as UTC and diffing against the
    // real epoch gives the offset (positive = behind UTC, e.g. America/Toronto).
    const localAsUtcMs = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const offsetMin = Math.round((date.getTime() - localAsUtcMs) / 60000);
    const sign = offsetMin >= 0 ? '-' : '+';
    const absMin = Math.abs(offsetMin);
    const oh = String(Math.floor(absMin / 60)).padStart(2, '0');
    const om = String(absMin % 60).padStart(2, '0');
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${oh}:${om}`;
  }

  /**
   * Records a new audit event, computing the SHA-256 hash chain link.
   * Returns the fully-populated AuditEventRecord (caller persists it).
   */
  public recordEvent(input: AuditEventInput): AuditEventRecord {
    const ruleAppliedId = input.ruleAppliedId ?? DEFAULT_RULE_ID;

    if (!input.ruleAppliedId) {
      logger.warn('REMEDIATION_REQUIRED: no rule_applied_id provided; defaulting', {
        default: DEFAULT_RULE_ID,
        actorId: input.actorId,
      });
    }

    const now = new Date();
    const timestampUtc = now.toISOString();
    const platformTime = AuditService.toZonedISO(now, this.config.TIMEZONE);

    const hashPrev = this.lastHash;
    const hashCurrent = createHash('sha256')
      .update(hashPrev + timestampUtc + platformTime + input.actorId + input.payloadHash)
      .digest('hex');

    this.lastHash = hashCurrent;

    return {
      hashPrev,
      hashCurrent,
      timestampUtc,
      platformTime,
      actorId: input.actorId,
      payloadHash: input.payloadHash,
      ruleAppliedId,
      metadata: input.metadata,
    };
  }

  /**
   * Blocked: UPDATE is not permitted on Audit_Events.
   * Throws DOCTRINE_VIOLATION_ERROR unconditionally.
   */
  public update(_id: string, _data: unknown): never {
    const msg =
      `${DOCTRINE_VIOLATION_ERROR}: UPDATE on Audit_Events is prohibited. ` +
      'Audit entries are immutable. Create a new correcting entry instead.';
    logger.error(msg);
    throw new Error(msg);
  }

  /**
   * Blocked: DELETE is not permitted on Audit_Events.
   * Throws DOCTRINE_VIOLATION_ERROR unconditionally.
   */
  public delete(_id: string): never {
    const msg =
      `${DOCTRINE_VIOLATION_ERROR}: DELETE on Audit_Events is prohibited. ` +
      'Audit entries are immutable and must never be removed.';
    logger.error(msg);
    throw new Error(msg);
  }
}
