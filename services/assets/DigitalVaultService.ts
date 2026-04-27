// WO: WO-072
import { randomUUID } from 'crypto';
import { WatermarkUtility, toTorontoISO } from './WatermarkUtility';

/**
 * WO-072: DigitalVaultService
 * Manages secure delivery and download tracking of purchased digital goods.
 *
 * Doctrine references:
 *   §2789 — "All Sales Final": every successful delivery explicitly records
 *            rule_applied_id = ALL_SALES_FINAL_RULE.
 *   §2799  — vault_item links back to the originating order_id for immutable
 *            audit replayability.
 *   §2800  — vault_item_id is a UUID; delivered_at and all audit timestamps
 *            are in America/Toronto.
 *   §2829–2830 — delivery is gated on OrderDigital status === 'PAID';
 *               every outcome emits a structured audit event.
 */

export const ALL_SALES_FINAL_RULE = 'Doctrine §2789';
export const PAID_STATUS = 'PAID';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultItem {
  vault_item_id: string;
  user_id: string;
  product_id: string;
  /** Immutable link to the originating order (Doctrine §2799). */
  order_id: string;
  /** Delivery timestamp in America/Toronto (Doctrine §2800). */
  delivered_at: string;
  /** SHA-256 fingerprint from WatermarkUtility (Doctrine §2800). */
  watermark_fingerprint: string;
  download_count: number;
  /** "All Sales Final" rule reference (Doctrine §2789). */
  rule_applied_id: string;
}

export type DeliveryEventType = 'DELIVERED_TO_VAULT' | 'FAILED_DELIVERY';

export interface DeliveryAuditEvent {
  event_type: DeliveryEventType;
  vault_item_id: string | null;
  order_id: string;
  user_id: string;
  /** Platform timestamp in America/Toronto (Doctrine §2800). */
  platform_time: string;
  rule_applied_id: string;
  reason?: string;
}

export interface DownloadEvent {
  vault_item_id: string;
  /** Access timestamp in America/Toronto (Doctrine §2800). */
  platform_time: string;
  download_count: number;
}

export interface DeliveryResult {
  success: boolean;
  vault_item?: VaultItem;
  audit_event: DeliveryAuditEvent;
}

// ---------------------------------------------------------------------------
// In-process stores (replaced by DB persistence layer when available)
// ---------------------------------------------------------------------------

const vaultStore = new Map<string, VaultItem>();
const auditLog: DeliveryAuditEvent[] = [];
const downloadLog: DownloadEvent[] = [];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emit(record: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(record) + '\n');
}

// ---------------------------------------------------------------------------
// DigitalVaultService
// ---------------------------------------------------------------------------

export class DigitalVaultService {
  /**
   * Delivers a purchased digital asset to the user's vault.
   *
   * Prerequisite (Doctrine §2829–2830): orderStatus MUST be exactly 'PAID'.
   * Any other status causes the delivery to be blocked and a FAILED_DELIVERY
   * audit event to be emitted.
   */
  public static deliverToVault(
    userId: string,
    productId: string,
    orderId: string,
    orderStatus: string,
  ): DeliveryResult {
    const platform_time = toTorontoISO(new Date());

    // Gate: block delivery unless the order is confirmed PAID (Doctrine §2829).
    if (orderStatus !== PAID_STATUS) {
      const audit: DeliveryAuditEvent = {
        event_type: 'FAILED_DELIVERY',
        vault_item_id: null,
        order_id: orderId,
        user_id: userId,
        platform_time,
        rule_applied_id: ALL_SALES_FINAL_RULE,
        reason: `ORDER_NOT_PAID: status=${orderStatus}`,
      };
      auditLog.push(audit);
      emit({ level: 'warn', ...audit });
      return { success: false, audit_event: audit };
    }

    // Generate unique watermark (Doctrine §2800).
    const watermark = WatermarkUtility.generateWatermarkMetadata(userId, orderId);

    // Create vault_item with UUID and Toronto timestamp (Doctrine §2800).
    const vault_item_id = randomUUID();
    const vaultItem: VaultItem = {
      vault_item_id,
      user_id: userId,
      product_id: productId,
      order_id: orderId,
      delivered_at: watermark.platform_time,
      watermark_fingerprint: watermark.watermark_fingerprint,
      download_count: 0,
      rule_applied_id: ALL_SALES_FINAL_RULE,
    };
    vaultStore.set(vault_item_id, vaultItem);

    // Emit DELIVERED_TO_VAULT audit event (Doctrine §2830).
    const audit: DeliveryAuditEvent = {
      event_type: 'DELIVERED_TO_VAULT',
      vault_item_id,
      order_id: orderId,
      user_id: userId,
      platform_time,
      rule_applied_id: ALL_SALES_FINAL_RULE,
    };
    auditLog.push(audit);
    emit({ level: 'info', ...audit });

    return { success: true, vault_item: vaultItem, audit_event: audit };
  }

  /**
   * Increments download_count and logs a timestamped access event (Doctrine §2800).
   * Returns null if the vault_item_id is not found.
   */
  public static trackDownload(vaultItemId: string): DownloadEvent | null {
    const item = vaultStore.get(vaultItemId);
    if (!item) {
      emit({ level: 'warn', message: 'VAULT_ITEM_NOT_FOUND', vault_item_id: vaultItemId });
      return null;
    }

    item.download_count += 1;
    const event: DownloadEvent = {
      vault_item_id: vaultItemId,
      platform_time: toTorontoISO(new Date()),
      download_count: item.download_count,
    };
    downloadLog.push(event);
    emit({ level: 'info', event_type: 'DOWNLOAD_TRACKED', ...event });
    return event;
  }

  /** Retrieve a vault item by ID. */
  public static getVaultItem(vaultItemId: string): VaultItem | undefined {
    return vaultStore.get(vaultItemId);
  }

  /** Returns the immutable audit log for inspection or replay. */
  public static getAuditLog(): ReadonlyArray<DeliveryAuditEvent> {
    return auditLog;
  }

  /** Returns the download access log. */
  public static getDownloadLog(): ReadonlyArray<DownloadEvent> {
    return downloadLog;
  }

  /** Resets in-process stores (for test isolation only). */
  public static _reset(): void {
    vaultStore.clear();
    auditLog.length = 0;
    downloadLog.length = 0;
  }
}
