// CYR: PROMO-001 — PromotionModule
import { Module } from '@nestjs/common';
import { PromotionService } from './promotion.service';

@Module({
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
