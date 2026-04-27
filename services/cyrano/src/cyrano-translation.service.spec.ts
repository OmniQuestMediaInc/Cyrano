// PAYLOAD 5+ — Cyrano Translation Service tests (Issue #15 — Phase 4)
// Covers:
//   • Supported locale → translated_copy populated
//   • Same-locale → skip with TRANSLATION_LOCALE_SAME_AS_SOURCE
//   • Unsupported locale → skip with TRANSLATION_LOCALE_NOT_SUPPORTED
//   • Empty copy → skip with TRANSLATION_INPUT_EMPTY
//   • NATS emit contract (publish called vs skipped)

import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  CYRANO_SOURCE_LOCALE,
  CYRANO_SUPPORTED_LOCALES,
  CyranoTranslationService,
} from './cyrano-translation.service';

function buildService() {
  const nats = new NatsService();
  const publishSpy = jest.spyOn(nats, 'publish').mockReturnValue(undefined as never);
  const svc = new CyranoTranslationService(nats);
  return { svc, publishSpy };
}

describe('CyranoTranslationService', () => {
  describe('supported locale', () => {
    it('returns a populated translated_copy for a supported target locale', () => {
      const { svc } = buildService();
      const result = svc.translate({
        tenant_id: 'ten-1',
        source_copy: 'Hello world',
        target_locale: 'fr-FR',
        correlation_id: 'corr-1',
      });
      expect(result.translated_copy).toBeTruthy();
      expect(result.target_locale).toBe('fr-FR');
      expect(result.source_locale).toBe(CYRANO_SOURCE_LOCALE);
      expect(result.skipped_reason_code).toBeUndefined();
    });

    it('emits CYRANO_TRANSLATION_REQUESTED and CYRANO_TRANSLATION_COMPLETED', () => {
      const { svc, publishSpy } = buildService();
      svc.translate({
        tenant_id: 'ten-2',
        source_copy: 'Hello',
        target_locale: 'de-DE',
        correlation_id: 'corr-2',
      });
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.translation.requested');
      expect(topics).toContain('cyrano.translation.completed');
    });
  });

  describe('same-locale skip', () => {
    it('skips with TRANSLATION_LOCALE_SAME_AS_SOURCE when target matches source', () => {
      const { svc } = buildService();
      const result = svc.translate({
        tenant_id: 'ten-3',
        source_copy: 'Hello',
        target_locale: 'en-US',
        correlation_id: 'corr-3',
      });
      expect(result.translated_copy).toBe('');
      expect(result.skipped_reason_code).toBe('TRANSLATION_LOCALE_SAME_AS_SOURCE');
    });

    it('emits CYRANO_TRANSLATION_SKIPPED for same-locale', () => {
      const { svc, publishSpy } = buildService();
      svc.translate({
        tenant_id: 'ten-4',
        source_copy: 'Hello',
        target_locale: 'en-US',
        correlation_id: 'corr-4',
      });
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.translation.skipped');
    });
  });

  describe('unsupported locale', () => {
    it('skips with TRANSLATION_LOCALE_NOT_SUPPORTED for unknown locale', () => {
      const { svc } = buildService();
      const result = svc.translate({
        tenant_id: 'ten-5',
        source_copy: 'Hello',
        target_locale: 'xx-YY',
        correlation_id: 'corr-5',
      });
      expect(result.translated_copy).toBe('');
      expect(result.skipped_reason_code).toBe('TRANSLATION_LOCALE_NOT_SUPPORTED');
    });

    it('emits CYRANO_TRANSLATION_UNSUPPORTED for unknown locale', () => {
      const { svc, publishSpy } = buildService();
      svc.translate({
        tenant_id: 'ten-6',
        source_copy: 'Hello',
        target_locale: 'xx-YY',
        correlation_id: 'corr-6',
      });
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.translation.unsupported');
    });
  });

  describe('empty copy', () => {
    it('skips with TRANSLATION_INPUT_EMPTY when copy is blank', () => {
      const { svc } = buildService();
      const result = svc.translate({
        tenant_id: 'ten-7',
        source_copy: '   ',
        target_locale: 'fr-FR',
        correlation_id: 'corr-7',
      });
      expect(result.translated_copy).toBe('');
      expect(result.skipped_reason_code).toBe('TRANSLATION_INPUT_EMPTY');
    });
  });

  describe('supported locales set', () => {
    it('includes common major locales', () => {
      expect(CYRANO_SUPPORTED_LOCALES.has('fr-FR')).toBe(true);
      expect(CYRANO_SUPPORTED_LOCALES.has('es-ES')).toBe(true);
      expect(CYRANO_SUPPORTED_LOCALES.has('de-DE')).toBe(true);
      expect(CYRANO_SUPPORTED_LOCALES.has('ja-JP')).toBe(true);
      expect(CYRANO_SUPPORTED_LOCALES.has('zh-CN')).toBe(true);
    });
  });
});
