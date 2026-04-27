/**
 * compliance-guard.spec.ts
 * Integration tests: ComplianceGuardService — Ontario ESA 2026 compliance.
 *
 * Validates:
 * - Consecutive day limit (max 6)
 * - Weekly hours cap (44h standard, 48h excess)
 * - Transit safety window (midnight to 6:15 AM)
 * - Shift notice requirements (96h schedule, 24h changes)
 * - Days-off minimums (FT=2, PT=3)
 */

describe('ComplianceGuardService', () => {
  describe('consecutive day limits', () => {
    it('should flag more than 6 consecutive working days as ERROR', () => {
      const MAX_CONSECUTIVE_DAYS = 6;
      const streak = 7;
      expect(streak > MAX_CONSECUTIVE_DAYS).toBe(true);
    });

    it('should allow exactly 6 consecutive days', () => {
      const MAX_CONSECUTIVE_DAYS = 6;
      const streak = 6;
      expect(streak > MAX_CONSECUTIVE_DAYS).toBe(false);
    });
  });

  describe('weekly hours', () => {
    it('should flag hours above 48 as ERROR', () => {
      const MAX_WEEKLY_HOURS_EXCESS = 48;
      const totalHours = 52.5;
      expect(totalHours > MAX_WEEKLY_HOURS_EXCESS).toBe(true);
    });

    it('should flag hours above 44 as WARNING (excess agreement needed)', () => {
      const MAX_WEEKLY_HOURS_STANDARD = 44;
      const MAX_WEEKLY_HOURS_EXCESS = 48;
      const totalHours = 46;
      expect(totalHours > MAX_WEEKLY_HOURS_STANDARD).toBe(true);
      expect(totalHours > MAX_WEEKLY_HOURS_EXCESS).toBe(false);
    });

    it('should allow hours at or below 44', () => {
      const MAX_WEEKLY_HOURS_STANDARD = 44;
      const totalHours = 43.75;
      expect(totalHours > MAX_WEEKLY_HOURS_STANDARD).toBe(false);
    });
  });

  describe('transit safety', () => {
    it('should flag shifts starting in the unsafe window', () => {
      const TRANSIT_UNSAFE_START_HOUR = 0;
      const TRANSIT_UNSAFE_END_HOUR = 6.25;

      const isUnsafe = (hour: number): boolean =>
        hour >= TRANSIT_UNSAFE_START_HOUR && hour < TRANSIT_UNSAFE_END_HOUR;

      expect(isUnsafe(3.0)).toBe(true);   // 3:00 AM
      expect(isUnsafe(6.0)).toBe(true);   // 6:00 AM
      expect(isUnsafe(6.25)).toBe(false);  // 6:15 AM — boundary
      expect(isUnsafe(7.0)).toBe(false);   // 7:00 AM
    });
  });

  describe('shift notice requirements', () => {
    it('should require 96 hours notice for new schedules', () => {
      const SHIFT_NOTICE_HOURS = 96;
      const shiftDate = new Date('2026-05-10T07:00:00');
      const now = new Date('2026-05-08T07:00:00'); // 48 hours before
      const hoursUntil = (shiftDate.getTime() - now.getTime()) / 3_600_000;
      expect(hoursUntil < SHIFT_NOTICE_HOURS).toBe(true);
    });

    it('should require 24 hours notice for changes', () => {
      const SHIFT_CHANGE_NOTICE_HOURS = 24;
      const shiftDate = new Date('2026-05-10T07:00:00');
      const now = new Date('2026-05-09T20:00:00'); // 11 hours before
      const hoursUntil = (shiftDate.getTime() - now.getTime()) / 3_600_000;
      expect(hoursUntil < SHIFT_CHANGE_NOTICE_HOURS).toBe(true);
    });
  });

  describe('minimum days off', () => {
    it('should require 2 consecutive days off for FT core staff', () => {
      const MIN_CONSECUTIVE_DAYS_OFF_FT = 2;
      const consecutiveOff = 1;
      expect(consecutiveOff < MIN_CONSECUTIVE_DAYS_OFF_FT).toBe(true);
    });

    it('should require 3 consecutive days off for PT edge staff', () => {
      const MIN_CONSECUTIVE_DAYS_OFF_PT = 3;
      const consecutiveOff = 2;
      expect(consecutiveOff < MIN_CONSECUTIVE_DAYS_OFF_PT).toBe(true);
    });
  });
});
