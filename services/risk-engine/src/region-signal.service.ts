import { Injectable } from '@nestjs/common';

@Injectable()
export class RegionSignalService {
  /**
   * Generates a Trusted Region Signal by comparing 
   * Payment BIN, Billing Country, and IP Geolocation.
   */
  async getConfidenceScore(data: {
    ipCountry: string;
    billingCountry: string;
    binCountry: string;
    isVpnDetected: boolean;
  }): Promise<{ confidence: number; region: string; vpnRisk: boolean; flags: string[] }> {
    let score = 1.0;
    const flags: string[] = [];

    // 1. VPN/Proxy Penalty
    if (data.isVpnDetected) {
      score -= 0.5;
      flags.push('VPN_DETECTED');
    }

    // 2. BIN vs Billing Mismatch (High Risk for Fraud)
    if (data.binCountry !== data.billingCountry) {
      score -= 0.3;
      flags.push('BIN_BILLING_MISMATCH');
    }

    // 3. IP vs Billing Mismatch (Moderate Risk / Travel)
    if (data.ipCountry !== data.billingCountry) {
      score -= 0.1;
      flags.push('IP_LOCATION_MISMATCH');
    }

    return {
      confidence: Math.max(0, score),
      region: data.binCountry, // BIN is the 'Anchor of Trust'
      vpnRisk: data.isVpnDetected,
      flags: flags
    };
  }
}