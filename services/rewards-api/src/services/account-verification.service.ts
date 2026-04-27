// FIZ: F-024 — RedRoom Rewards Account Verification (18+) stub
// Minimal account-verification surface used by RedRoomLedgerService.
// The production wiring substitutes a provider-backed adapter (Veriff,
// Persona, etc.); the contract here is the only thing the ledger depends on.

import { Injectable } from '@nestjs/common';

export interface AccountVerificationResult {
  verified: boolean;
  /** Provider trace id, when one is available. */
  reference?: string;
}

export interface AccountVerificationService {
  verifyAccount(guestId: string): Promise<AccountVerificationResult>;
}

/**
 * Default in-process verifier. Returns verified=true unless the guestId
 * appears in a blocklist (used by tests). Production wiring substitutes a
 * provider-backed implementation that consults the AV ledger / external
 * verifier.
 */
@Injectable()
export class InProcessAccountVerificationService implements AccountVerificationService {
  private readonly blocked = new Set<string>();

  block(guestId: string): void {
    this.blocked.add(guestId);
  }

  unblock(guestId: string): void {
    this.blocked.delete(guestId);
  }

  async verifyAccount(guestId: string): Promise<AccountVerificationResult> {
    if (this.blocked.has(guestId)) {
      return { verified: false, reference: 'blocked' };
    }
    return { verified: true, reference: 'inproc-stub' };
  }
}
