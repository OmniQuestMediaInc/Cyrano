// services/core-api/src/scheduling/stat-holidays.seed.ts
// GZ-SCHEDULE: Rolling 3-year Ontario statutory holiday seed data.
// Maintains a 3-year rolling window from the current year.
// Can be called as a runtime seed script for testing or data refresh.

export interface StatHolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
}

/**
 * Ontario statutory holidays for a given year.
 * Computes moveable holidays (Family Day, Victoria Day, etc.) dynamically.
 */
function getOntarioStatHolidays(year: number): StatHolidayEntry[] {
  const holidays: StatHolidayEntry[] = [];

  // New Year's Day — January 1
  holidays.push({ date: `${year}-01-01`, name: "New Year's Day" });

  // Family Day — 3rd Monday of February
  holidays.push({ date: getNthWeekday(year, 2, 1, 3), name: 'Family Day' });

  // Good Friday — Friday before Easter Sunday
  holidays.push({ date: getGoodFriday(year), name: 'Good Friday' });

  // Victoria Day — Monday before May 25
  holidays.push({ date: getVictoriaDay(year), name: 'Victoria Day' });

  // Canada Day — July 1
  holidays.push({ date: `${year}-07-01`, name: 'Canada Day' });

  // Civic Holiday (Ontario) — 1st Monday of August
  holidays.push({ date: getNthWeekday(year, 8, 1, 1), name: 'Civic Holiday' });

  // Labour Day — 1st Monday of September
  holidays.push({ date: getNthWeekday(year, 9, 1, 1), name: 'Labour Day' });

  // National Day for Truth and Reconciliation — September 30
  holidays.push({ date: `${year}-09-30`, name: 'National Day for Truth and Reconciliation' });

  // Thanksgiving Day — 2nd Monday of October
  holidays.push({ date: getNthWeekday(year, 10, 1, 2), name: 'Thanksgiving Day' });

  // Christmas Day — December 25
  holidays.push({ date: `${year}-12-25`, name: 'Christmas Day' });

  // Boxing Day — December 26
  holidays.push({ date: `${year}-12-26`, name: 'Boxing Day' });

  return holidays;
}

/**
 * Returns the date of the Nth occurrence of a weekday in a given month.
 * @param year - Year
 * @param month - Month (1-12)
 * @param weekday - Day of week (0=Sun, 1=Mon, ..., 6=Sat)
 * @param n - Nth occurrence (1=first, 2=second, 3=third)
 */
function getNthWeekday(year: number, month: number, weekday: number, n: number): string {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) break; // Went past end of month
    if (date.getDay() === weekday) {
      count++;
      if (count === n) {
        return formatDate(year, month, day);
      }
    }
  }
  throw new Error(`Could not find ${n}th weekday ${weekday} in ${year}-${month}`);
}

/**
 * Computes Good Friday using the Anonymous Gregorian algorithm for Easter.
 */
function getGoodFriday(year: number): string {
  // Anonymous Gregorian Easter algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  // Easter Sunday is month/day, Good Friday is 2 days before
  const easter = new Date(year, month - 1, day);
  const goodFriday = new Date(easter.getTime() - 2 * 86_400_000);

  return formatDate(goodFriday.getFullYear(), goodFriday.getMonth() + 1, goodFriday.getDate());
}

/**
 * Computes Victoria Day — the Monday on or before May 24.
 */
function getVictoriaDay(year: number): string {
  const may24 = new Date(year, 4, 24); // May is month 4 (0-indexed)
  const dayOfWeek = may24.getDay();

  // Find the Monday on or before May 24
  let offset: number;
  if (dayOfWeek === 1) {
    offset = 0; // May 24 is already Monday
  } else if (dayOfWeek === 0) {
    offset = -6; // Sunday → previous Monday
  } else {
    offset = 1 - dayOfWeek; // Roll back to Monday
  }

  const victoriaDay = new Date(may24.getTime() + offset * 86_400_000);
  return formatDate(victoriaDay.getFullYear(), victoriaDay.getMonth() + 1, victoriaDay.getDate());
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns a rolling 3-year set of Ontario statutory holidays.
 * Always includes the current year and the next 2 years.
 */
export function getRollingThreeYearHolidays(baseYear?: number): StatHolidayEntry[] {
  const year = baseYear ?? new Date().getFullYear();
  const holidays: StatHolidayEntry[] = [];

  for (let y = year; y <= year + 2; y++) {
    holidays.push(...getOntarioStatHolidays(y));
  }

  return holidays;
}

/**
 * Returns holidays for specific years (for targeted seeding).
 */
export function getHolidaysForYears(years: number[]): StatHolidayEntry[] {
  const holidays: StatHolidayEntry[] = [];
  for (const year of years) {
    holidays.push(...getOntarioStatHolidays(year));
  }
  return holidays;
}
