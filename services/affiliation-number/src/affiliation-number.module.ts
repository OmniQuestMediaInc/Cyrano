// services/affiliation-number/src/affiliation-number.module.ts
// RBAC-STUDIO-001 — Generator module exported for studio-affiliation use.
import { Module } from '@nestjs/common';
import { AffiliationNumberService } from './affiliation-number.service';

@Module({
  providers: [AffiliationNumberService],
  exports: [AffiliationNumberService],
})
export class AffiliationNumberModule {}
