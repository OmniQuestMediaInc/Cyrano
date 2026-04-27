// WO: WO-020
import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

/**
 * WO-020: Frontend Ingestion Module
 * Binds Studio/Model UI events to backend service handlers.
 */
@Module({
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
