// services/core-api/src/payments/payments.module.ts
// FIZ: PROC-001 — Payments module (webhook hardening only at this stage)
// Gate: CEO-AUTHORIZED-STAGED-2026-04-10
// Scope: webhook infrastructure only — no ledger writes, no balance columns,
// no transaction execution. Additional processor-integrated services (token
// hold, payout scheduling, chargeback recovery) are added by later PROC
// directives once GOV-FINTRAC + GOV-AGCO legal opinions are in hand.
import { Module } from '@nestjs/common';
import { WebhookHardeningService } from './webhook-hardening.service';

@Module({
  providers: [WebhookHardeningService],
  exports: [WebhookHardeningService],
})
export class PaymentsModule {}
