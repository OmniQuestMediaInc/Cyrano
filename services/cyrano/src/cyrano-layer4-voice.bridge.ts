// PAYLOAD 5+ — Cyrano Layer 4 voice bridge
// Phase 0 placeholder (Layer 4 v1) — bridge into the platform's shared
// voice service. Phase 0 is contractually correct (it returns a fully-
// shaped envelope and emits the canonical NATS topic) but the actual
// synthesis backend is stubbed: the bridge produces a deterministic
// `cyrano-l4://voice/{request_id}` URI that downstream callers can wire
// to the real TTS provider in Phase 3.
//
// The shared voice service (services/core-api/src/dfsp/voice-sample.service.ts)
// already owns the consent, retention, and disposal envelopes for voice
// data; this bridge is the read-side facade Layer 4 prompts call into.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ReasonCode,
  type CyranoLayer4Tenant,
  type CyranoLayer4VoiceEnvelope,
} from './cyrano-layer4.types';

export interface SynthesiseVoiceInput {
  tenant: CyranoLayer4Tenant;
  copy: string;
  voice_id?: string;
  locale?: string;
  correlation_id: string;
  /** HIPAA / GDPR consent-receipt id, when applicable. */
  consent_receipt_id?: string | null;
}

const DEFAULT_VOICE_ID = 'cyrano_neutral_en';
const DEFAULT_LOCALE = 'en-US';

/**
 * Per-domain default voice profile. Phase 3 ships these as constants so
 * the bridge has deterministic routing; Phase 4 will move them to a
 * governance config table.
 */
const DOMAIN_DEFAULT_VOICE: Record<string, { voice_id: string; locale: string }> = {
  ADULT_ENTERTAINMENT: { voice_id: 'cyrano_intimate_en', locale: 'en-US' },
  TEACHING:            { voice_id: 'cyrano_clear_en',    locale: 'en-US' },
  COACHING:            { voice_id: 'cyrano_warm_en',     locale: 'en-US' },
  FIRST_RESPONDER:     { voice_id: 'cyrano_command_en',  locale: 'en-US' },
  FACTORY_SAFETY:      { voice_id: 'cyrano_command_en',  locale: 'en-US' },
  MEDICAL:             { voice_id: 'cyrano_calm_en',     locale: 'en-US' },
};

@Injectable()
export class CyranoLayer4VoiceBridge {
  private readonly logger = new Logger(CyranoLayer4VoiceBridge.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Synthesise (or skip with a structured reason) a voice clip. Returns
   * the envelope EVERY time so the caller never has to branch on null —
   * `voice_uri` is empty when synthesis was skipped, and
   * `skipped_reason_code` is populated.
   */
  synthesise(input: SynthesiseVoiceInput): CyranoLayer4VoiceEnvelope {
    if (!input.tenant.voice_enabled) {
      return this.skip(input, 'VOICE_NOT_PERMITTED');
    }
    if (!input.copy) {
      return this.skip(input, 'VOICE_DISABLED_BY_REQUEST');
    }
    // HIPAA tenants must attach a consent-receipt id for any voice
    // synthesis call so the receipt can be cited in audit chains.
    if (input.tenant.compliance_regime === 'HIPAA' && !input.consent_receipt_id) {
      return this.skip(input, 'CONSENT_RECEIPT_MISSING');
    }

    const domainDefaults =
      DOMAIN_DEFAULT_VOICE[input.tenant.domain] ?? {
        voice_id: DEFAULT_VOICE_ID,
        locale: DEFAULT_LOCALE,
      };
    const voice_id = input.voice_id ?? domainDefaults.voice_id;
    const locale = input.locale ?? domainDefaults.locale;
    const voice_request_id = randomUUID();
    // Deterministic placeholder URI — Phase 3 surface; the actual TTS
    // provider integration is wired by the platform voice service team.
    const voice_uri = `cyrano-l4://voice/${input.tenant.tenant_id}/${voice_request_id}`;

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_VOICE_SYNTHESIZED, {
      tenant_id: input.tenant.tenant_id,
      voice_id,
      locale,
      voice_request_id,
      voice_uri,
      correlation_id: input.correlation_id,
      reason_code: 'VOICE_SYNTHESIZED',
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    });

    this.logger.debug('CyranoLayer4VoiceBridge: voice synthesised', {
      tenant_id: input.tenant.tenant_id,
      voice_id,
      locale,
      correlation_id: input.correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    return {
      voice_id,
      locale,
      voice_uri,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  private skip(
    input: SynthesiseVoiceInput,
    skipped_reason_code: CyranoLayer4ReasonCode,
  ): CyranoLayer4VoiceEnvelope {
    const voice_id = input.voice_id ?? DEFAULT_VOICE_ID;
    const locale = input.locale ?? DEFAULT_LOCALE;

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_VOICE_SKIPPED, {
      tenant_id: input.tenant.tenant_id,
      voice_id,
      locale,
      correlation_id: input.correlation_id,
      reason_code: skipped_reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    });

    return {
      voice_id,
      locale,
      voice_uri: '',
      skipped_reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }
}
