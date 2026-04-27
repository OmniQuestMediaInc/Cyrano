// WO: WO-034
// UploadInterceptorMiddleware — NCII Upload Pipeline Hook
// Phase 2 Safety Infrastructure (Corpus v10 Chapter 3 Alignment)
// Hashes every incoming file and blocks uploads matching the content_hash_registry.
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { db } from '../db';
import { logger } from '../logger';

export interface UploadCandidate {
  fileBuffer: Buffer;
  filename: string;
  contentType: string;
  uploaderUserId: string;
}

export interface InterceptResult {
  allowed: boolean;
  hash: string;
  blockReason?: string;
  incidentId?: string;
}

// ---------------------------------------------------------------------------
// Typed accessor for the content_hash_registry table.
// The Prisma schema must include this table for runtime operation.
// ---------------------------------------------------------------------------
interface ContentHashRegistryRow {
  hash: string;
  case_id: string;
  action_taken: string;
  rule_applied_id: string;
}

interface ContentHashRegistryLookupTable {
  findUnique(args: { where: { hash: string } }): Promise<ContentHashRegistryRow | null>;
}

interface DbWithContentHashRegistry {
  content_hash_registry: ContentHashRegistryLookupTable;
}

function getRegistry(): ContentHashRegistryLookupTable {
  return (db as unknown as DbWithContentHashRegistry).content_hash_registry;
}

/**
 * WO-034 Task 3 — Upload Pipeline Interceptor.
 *
 * Middleware hook for the content upload pipeline. Computes a SHA-256 hash
 * of every incoming file and checks it against the content_hash_registry.
 * If a match is found, the upload is blocked immediately and the attempt
 * is logged as a SEV1 incident.
 */
@Injectable()
export class UploadInterceptorMiddleware {
  /**
   * Intercepts an upload candidate.
   * - Computes SHA-256 hash of fileBuffer.
   * - Looks up hash in content_hash_registry.
   * - If matched: blocks upload and emits SEV1 incident log.
   * - If not matched: allows upload through.
   */
  async intercept(candidate: UploadCandidate): Promise<InterceptResult> {
    const hash = UploadInterceptorMiddleware.computeHash(candidate.fileBuffer);

    const registryEntry = await getRegistry().findUnique({ where: { hash } });

    if (registryEntry) {
      // Hash matched — block upload and log SEV1 incident
      const incidentLog = {
        event_type: 'UPLOAD_BLOCKED',
        severity: 'SEV1',
        hash,
        action_taken: registryEntry.action_taken,
        rule_applied_id: registryEntry.rule_applied_id,
        case_id: registryEntry.case_id,
        uploader_user_id: candidate.uploaderUserId,
        filename: candidate.filename,
        content_type: candidate.contentType,
        timestamp_utc: new Date().toISOString(),
      };

      logger.error(
        'UploadInterceptorMiddleware: SEV1 — upload blocked, hash matched registry',
        undefined,
        {
          context: 'UploadInterceptorMiddleware',
          audit_event: incidentLog,
        },
      );

      return {
        allowed: false,
        hash,
        blockReason:
          `Content hash matches registry entry. ` +
          `action_taken=${registryEntry.action_taken}, ` +
          `rule_applied_id=${registryEntry.rule_applied_id}`,
        incidentId: registryEntry.case_id,
      };
    }

    logger.info('UploadInterceptorMiddleware: hash checked — upload allowed', {
      context: 'UploadInterceptorMiddleware',
      hash,
      uploaderUserId: candidate.uploaderUserId,
      filename: candidate.filename,
    });

    return { allowed: true, hash };
  }

  /**
   * Computes a SHA-256 hex digest of the given file buffer.
   * Deterministic — same input always produces the same output.
   */
  static computeHash(fileBuffer: Buffer): string {
    return createHash('sha256').update(fileBuffer).digest('hex');
  }
}
