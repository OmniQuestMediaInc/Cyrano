// OBS: OBS-001 — OBSBridgeService
// RTMP ingest surface for OBS clients and native browser streams.
// Validates stream key against Creator.stream_key_hash (SHA-256 only).
// Emits NATS events on connect, disconnect, and key rotation.
import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export interface StreamConnectInput {
  creatorId: string;
  streamKey: string;
  organizationId: string;
  tenantId: string;
}

@Injectable()
export class OBSBridgeService {
  private readonly logger = new Logger(OBSBridgeService.name);
  private readonly RULE_ID = 'OBS-001_BRIDGE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Validate an inbound RTMP (or browser-stream) connect attempt.
   * - Looks up the Creator record
   * - Hashes the provided stream key with SHA-256 and compares against
   *   `stream_key_hash` — plaintext keys are never stored or logged
   * - Publishes OBS_STREAM_STARTED on accept
   * - Throws UnauthorizedException on mismatch
   */
  async acceptConnection(input: StreamConnectInput): Promise<{ ok: true }> {
    const { creatorId, streamKey, organizationId, tenantId } = input;

    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) {
      this.logger.warn('OBSBridgeService.acceptConnection: creator not found', {
        creator_id: creatorId,
        rule_applied_id: this.RULE_ID,
      });
      throw new NotFoundException({
        message: 'Creator not found',
        creator_id: creatorId,
        rule_applied_id: this.RULE_ID,
      });
    }

    const providedHash = this.hashStreamKey(streamKey);
    if (!creator.stream_key_hash || creator.stream_key_hash !== providedHash) {
      this.logger.warn('OBSBridgeService.acceptConnection: stream key validation failed', {
        creator_id: creatorId,
        // plaintext key NEVER logged
        rule_applied_id: this.RULE_ID,
      });
      throw new UnauthorizedException({
        message: 'Invalid stream key',
        rule_applied_id: this.RULE_ID,
      });
    }

    this.logger.log('OBSBridgeService.acceptConnection: stream started', {
      creator_id: creatorId,
      rule_applied_id: this.RULE_ID,
    });

    this.natsService.publish(NATS_TOPICS.OBS_STREAM_STARTED, {
      creator_id: creatorId,
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: this.RULE_ID,
      timestamp: new Date().toISOString(),
    });

    return { ok: true };
  }

  /**
   * Record a stream disconnect — publishes OBS_STREAM_ENDED.
   */
  async endStream(creatorId: string, organizationId: string, tenantId: string): Promise<void> {
    this.logger.log('OBSBridgeService.endStream: stream ended', {
      creator_id: creatorId,
      rule_applied_id: this.RULE_ID,
    });

    this.natsService.publish(NATS_TOPICS.OBS_STREAM_ENDED, {
      creator_id: creatorId,
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: this.RULE_ID,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Regenerate the creator's stream key.
   * - Stores SHA-256 hash only; returns plaintext to the caller ONE TIME
   *   for transmission to the creator out-of-band. Caller must not log it.
   * - Publishes OBS_STREAM_KEY_ROTATED.
   */
  async regenerateStreamKey(
    creatorId: string,
    organizationId: string,
    tenantId: string,
  ): Promise<{ plaintext: string }> {
    const ruleAppliedId = 'OBS-001_KEY_ROTATE_v1';
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) {
      throw new NotFoundException({
        message: 'Creator not found',
        creator_id: creatorId,
        rule_applied_id: ruleAppliedId,
      });
    }

    const plaintext = this.generatePlaintextKey();
    const hash = this.hashStreamKey(plaintext);

    await this.prisma.creator.update({
      where: { id: creatorId },
      data: {
        stream_key_hash: hash,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    this.logger.log('OBSBridgeService.regenerateStreamKey: rotated', {
      creator_id: creatorId,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.OBS_STREAM_KEY_ROTATED, {
      creator_id: creatorId,
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });

    return { plaintext };
  }

  private hashStreamKey(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }

  private generatePlaintextKey(): string {
    return randomBytes(24).toString('hex');
  }
}
