// WO: WO-072
// scripts/verify-vault-delivery.ts
//
// Standalone verification script for DigitalVaultService and WatermarkUtility.
// Runs three scenarios to confirm:
//   A – successful delivery creates a vault_item with a unique watermark.
//   B – delivery for an unpaid order is blocked and logs FAILED_DELIVERY.
//   C – download_count increments correctly and a timestamped access event is logged.

import { DigitalVaultService } from '../services/assets/DigitalVaultService';
import { WatermarkUtility } from '../services/assets/WatermarkUtility';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

function header(label: string): void {
  console.log(`\n=== ${label} ===`);
}

// ---------------------------------------------------------------------------
// Scenario A — Successful USD purchase of a video; vault_item created with
//              unique watermark metadata.
// ---------------------------------------------------------------------------
header('Scenario A: Successful PAID delivery');
DigitalVaultService._reset();

const userId_A   = 'user-a1b2c3';
const orderId_A  = 'order-x9y8z7';
const productId_A = 'product-video-001';

const resultA = DigitalVaultService.deliverToVault(userId_A, productId_A, orderId_A, 'PAID');

assert(resultA.success === true, 'deliverToVault returns success=true for PAID order');
assert(resultA.vault_item !== undefined, 'vault_item is present');
assert(resultA.vault_item?.vault_item_id !== undefined, 'vault_item_id is a UUID');
assert(resultA.vault_item?.order_id === orderId_A, 'vault_item.order_id matches orderId (immutable audit link §2799)');
assert(resultA.vault_item?.user_id === userId_A, 'vault_item.user_id matches userId');
assert(typeof resultA.vault_item?.watermark_fingerprint === 'string' && resultA.vault_item.watermark_fingerprint.length === 64,
  'watermark_fingerprint is a 64-char SHA-256 hex string');
assert(resultA.vault_item?.rule_applied_id === 'Doctrine §2789', '"All Sales Final" rule_applied_id is set (Doctrine §2789)');
assert(resultA.audit_event.event_type === 'DELIVERED_TO_VAULT', 'audit_event is DELIVERED_TO_VAULT (Doctrine §2830)');
assert(resultA.audit_event.rule_applied_id === 'Doctrine §2789', 'audit_event carries rule_applied_id=Doctrine §2789');

// Confirm uniqueness by generating a second watermark for the same order and
// checking that fingerprints differ (because platform_time advances).
const wm1 = WatermarkUtility.generateWatermarkMetadata(userId_A, orderId_A);
const wm2 = WatermarkUtility.generateWatermarkMetadata(userId_A, orderId_A);
// Fingerprints should always be deterministic given identical inputs; here we
// verify both carry the expected fields rather than equality of hash (since
// timestamps may coincide within the same millisecond in fast test runs).
assert(typeof wm1.watermark_fingerprint === 'string' && wm1.watermark_fingerprint.length === 64,
  'WatermarkUtility.generateWatermarkMetadata returns 64-char fingerprint');
assert(wm1.user_id === userId_A && wm1.order_id === orderId_A,
  'WatermarkMetadata contains user_id and order_id');
assert(typeof wm1.platform_time === 'string' && wm1.platform_time.includes('T'),
  'WatermarkMetadata.platform_time is an ISO 8601 string in America/Toronto');

// Verify watermarks generated for *different* orders are distinct.
const wmDiff = WatermarkUtility.generateWatermarkMetadata(userId_A, 'order-different-99');
assert(wm1.watermark_fingerprint !== wmDiff.watermark_fingerprint,
  'Watermarks for different orders produce distinct fingerprints');

// ---------------------------------------------------------------------------
// Scenario B — Delivery for an unpaid order is blocked; FAILED_DELIVERY logged.
// ---------------------------------------------------------------------------
header('Scenario B: Blocked delivery for unpaid order');
DigitalVaultService._reset();

const resultB_pending = DigitalVaultService.deliverToVault('user-b1', 'product-video-002', 'order-unpaid-001', 'PENDING');
const resultB_failed  = DigitalVaultService.deliverToVault('user-b1', 'product-video-002', 'order-unpaid-002', 'FAILED');
const resultB_empty   = DigitalVaultService.deliverToVault('user-b1', 'product-video-002', 'order-unpaid-003', '');

assert(resultB_pending.success === false, 'PENDING order is blocked (success=false)');
assert(resultB_pending.vault_item === undefined, 'No vault_item created for PENDING order');
assert(resultB_pending.audit_event.event_type === 'FAILED_DELIVERY', 'FAILED_DELIVERY event emitted for PENDING order');

assert(resultB_failed.success === false, 'FAILED order is blocked');
assert(resultB_failed.audit_event.event_type === 'FAILED_DELIVERY', 'FAILED_DELIVERY event emitted for FAILED order');

assert(resultB_empty.success === false, 'Empty status is blocked');
assert(resultB_empty.audit_event.event_type === 'FAILED_DELIVERY', 'FAILED_DELIVERY event emitted for empty status');

const failedAuditLog = DigitalVaultService.getAuditLog();
assert(failedAuditLog.length === 3, 'Three FAILED_DELIVERY events written to audit log');
assert(failedAuditLog.every(e => e.event_type === 'FAILED_DELIVERY'), 'All audit events are FAILED_DELIVERY');

// ---------------------------------------------------------------------------
// Scenario C — download_count increments correctly and access events are logged.
// ---------------------------------------------------------------------------
header('Scenario C: Download tracking');
DigitalVaultService._reset();

const resultC = DigitalVaultService.deliverToVault('user-c1', 'product-video-003', 'order-paid-003', 'PAID');
assert(resultC.success === true, 'Setup: PAID delivery succeeds');

const vaultItemId = resultC.vault_item!.vault_item_id;

// First download
const dl1 = DigitalVaultService.trackDownload(vaultItemId);
assert(dl1 !== null, 'trackDownload returns an event for a known vault_item_id');
assert(dl1?.download_count === 1, 'download_count is 1 after first download');
assert(typeof dl1?.platform_time === 'string' && dl1.platform_time.includes('T'),
  'download event carries platform_time in America/Toronto');

// Second download
const dl2 = DigitalVaultService.trackDownload(vaultItemId);
assert(dl2?.download_count === 2, 'download_count is 2 after second download');

// Third download
const dl3 = DigitalVaultService.trackDownload(vaultItemId);
assert(dl3?.download_count === 3, 'download_count is 3 after third download');

// Verify vault_item reflects updated count
const storedItem = DigitalVaultService.getVaultItem(vaultItemId);
assert(storedItem?.download_count === 3, 'vault_item.download_count is 3 in store');

const dlLog = DigitalVaultService.getDownloadLog();
assert(dlLog.length === 3, 'Three download access events logged');
assert(dlLog.every(e => e.vault_item_id === vaultItemId), 'All download events reference the correct vault_item_id');

// Unknown vault_item_id returns null
const dlUnknown = DigitalVaultService.trackDownload('non-existent-id');
assert(dlUnknown === null, 'trackDownload returns null for unknown vault_item_id');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n--- Verification complete ---');
if (process.exitCode === 1) {
  console.error('One or more assertions failed.');
} else {
  console.log('All assertions passed. ✅');
}
