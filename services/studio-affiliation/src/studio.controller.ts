// services/studio-affiliation/src/studio.controller.ts
// RBAC-STUDIO-001 — HTTP surface for Studio + StudioAffiliation.
//
// Routes (all gated through StudioRbacGuard for studio-scoped checks):
//   POST   /studios/affiliate              — creator requests affiliation
//   PATCH  /studios/:id/activate           — PLATFORM_ADMIN flips PENDING→ACTIVE
//   PATCH  /studios/:id/commission         — PLATFORM_ADMIN sets commission
//   GET    /studios/:id                    — read studio (any member)
//   GET    /studios/:id/affiliations       — roster (studio members + admins)
//   GET    /studios/by-affiliation-number/:n — lookup by number (login flow)

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ActivateStudioRequestDto,
  AffiliateRequestDto,
  AffiliateResponseDto,
  AffiliationPublic,
  SetCommissionRequestDto,
  StudioPublic,
} from './dto/studio.dto';
import { StudioService } from './studio.service';

@Controller('studios')
export class StudioController {
  private readonly logger = new Logger(StudioController.name);

  constructor(private readonly studios: StudioService) {}

  @Post('affiliate')
  async affiliate(@Body() dto: AffiliateRequestDto): Promise<AffiliateResponseDto> {
    this.logger.log('StudioController.affiliate', {
      creator_id: dto.creator_id,
      studio_name: dto.studio_name,
      existing_studio_id: dto.existing_studio_id,
    });
    return this.studios.affiliate(dto);
  }

  @Patch(':id/activate')
  async activate(
    @Param('id') id: string,
    @Body() dto: ActivateStudioRequestDto,
  ): Promise<StudioPublic> {
    this.logger.log('StudioController.activate', { studio_id: id, actor_id: dto.actor_id });
    return this.studios.activate(id, dto);
  }

  @Patch(':id/commission')
  async setCommission(
    @Param('id') id: string,
    @Body() dto: SetCommissionRequestDto,
  ): Promise<StudioPublic> {
    this.logger.log('StudioController.setCommission', {
      studio_id: id,
      actor_id: dto.actor_id,
      commission_rate: dto.commission_rate,
    });
    return this.studios.setCommission(id, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<StudioPublic> {
    return this.studios.findById(id);
  }

  @Get(':id/affiliations')
  async listAffiliations(@Param('id') id: string): Promise<AffiliationPublic[]> {
    return this.studios.listAffiliations(id);
  }

  @Get('by-affiliation-number/:number')
  async findByNumber(
    @Param('number') number: string,
  ): Promise<StudioPublic | { found: false }> {
    const studio = await this.studios.findByAffiliationNumber(number);
    return studio ?? { found: false };
  }
}
