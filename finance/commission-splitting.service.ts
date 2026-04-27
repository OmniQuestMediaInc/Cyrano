import { createHash } from 'crypto';
import { CommissionSplitEntry } from './schema';

/**
 * @class CommissionSplittingEngine
 * Deterministic engine for bifurcating Gross Model Earnings.
 * Enforces Mutually Exclusive Fee Logic (Hourly vs Session).
 */
export class CommissionSplittingEngine {
  public static calculateDeterministicSplit(
    grossTokens: number,
    tokenRate: number,
    agencyFeePct: number,
    activeFees: Array<{ type: string; value: number; units?: number }>,
    enableTiered: boolean = false
  ): CommissionSplitEntry { 
    
    // GUARDRAIL: Mutually Exclusive Fee Check (Hourly vs Session)
    const hasHourly = activeFees.some(f => f.type === 'STUDIO_SERVICE_HOURLY');
    const hasSession = activeFees.some(f => f.type === 'STUDIO_SERVICE_SESSION');
    
    if (hasHourly && hasSession) {
      throw new Error("GOVERNANCE_VIOLATION: Hourly and Session fees are mutually exclusive.");
    }

    // Step 1: BigInt Cent Conversion (USD * 100)
    const grossCents = BigInt(Math.round(grossTokens * tokenRate * 100));
    const agencyHoldback = BigInt(Math.round(Number(grossCents) * agencyFeePct));
    const modelNet = grossCents - agencyHoldback;

    // Step 2: Studio Fee Aggregation
    let serviceFeesTotal = 0n;
    activeFees.forEach(fee => {
      if (fee.type === 'STUDIO_MEMBERSHIP_FIXED') {
        serviceFeesTotal += BigInt(Math.round(fee.value * 100));
      } else if (fee.type === 'STUDIO_SERVICE_HOURLY') {
        serviceFeesTotal += BigInt(Math.round(fee.value * (fee.units || 0) * 100));
      } else if (fee.type === 'STUDIO_SERVICE_SESSION' && !hasHourly) {
        serviceFeesTotal += BigInt(Math.round(fee.value * 100));
      }
    });

    // Step 3: Platform Fee Resolution (OQMI Revenue)
    const platformFee = this.resolvePlatformFee(grossCents, enableTiered);

    // Step 4: Forensic Hash (WO-015 Compliance)
    const payload = `${grossCents}:${modelNet}:${agencyHoldback}:${serviceFeesTotal}:${platformFee}`;
    const checksum = createHash('sha512').update(payload).digest('hex');

    return {
      transactionId: `OQMI-WO18-${Date.now()}`,
      modelId: "UNRESOLVED",
      studioId: "UNRESOLVED",
      grossCents,
      modelNetCents: modelNet,
      studioAgencyHoldbackCents: agencyHoldback,
      studioServiceFeesCents: serviceFeesTotal,
      platformSystemFeeCents: platformFee,
      checksum,
      metadata: {
        isTieredApplied: enableTiered,
        feeExclusionVerified: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  private static resolvePlatformFee(gross: bigint, isTiered: boolean): bigint {
    const grossNum = Number(gross);
    if (!isTiered) return BigInt(Math.round(grossNum * 0.05));
    if (grossNum > 1000000) return BigInt(Math.round(grossNum * 0.03));
    return BigInt(Math.round(grossNum * 0.04));
  }
}