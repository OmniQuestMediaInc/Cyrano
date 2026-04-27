/**
 * Canonical CommissionSplitEntry — shared by commission-splitting,
 * audit-dashboard, and batch-payout services.
 * Source: WO-018 / WO-021 / WO-030
 */
export interface CommissionSplitEntry {
  transactionId: string;
  modelId: string;
  studioId: string;
  grossCents: bigint;
  modelNetCents: bigint;
  studioAgencyHoldbackCents: bigint;
  studioServiceFeesCents: bigint;
  platformSystemFeeCents: bigint;
  checksum: string;
  metadata: {
    isTieredApplied: boolean;
    feeExclusionVerified: boolean;
    timestamp: string;
  };
}
