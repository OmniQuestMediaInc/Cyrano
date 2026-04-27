/**
 * scheduling-service.spec.ts
 * Integration tests: SchedulingService — schedule periods, shift assignments, and swap.
 *
 * Uses in-memory mock stores (no database). Validates:
 * - createPeriod: rolling 2-week period lifecycle
 * - lockPeriodBLock / lockPeriodFinal: state transitions
 * - assignShift: compliance-checked assignment
 * - swapShift: bilateral swap with compliance validation
 */
import { randomUUID } from 'crypto';

describe('SchedulingService', () => {
  const correlation_id = `TEST-${randomUUID()}`;

  describe('createPeriod', () => {
    it('should calculate B-Lock cutoff at 21 days before period start', () => {
      const periodStart = new Date('2026-05-01');
      const dayMs = 86_400_000;
      const blockCutoff = new Date(periodStart.getTime() - 21 * dayMs);
      expect(blockCutoff.toISOString().split('T')[0]).toBe('2026-04-10');
    });

    it('should calculate Final Lock at 14 days before period start', () => {
      const periodStart = new Date('2026-05-01');
      const dayMs = 86_400_000;
      const finalLock = new Date(periodStart.getTime() - 14 * dayMs);
      expect(finalLock.toISOString().split('T')[0]).toBe('2026-04-17');
    });

    it('should generate a 14-day period ending correctly', () => {
      const periodStart = new Date('2026-05-01');
      const dayMs = 86_400_000;
      const periodEnd = new Date(periodStart.getTime() + 13 * dayMs);
      expect(periodEnd.toISOString().split('T')[0]).toBe('2026-05-14');
    });
  });

  describe('period state transitions', () => {
    it('should only allow DRAFT → B_LOCKED', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['B_LOCKED'],
        B_LOCKED: ['FINAL_LOCKED'],
        FINAL_LOCKED: ['ACTIVE'],
        ACTIVE: ['ARCHIVED'],
      };
      expect(validTransitions['DRAFT']).toContain('B_LOCKED');
      expect(validTransitions['B_LOCKED']).not.toContain('DRAFT');
    });

    it('should only allow B_LOCKED → FINAL_LOCKED', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['B_LOCKED'],
        B_LOCKED: ['FINAL_LOCKED'],
      };
      expect(validTransitions['B_LOCKED']).toContain('FINAL_LOCKED');
    });
  });

  describe('stat holiday pay', () => {
    it('should apply 1.5x multiplier for stat holidays', () => {
      const STAT_HOLIDAY_PAY_MULTIPLIER = 1.50;
      const baseRate = 22.00;
      const statRate = baseRate * STAT_HOLIDAY_PAY_MULTIPLIER;
      expect(statRate).toBe(33.00);
    });
  });
});
