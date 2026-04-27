// services/studio-affiliation/src/studio-contract.service.ts
// RBAC-STUDIO-001 — contract upload + typed-name signing.
//
// Storage abstraction: callers pass a `storage_uri` (e.g. s3://bucket/key
// or assets-service ref). We persist the URI + a SHA-256 of the bytes so a
// later sign() call can reject a tampered document.
//
// MVP signing: a typed-name signature (creator types their full legal name).
// Replace with cryptographic signing in a follow-up — interface stable.
//
// Every state transition emits ImmutableAudit + NATS:
//   UPLOAD → STUDIO_CONTRACT_UPLOADED
//   SIGN   → STUDIO_CONTRACT_SIGNED

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { StudioContractDocument, StudioContractStatus } from '@prisma/client';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { ImmutableAuditService } from '../../core-api/src/audit/immutable-audit.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export const STUDIO_CONTRACT_RULE_ID = 'STUDIO_AFFILIATION_v1';

export interface UploadContractParams {
  studio_id: string;
  creator_id: string;
  storage_uri: string;
  document_bytes: Buffer | string; // bytes used to compute integrity hash
  organization_id: string;
  tenant_id: string;
  correlation_id?: string;
}

export interface SignContractParams {
  contract_id: string;
  creator_id: string;
  typed_name: string;
  /**
   * Caller must pass the same document bytes that were uploaded; if the
   * SHA-256 differs, the sign call is rejected with CONTRACT_INTEGRITY_FAIL.
   */
  document_bytes: Buffer | string;
  correlation_id?: string;
}

export interface ContractPublic {
  id: string;
  studio_id: string;
  creator_id: string;
  status: StudioContractStatus;
  storage_uri: string;
  document_hash: string;
  signed_typed_name: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class StudioContractService {
  private readonly logger = new Logger(StudioContractService.name);
  private readonly RULE_ID = STUDIO_CONTRACT_RULE_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly audit: ImmutableAuditService,
  ) {}

  private hashBytes(bytes: Buffer | string): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  private toPublic(row: StudioContractDocument): ContractPublic {
    return {
      id: row.id,
      studio_id: row.studio_id,
      creator_id: row.creator_id,
      status: row.status,
      storage_uri: row.storage_uri,
      document_hash: row.document_hash,
      signed_typed_name: row.signed_typed_name,
      signed_at: row.signed_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  async upload(params: UploadContractParams): Promise<ContractPublic> {
    const correlation_id = params.correlation_id ?? `studio_contract_${randomUUID()}`;
    const document_hash = this.hashBytes(params.document_bytes);

    const studio = await this.prisma.studio.findUnique({
      where: { id: params.studio_id },
      select: { id: true, status: true },
    });
    if (!studio) throw new NotFoundException(`STUDIO_NOT_FOUND: ${params.studio_id}`);
    if (studio.status === 'CLOSED') {
      throw new BadRequestException('CONTRACT_UPLOAD_INVALID: studio is CLOSED');
    }

    const row = await this.prisma.studioContractDocument.create({
      data: {
        studio_id: params.studio_id,
        creator_id: params.creator_id,
        storage_uri: params.storage_uri,
        document_hash,
        status: 'UPLOADED',
        correlation_id,
        reason_code: 'CONTRACT_UPLOAD',
        rule_applied_id: this.RULE_ID,
        organization_id: params.organization_id,
        tenant_id: params.tenant_id,
      },
    });

    await this.audit.emit({
      eventType: 'DIAMOND_CONTRACT',
      correlationId: correlation_id,
      actorId: params.creator_id,
      actorRole: 'creator',
      reasonCode: 'CONTRACT_UPLOAD',
      redactedPayload: {
        contract_id: row.id,
        studio_id: params.studio_id,
        document_hash,
      },
      metadata: { rule: this.RULE_ID },
    });

    this.nats.publish(NATS_TOPICS.STUDIO_CONTRACT_UPLOADED, {
      contract_id: row.id,
      studio_id: params.studio_id,
      creator_id: params.creator_id,
      document_hash,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return this.toPublic(row);
  }

  async sign(params: SignContractParams): Promise<ContractPublic> {
    if (!params.typed_name || params.typed_name.trim().length < 2) {
      throw new BadRequestException('CONTRACT_SIGN_INPUT: typed_name required');
    }
    const correlation_id = params.correlation_id ?? `studio_sign_${randomUUID()}`;

    const existing = await this.prisma.studioContractDocument.findUnique({
      where: { id: params.contract_id },
    });
    if (!existing) throw new NotFoundException(`CONTRACT_NOT_FOUND: ${params.contract_id}`);
    if (existing.creator_id !== params.creator_id) {
      throw new BadRequestException('CONTRACT_SIGN_FORBIDDEN: creator mismatch');
    }
    if (existing.status === 'SIGNED' || existing.status === 'COUNTERSIGNED') {
      // Idempotent — return existing.
      return this.toPublic(existing);
    }
    if (existing.status === 'VOIDED') {
      throw new BadRequestException('CONTRACT_SIGN_INVALID: contract is VOIDED');
    }

    const recomputed = this.hashBytes(params.document_bytes);
    if (recomputed !== existing.document_hash) {
      throw new BadRequestException(
        'CONTRACT_INTEGRITY_FAIL: document_bytes hash does not match upload',
      );
    }

    const updated = await this.prisma.studioContractDocument.update({
      where: { id: existing.id },
      data: {
        status: 'SIGNED',
        signed_typed_name: params.typed_name.trim(),
        signed_at: new Date(),
        correlation_id,
        reason_code: 'CONTRACT_SIGNED',
        rule_applied_id: this.RULE_ID,
      },
    });

    await this.audit.emit({
      eventType: 'DIAMOND_CONTRACT',
      correlationId: correlation_id,
      actorId: params.creator_id,
      actorRole: 'creator',
      reasonCode: 'CONTRACT_SIGNED',
      redactedPayload: {
        contract_id: existing.id,
        studio_id: existing.studio_id,
        document_hash: existing.document_hash,
        // typed_name redacted — store hash only in audit ledger
        typed_name_hash: createHash('sha256')
          .update(params.typed_name.trim())
          .digest('hex'),
      },
      metadata: { rule: this.RULE_ID },
    });

    this.nats.publish(NATS_TOPICS.STUDIO_CONTRACT_SIGNED, {
      contract_id: existing.id,
      studio_id: existing.studio_id,
      creator_id: params.creator_id,
      signed_at: updated.signed_at?.toISOString(),
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return this.toPublic(updated);
  }

  async listByStudio(studioId: string): Promise<ContractPublic[]> {
    const rows = await this.prisma.studioContractDocument.findMany({
      where: { studio_id: studioId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }
}
