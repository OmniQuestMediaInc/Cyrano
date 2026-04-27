// PAYLOAD 5+ — Cyrano Beta Registry + Analytics tests (Issue #16 — Phase 4)
// Covers:
//   CyranoBetaRegistryService
//     • Enroll up to BETA_MAX_CREATORS creators
//     • Idempotent enroll (ALREADY_ENROLLED)
//     • Reject over-capacity enrollment (BETA_CAPACITY_REACHED)
//     • Remove enrolled creator
//     • isEnrolled / listEnrolled / count
//   CyranoBetaAnalyticsService
//     • trackPrompt increments counters
//     • trackTranslation increments locale_distribution
//     • emitSummary aggregates across all creators
//     • block_rate_pct calculation
//     • emitSummary emits CYRANO_BETA_SUMMARY_EMITTED

import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  BETA_MAX_CREATORS,
  CyranoBetaRegistryService,
} from './cyrano-beta-registry.service';
import { CyranoBetaAnalyticsService } from './cyrano-beta-analytics.service';

function buildRegistry() {
  const nats = new NatsService();
  const publishSpy = jest.spyOn(nats, 'publish').mockReturnValue(undefined as never);
  const svc = new CyranoBetaRegistryService(nats);
  return { svc, publishSpy };
}

function buildAnalytics() {
  const nats = new NatsService();
  const publishSpy = jest.spyOn(nats, 'publish').mockReturnValue(undefined as never);
  const svc = new CyranoBetaAnalyticsService(nats);
  return { svc, publishSpy };
}

describe('CyranoBetaRegistryService', () => {
  describe('enrollment', () => {
    it('enrolls a creator successfully', () => {
      const { svc } = buildRegistry();
      const result = svc.enroll('creator-1');
      expect(result.enrolled).toBe(true);
      expect(result.creator_id).toBe('creator-1');
      expect(svc.count()).toBe(1);
      expect(svc.isEnrolled('creator-1')).toBe(true);
    });

    it('is idempotent — returns ALREADY_ENROLLED on second enroll', () => {
      const { svc } = buildRegistry();
      svc.enroll('creator-2');
      const second = svc.enroll('creator-2');
      expect(second.enrolled).toBe(false);
      expect(second.rejection_reason).toBe('ALREADY_ENROLLED');
      expect(svc.count()).toBe(1);
    });

    it('emits CYRANO_BETA_CREATOR_ENROLLED on NATS', () => {
      const { svc, publishSpy } = buildRegistry();
      svc.enroll('creator-3', 'corr-abc');
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.beta.creator.enrolled');
    });

    it(`rejects enrollment beyond BETA_MAX_CREATORS (${BETA_MAX_CREATORS})`, () => {
      const { svc } = buildRegistry();
      for (let i = 0; i < BETA_MAX_CREATORS; i++) {
        svc.enroll(`bulk-creator-${i}`);
      }
      const overflow = svc.enroll('overflow-creator');
      expect(overflow.enrolled).toBe(false);
      expect(overflow.rejection_reason).toBe('BETA_CAPACITY_REACHED');
      expect(svc.count()).toBe(BETA_MAX_CREATORS);
    });
  });

  describe('removal', () => {
    it('removes an enrolled creator', () => {
      const { svc } = buildRegistry();
      svc.enroll('creator-4');
      const removed = svc.remove('creator-4');
      expect(removed).toBe(true);
      expect(svc.isEnrolled('creator-4')).toBe(false);
      expect(svc.count()).toBe(0);
    });

    it('returns false when removing a non-existent creator', () => {
      const { svc } = buildRegistry();
      const removed = svc.remove('ghost-creator');
      expect(removed).toBe(false);
    });

    it('emits CYRANO_BETA_CREATOR_REMOVED on NATS', () => {
      const { svc, publishSpy } = buildRegistry();
      svc.enroll('creator-5');
      publishSpy.mockClear();
      svc.remove('creator-5');
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.beta.creator.removed');
    });

    it('allows re-enrollment after removal (frees capacity)', () => {
      const { svc } = buildRegistry();
      // Fill to capacity.
      for (let i = 0; i < BETA_MAX_CREATORS; i++) {
        svc.enroll(`cap-creator-${i}`);
      }
      // Remove one to free a slot.
      svc.remove('cap-creator-0');
      const result = svc.enroll('new-creator');
      expect(result.enrolled).toBe(true);
    });
  });

  describe('listing', () => {
    it('listEnrolled returns defensive copies', () => {
      const { svc } = buildRegistry();
      svc.enroll('creator-6');
      svc.enroll('creator-7');
      const list = svc.listEnrolled();
      expect(list).toHaveLength(2);
      expect(list.map((r) => r.creator_id).sort()).toEqual(
        ['creator-6', 'creator-7'].sort(),
      );
    });
  });
});

describe('CyranoBetaAnalyticsService', () => {
  describe('trackPrompt', () => {
    it('increments prompt_calls on each track', () => {
      const { svc } = buildAnalytics();
      svc.trackPrompt({ creator_id: 'c1', blocked: false, voice_used: false, translated: false });
      svc.trackPrompt({ creator_id: 'c1', blocked: false, voice_used: false, translated: false });
      expect(svc.getStats('c1')?.prompt_calls).toBe(2);
    });

    it('increments blocked_prompts when blocked = true', () => {
      const { svc } = buildAnalytics();
      svc.trackPrompt({ creator_id: 'c2', blocked: true, voice_used: false, translated: false });
      expect(svc.getStats('c2')?.blocked_prompts).toBe(1);
    });

    it('increments voice_calls when voice_used = true', () => {
      const { svc } = buildAnalytics();
      svc.trackPrompt({ creator_id: 'c3', blocked: false, voice_used: true, translated: false });
      expect(svc.getStats('c3')?.voice_calls).toBe(1);
    });

    it('increments locale_distribution when translated = true + target_locale', () => {
      const { svc } = buildAnalytics();
      svc.trackPrompt({
        creator_id: 'c4',
        blocked: false,
        voice_used: false,
        translated: true,
        target_locale: 'fr-FR',
      });
      svc.trackPrompt({
        creator_id: 'c4',
        blocked: false,
        voice_used: false,
        translated: true,
        target_locale: 'fr-FR',
      });
      const stats = svc.getStats('c4');
      expect(stats?.translation_calls).toBe(2);
      expect(stats?.locale_distribution['fr-FR']).toBe(2);
    });

    it('emits CYRANO_BETA_PROMPT_TRACKED on NATS', () => {
      const { svc, publishSpy } = buildAnalytics();
      svc.trackPrompt({ creator_id: 'c5', blocked: false, voice_used: false, translated: false });
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.beta.prompt.tracked');
    });
  });

  describe('trackTranslation', () => {
    it('increments translation_calls and locale_distribution', () => {
      const { svc } = buildAnalytics();
      svc.trackTranslation({ creator_id: 'c6', target_locale: 'de-DE', skipped: false });
      const stats = svc.getStats('c6');
      expect(stats?.translation_calls).toBe(1);
      expect(stats?.locale_distribution['de-DE']).toBe(1);
    });

    it('does not increment counts when skipped = true', () => {
      const { svc } = buildAnalytics();
      svc.trackTranslation({ creator_id: 'c7', target_locale: 'xx-YY', skipped: true });
      const stats = svc.getStats('c7');
      expect(stats?.translation_calls).toBe(0);
    });

    it('emits CYRANO_BETA_TRANSLATION_TRACKED on NATS', () => {
      const { svc, publishSpy } = buildAnalytics();
      svc.trackTranslation({ creator_id: 'c8', target_locale: 'fr-FR', skipped: false });
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.beta.translation.tracked');
    });
  });

  describe('emitSummary', () => {
    it('aggregates totals across multiple creators', () => {
      const { svc } = buildAnalytics();
      svc.trackPrompt({ creator_id: 'cr1', blocked: false, voice_used: false, translated: false });
      svc.trackPrompt({ creator_id: 'cr1', blocked: true, voice_used: false, translated: false });
      svc.trackPrompt({ creator_id: 'cr2', blocked: false, voice_used: true, translated: true, target_locale: 'fr-FR' });

      const summary = svc.emitSummary('test-corr');
      expect(summary.total_creators).toBe(2);
      expect(summary.total_prompt_calls).toBe(3);
      expect(summary.total_blocked_prompts).toBe(1);
      expect(summary.total_voice_calls).toBe(1);
      expect(summary.total_translation_calls).toBe(1);
      expect(summary.block_rate_pct).toBeCloseTo(33.33, 1);
      expect(summary.top_locales[0]).toEqual({ locale: 'fr-FR', count: 1 });
    });

    it('emits CYRANO_BETA_SUMMARY_EMITTED on NATS', () => {
      const { svc, publishSpy } = buildAnalytics();
      svc.emitSummary('sum-corr');
      const topics = publishSpy.mock.calls.map(([topic]) => topic);
      expect(topics).toContain('cyrano.beta.summary.emitted');
    });

    it('returns block_rate_pct = 0 when no prompts tracked', () => {
      const { svc } = buildAnalytics();
      const summary = svc.emitSummary();
      expect(summary.block_rate_pct).toBe(0);
      expect(summary.total_creators).toBe(0);
    });
  });

  describe('integration — translation in prompt tracking', () => {
    it('emits CYRANO_BETA_PROMPT_TRACKED with translation flag', () => {
      const { svc, publishSpy } = buildAnalytics();
      svc.trackPrompt({
        creator_id: 'int-1',
        blocked: false,
        voice_used: false,
        translated: true,
        target_locale: 'es-ES',
        correlation_id: 'int-corr-1',
      });
      const promptCall = publishSpy.mock.calls.find(([topic]) =>
        topic === 'cyrano.beta.prompt.tracked',
      );
      expect(promptCall).toBeTruthy();
      expect(promptCall?.[1]).toMatchObject({
        creator_id: 'int-1',
        translated: true,
        target_locale: 'es-ES',
      });
    });
  });
});
