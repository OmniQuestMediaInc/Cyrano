// PAYLOAD 5+ — Cyrano Layer 4 API key management service
// Phase 0 (Layer 4 v1) — minimum viable surface used by the Layer 4 guard:
//   • mint(tenant_id, label) → returns the raw key ONCE plus a hashed record
//   • verify({tenant_id, raw_key}) → constant-time hash check + isolation
//   • revoke(api_key_id) → marks key inactive
//
// Phase 2 hardens this with Argon2/bcrypt, persistence to a dedicated
// `cyrano_layer4_api_keys` table, and rotation policies. The interface
// stays stable so the Phase 0 guard never has to be rewritten.

import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ApiKey,
  type CyranoLayer4ApiKeyMint,
  type CyranoLayer4ReasonCode,
} from './cyrano-layer4.types';

export interface MintApiKeyInput {
  tenant_id: string;
  label?: string;
  correlation_id?: string;
  reason_code?: string;
}

export interface VerifyApiKeyInput {
  tenant_id: string;
  raw_key: string;
}

export type VerifyApiKeyResult =
  | { allowed: true; api_key_id: string; reason_code: 'TENANT_AUTHORIZED' }
  | { allowed: false; api_key_id: null; reason_code: CyranoLayer4ReasonCode };

@Injectable()
export class CyranoLayer4ApiKeyService {
  private readonly logger = new Logger(CyranoLayer4ApiKeyService.name);
  /** key_hash → record. Lookup is O(n) per tenant in Phase 0; Prisma index in Phase 2. */
  private readonly keys = new Map<string, CyranoLayer4ApiKey>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Generate a fresh key for a tenant. The raw key is returned ONCE;
   * the persisted record stores only the SHA-256 hash + an 8-char prefix
   * for audit/UI. Caller is responsible for delivering the raw key to the
   * tenant via a side-channel.
   */
  mint(input: MintApiKeyInput): CyranoLayer4ApiKeyMint {
    const raw_key = `czl4_${randomBytes(32).toString('base64url')}`;
    const key_hash = this.hashKey(raw_key);
    const api_key_id = randomUUID();
    const created_at_utc = new Date().toISOString();
    const correlation_id = input.correlation_id ?? randomUUID();
    const reason_code = input.reason_code ?? 'API_KEY_MINTED';
    const key_prefix = raw_key.slice(0, 8);

    const record: CyranoLayer4ApiKey = {
      api_key_id,
      tenant_id: input.tenant_id,
      key_hash,
      key_prefix,
      label: input.label ?? 'default',
      active: true,
      created_at_utc,
      last_used_at_utc: null,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };

    this.keys.set(key_hash, record);

    this.logger.log('CyranoLayer4ApiKeyService: API key minted', {
      api_key_id,
      tenant_id: input.tenant_id,
      key_prefix,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_API_KEY_ISSUED, {
      api_key_id,
      tenant_id: input.tenant_id,
      key_prefix,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: created_at_utc,
    });

    return {
      api_key_id,
      tenant_id: input.tenant_id,
      raw_key,
      key_prefix,
      created_at_utc,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  /** Verify a raw key against the registry. Constant-time hash compare. */
  async verify(input: VerifyApiKeyInput): Promise<VerifyApiKeyResult> {
    if (!input.raw_key) {
      return { allowed: false, api_key_id: null, reason_code: 'API_KEY_MISSING' };
    }
    const candidate_hash = this.hashKey(input.raw_key);
    const record = this.keys.get(candidate_hash);
    if (!record) {
      return { allowed: false, api_key_id: null, reason_code: 'API_KEY_INVALID' };
    }
    if (record.tenant_id !== input.tenant_id) {
      // Tenant mismatch is a hard isolation breach attempt — never let a
      // valid key for tenant A authenticate against tenant B.
      this.logger.warn('CyranoLayer4ApiKeyService: cross-tenant key reuse blocked', {
        api_key_id: record.api_key_id,
        owner_tenant_id: record.tenant_id,
        claimed_tenant_id: input.tenant_id,
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
      return { allowed: false, api_key_id: null, reason_code: 'TENANT_MISMATCH' };
    }
    if (!record.active) {
      return { allowed: false, api_key_id: null, reason_code: 'API_KEY_REVOKED' };
    }

    // Defensive constant-time compare on the key_hash buffers themselves
    // even though Map lookup already matched — catches a future bug where
    // the lookup index drifts from the hash.
    if (!this.constantTimeEquals(candidate_hash, record.key_hash)) {
      return { allowed: false, api_key_id: null, reason_code: 'API_KEY_INVALID' };
    }

    record.last_used_at_utc = new Date().toISOString();
    return {
      allowed: true,
      api_key_id: record.api_key_id,
      reason_code: 'TENANT_AUTHORIZED',
    };
  }

  /** Mark a key inactive. Idempotent. Emits a revocation event. */
  revoke(api_key_id: string, reason_code = 'API_KEY_REVOKED_BY_TENANT'): boolean {
    for (const record of this.keys.values()) {
      if (record.api_key_id !== api_key_id) continue;
      if (!record.active) return true;
      record.active = false;
      this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_API_KEY_REVOKED, {
        api_key_id,
        tenant_id: record.tenant_id,
        reason_code,
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
        emitted_at_utc: new Date().toISOString(),
      });
      this.logger.log('CyranoLayer4ApiKeyService: API key revoked', {
        api_key_id,
        tenant_id: record.tenant_id,
        reason_code,
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
      return true;
    }
    return false;
  }

  /** Read records for a tenant (hashes only — never returns raw keys). */
  listForTenant(tenant_id: string): CyranoLayer4ApiKey[] {
    return Array.from(this.keys.values())
      .filter((k) => k.tenant_id === tenant_id)
      .map((k) => ({ ...k }));
  }

  /** Test seam. */
  reset(): void {
    this.keys.clear();
  }

  private hashKey(raw_key: string): string {
    // Phase 0 uses SHA-256 for deterministic, dependency-free hashing.
    // Phase 2 swaps to Argon2id without changing the public surface.
    return createHash('sha256').update(raw_key).digest('hex');
  }

  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }
}
