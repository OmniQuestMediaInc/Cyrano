/**
 * stat-holidays.spec.ts
 * Integration tests: Ontario statutory holiday computation.
 *
 * Validates:
 * - Fixed holidays (New Year, Canada Day, Christmas, Boxing Day)
 * - Moveable holidays (Family Day, Good Friday, Victoria Day, Thanksgiving)
 * - Rolling 3-year window correctness
 * - Known-good dates for 2026, 2027, 2028
 */
import {
  getRollingThreeYearHolidays,
  getHolidaysForYears,
} from '../../services/core-api/src/scheduling/stat-holidays.seed';

describe('Ontario Statutory Holiday Computation', () => {
  describe('fixed holidays', () => {
    it('should include New Year\'s Day on January 1', () => {
      const holidays = getHolidaysForYears([2026]);
      const newYear = holidays.find((h) => h.name === "New Year's Day");
      expect(newYear).toBeDefined();
      expect(newYear!.date).toBe('2026-01-01');
    });

    it('should include Canada Day on July 1', () => {
      const holidays = getHolidaysForYears([2026]);
      const canadaDay = holidays.find((h) => h.name === 'Canada Day');
      expect(canadaDay).toBeDefined();
      expect(canadaDay!.date).toBe('2026-07-01');
    });

    it('should include Christmas on December 25', () => {
      const holidays = getHolidaysForYears([2026]);
      const christmas = holidays.find((h) => h.name === 'Christmas Day');
      expect(christmas).toBeDefined();
      expect(christmas!.date).toBe('2026-12-25');
    });

    it('should include Boxing Day on December 26', () => {
      const holidays = getHolidaysForYears([2026]);
      const boxing = holidays.find((h) => h.name === 'Boxing Day');
      expect(boxing).toBeDefined();
      expect(boxing!.date).toBe('2026-12-26');
    });
  });

  describe('moveable holidays — 2026', () => {
    it('should compute Family Day 2026 as February 16 (3rd Monday)', () => {
      const holidays = getHolidaysForYears([2026]);
      const familyDay = holidays.find((h) => h.name === 'Family Day');
      expect(familyDay).toBeDefined();
      expect(familyDay!.date).toBe('2026-02-16');
    });

    it('should compute Good Friday 2026 as April 3', () => {
      const holidays = getHolidaysForYears([2026]);
      const goodFriday = holidays.find((h) => h.name === 'Good Friday');
      expect(goodFriday).toBeDefined();
      expect(goodFriday!.date).toBe('2026-04-03');
    });

    it('should compute Victoria Day 2026 as May 18 (Monday before May 25)', () => {
      const holidays = getHolidaysForYears([2026]);
      const victoriaDay = holidays.find((h) => h.name === 'Victoria Day');
      expect(victoriaDay).toBeDefined();
      expect(victoriaDay!.date).toBe('2026-05-18');
    });

    it('should compute Labour Day 2026 as September 7 (1st Monday)', () => {
      const holidays = getHolidaysForYears([2026]);
      const labourDay = holidays.find((h) => h.name === 'Labour Day');
      expect(labourDay).toBeDefined();
      expect(labourDay!.date).toBe('2026-09-07');
    });

    it('should compute Thanksgiving 2026 as October 12 (2nd Monday)', () => {
      const holidays = getHolidaysForYears([2026]);
      const thanksgiving = holidays.find((h) => h.name === 'Thanksgiving Day');
      expect(thanksgiving).toBeDefined();
      expect(thanksgiving!.date).toBe('2026-10-12');
    });
  });

  describe('moveable holidays — 2027', () => {
    it('should compute Family Day 2027 as February 15', () => {
      const holidays = getHolidaysForYears([2027]);
      const familyDay = holidays.find((h) => h.name === 'Family Day');
      expect(familyDay).toBeDefined();
      expect(familyDay!.date).toBe('2027-02-15');
    });

    it('should compute Good Friday 2027 as March 26', () => {
      const holidays = getHolidaysForYears([2027]);
      const goodFriday = holidays.find((h) => h.name === 'Good Friday');
      expect(goodFriday).toBeDefined();
      expect(goodFriday!.date).toBe('2027-03-26');
    });
  });

  describe('rolling 3-year window', () => {
    it('should return holidays for 3 consecutive years', () => {
      const holidays = getRollingThreeYearHolidays(2026);
      const years = new Set(holidays.map((h) => h.date.substring(0, 4)));
      expect(years.size).toBe(3);
      expect(years.has('2026')).toBe(true);
      expect(years.has('2027')).toBe(true);
      expect(years.has('2028')).toBe(true);
    });

    it('should return 11 holidays per year (33 total for 3 years)', () => {
      const holidays = getRollingThreeYearHolidays(2026);
      expect(holidays.length).toBe(33); // 11 holidays × 3 years
    });

    it('should use current year when no base year provided', () => {
      const holidays = getRollingThreeYearHolidays();
      const currentYear = new Date().getFullYear();
      const years = new Set(holidays.map((h) => h.date.substring(0, 4)));
      expect(years.has(String(currentYear))).toBe(true);
    });
  });
});
