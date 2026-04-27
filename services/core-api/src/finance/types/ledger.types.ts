// WO: WO-032

/**
 * WO-032: Finance Enum Standardization.
 * Defines the canonical wallet_bucket values used in ledger entries.
 */
export enum WalletBucket {
  PROMOTIONAL_BONUS = 'promotional_bonus',
  MEMBERSHIP_ALLOCATION = 'membership_allocation',
  PURCHASED_TOKENS = 'purchased_tokens',
}

/**
 * TokenOrigin — origin classification for CZT issuance.
 * PURCHASED: guest bought tokens with real money. Eligible for refund.
 * GIFTED: tokens granted by platform, promotion, or transfer. Not eligible for refund.
 * Required for ASC 606 revenue recognition and breakage calculation.
 * Tech Debt Delta 2026-04-16 TOK-006.
 */
export enum TokenOrigin {
  PURCHASED = 'PURCHASED',
  GIFTED = 'GIFTED',
}
