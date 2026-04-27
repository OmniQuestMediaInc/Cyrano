// PAYLOAD 5+ — Cyrano Translation Layer (Issue #15 — Phase 4)
// Real-time text + voice translation bridge for Layer 4 enterprise prompts.
//
// Phase 0 approach (consistent with voice bridge):
//   • Returns a fully-shaped CyranoLayer4TranslationEnvelope on every call so
//     callers never branch on null — `translated_copy` is empty when
//     translation was skipped and `skipped_reason_code` is populated.
//   • The actual machine-translation backend is stubbed. The envelope is wired
//     so a Phase 1 implementer can swap in Google Translate / DeepL / AWS
//     Translate by replacing the `_translateText` method.
//   • Supported locales are declared as a canonical constant so the set can be
//     extended by a governance-config update in Phase 1.
//   • All events are emitted on NATS so analytics + audit subscribers get
//     real-time translation activity.
//
// Canonical invariants:
//   • Every outcome carries correlation_id + reason_code + rule_applied_id.
//   • No PII or raw copy is logged — only locale/tenant metadata.
//   • NATS-only real-time fabric — no REST polling.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4TranslationEnvelope,
  type CyranoLayer4TranslationSkipReason,
} from './cyrano-layer4.types';

/** BCP-47 locale code (e.g. "en-US", "fr-FR"). */
export type Locale = string;

/** Source locale for all Cyrano baseline templates. */
export const CYRANO_SOURCE_LOCALE: Locale = 'en-US';

/**
 * Canonical set of supported target locales for Phase 0.
 * Phase 1 expands this via a governance-config table lookup.
 */
export const CYRANO_SUPPORTED_LOCALES = new Set<Locale>([
  'en-US',
  'en-GB',
  'fr-FR',
  'fr-CA',
  'es-ES',
  'es-MX',
  'de-DE',
  'pt-BR',
  'pt-PT',
  'it-IT',
  'nl-NL',
  'pl-PL',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'zh-TW',
]);

export interface TranslateInput {
  /** Tenant requesting the translation (for audit + NATS emission). */
  tenant_id: string;
  /** The source copy to translate (canonical en-US baseline). */
  source_copy: string;
  /** BCP-47 target locale. */
  target_locale: Locale;
  /** Caller correlation id — threaded through every event. */
  correlation_id: string;
}

@Injectable()
export class CyranoTranslationService {
  private readonly logger = new Logger(CyranoTranslationService.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Translate `source_copy` into `target_locale`.
   *
   * Returns an envelope every time:
   *   - `translated_copy` is populated on success.
   *   - `translated_copy` is empty and `skipped_reason_code` is set on skip.
   */
  translate(input: TranslateInput): CyranoLayer4TranslationEnvelope {
    const { tenant_id, source_copy, target_locale, correlation_id } = input;

    // No-op when source and target are the same locale.
    if (target_locale === CYRANO_SOURCE_LOCALE) {
      return this.skip(
        tenant_id,
        target_locale,
        correlation_id,
        'TRANSLATION_LOCALE_SAME_AS_SOURCE',
      );
    }

    // Guard empty copy.
    if (!source_copy || !source_copy.trim()) {
      return this.skip(
        tenant_id,
        target_locale,
        correlation_id,
        'TRANSLATION_INPUT_EMPTY',
      );
    }

    // Unsupported locale gate.
    if (!CYRANO_SUPPORTED_LOCALES.has(target_locale)) {
      return this.skip(
        tenant_id,
        target_locale,
        correlation_id,
        'TRANSLATION_LOCALE_NOT_SUPPORTED',
      );
    }

    // Phase 0 stub — emit the request event and return a tagged placeholder.
    // Phase 1 replaces this with an async call to the translation backend.
    this.nats.publish(NATS_TOPICS.CYRANO_TRANSLATION_REQUESTED, {
      tenant_id,
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    });

    const translated_copy = this._translateText(source_copy, target_locale);

    this.nats.publish(NATS_TOPICS.CYRANO_TRANSLATION_COMPLETED, {
      tenant_id,
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    });

    this.logger.debug('CyranoTranslationService: translation completed', {
      tenant_id,
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    return {
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      translated_copy,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  private skip(
    tenant_id: string,
    target_locale: Locale,
    correlation_id: string,
    skipped_reason_code: CyranoLayer4TranslationSkipReason,
  ): CyranoLayer4TranslationEnvelope {
    const natsTopicMap: Record<CyranoLayer4TranslationSkipReason, string> = {
      TRANSLATION_LOCALE_SAME_AS_SOURCE: NATS_TOPICS.CYRANO_TRANSLATION_SKIPPED,
      TRANSLATION_INPUT_EMPTY:           NATS_TOPICS.CYRANO_TRANSLATION_SKIPPED,
      TRANSLATION_LOCALE_NOT_SUPPORTED:  NATS_TOPICS.CYRANO_TRANSLATION_UNSUPPORTED,
      TRANSLATION_DISABLED_BY_TENANT:    NATS_TOPICS.CYRANO_TRANSLATION_SKIPPED,
    };

    this.nats.publish(natsTopicMap[skipped_reason_code], {
      tenant_id,
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      skipped_reason_code,
      correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    });

    return {
      source_locale: CYRANO_SOURCE_LOCALE,
      target_locale,
      translated_copy: '',
      skipped_reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  /**
   * Phase 0 stub — returns a tagged placeholder that is structurally valid
   * so the envelope can be wired end-to-end before the real provider arrives.
   *
   * Phase 1 contract: replace this method body with an async/await call to
   * the chosen MT provider (Google Cloud Translation / DeepL / AWS Translate).
   * The return type and call signature must remain identical.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _translateText(sourceCopy: string, _targetLocale: Locale): string {
    // Deterministic stub — prefix signals Phase 0 to downstream callers.
    return `[${_targetLocale}] ${sourceCopy}`;
  }
}
