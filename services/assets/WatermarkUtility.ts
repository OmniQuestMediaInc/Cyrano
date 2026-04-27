// WO: WO-072
import { createHash } from 'crypto';

/**
 * WO-072: WatermarkUtility
 * Anti-piracy traceability — generates a unique watermark fingerprint for every
 * purchased digital asset.  Fingerprint encodes User ID, Order ID, and the
 * platform timestamp (America/Toronto) so that every delivered copy is uniquely
 * identifiable (Doctrine §2800).
 */

const PLATFORM_TIMEZONE = 'America/Toronto';

/** Formats a Date as an ISO 8601 string in America/Toronto. */
export function toTorontoISO(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const p: Record<string, string> = {};
  for (const { type, value } of parts) {
    p[type] = value;
  }
  // Derive UTC offset by comparing the local date-parts (treated as UTC) against
  // the real epoch, matching the pattern used in AuditService (WO-032).
  const localAsUtcMs = Date.UTC(
    +p.year, +p.month - 1, +p.day,
    +p.hour, +p.minute, +p.second,
  );
  const offsetMin = Math.round((date.getTime() - localAsUtcMs) / 60_000);
  const sign = offsetMin >= 0 ? '-' : '+';
  const absMin = Math.abs(offsetMin);
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const om = String(absMin % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${oh}:${om}`;
}

export interface WatermarkMetadata {
  /** SHA-256 fingerprint uniquely encoding userId + orderId + platform_time. */
  watermark_fingerprint: string;
  user_id: string;
  order_id: string;
  /** ISO 8601 timestamp in America/Toronto. */
  platform_time: string;
}

export class WatermarkUtility {
  /**
   * Generates watermark metadata for a purchased digital asset.
   * The resulting fingerprint is injected into the asset delivery stream so that
   * every copy is traceable back to the exact purchase event (Doctrine §2800).
   */
  public static generateWatermarkMetadata(
    userId: string,
    orderId: string,
  ): WatermarkMetadata {
    const now = new Date();
    const platform_time = toTorontoISO(now);
    const raw = `${userId}:${orderId}:${platform_time}`;
    const watermark_fingerprint = createHash('sha256').update(raw).digest('hex');
    return {
      watermark_fingerprint,
      user_id: userId,
      order_id: orderId,
      platform_time,
    };
  }
}
