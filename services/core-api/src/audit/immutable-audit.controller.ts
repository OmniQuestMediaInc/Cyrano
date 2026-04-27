// services/core-api/src/audit/immutable-audit.controller.ts
// PAYLOAD 6 — Read-only controller for chain verification + WORM export.
// Mutating audit rows directly is never exposed — emission goes through
// ImmutableAuditService.emit() from inside the originating service.
import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ImmutableAuditService,
  ChainIntegrityResult,
} from './immutable-audit.service';

@Controller('audit/chain')
export class ImmutableAuditController {
  constructor(private readonly service: ImmutableAuditService) {}

  @Get('verify')
  verify(@Query('limit') limit?: string): Promise<ChainIntegrityResult> {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.service.verifyChain({ limit: parsed });
  }

  @Post('worm-export')
  sealExport(
    @Query('from') fromIso: string,
    @Query('to') toIso: string,
    @Query('storageUri') storageUri?: string,
  ): Promise<{
    export_id: string;
    event_count: number;
    hash_seal: string;
    integrity_verified: boolean;
  }> {
    return this.service.sealWormExport({
      fromUtc: new Date(fromIso),
      toUtc: new Date(toIso),
      storageUri,
    });
  }
}
