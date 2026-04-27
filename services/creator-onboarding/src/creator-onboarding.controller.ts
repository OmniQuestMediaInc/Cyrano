// services/creator-onboarding/src/creator-onboarding.controller.ts
// RBAC-STUDIO-001 — onboarding HTTP surface.

import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { CreatorOnboardingService } from './creator-onboarding.service';
import {
  OnboardingPublic,
  StartOnboardingDto,
  StartOnboardingResponse,
  VerifyEmailDto,
  VerifyEmailResponse,
} from './dto/onboarding.dto';

@Controller('creator-onboarding')
export class CreatorOnboardingController {
  private readonly logger = new Logger(CreatorOnboardingController.name);

  constructor(private readonly onboarding: CreatorOnboardingService) {}

  @Post('start')
  async start(@Body() dto: StartOnboardingDto): Promise<StartOnboardingResponse> {
    this.logger.log('CreatorOnboardingController.start', {
      creator_id: dto.creator_id,
      affiliation_number: dto.affiliation_number,
      new_studio_name: dto.new_studio_name,
    });
    return this.onboarding.start(dto);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    this.logger.log('CreatorOnboardingController.verifyEmail', {
      creator_id: dto.creator_id,
    });
    return this.onboarding.verifyEmail(dto);
  }

  @Post(':creator_id/complete')
  async complete(@Param('creator_id') creatorId: string): Promise<OnboardingPublic> {
    this.logger.log('CreatorOnboardingController.complete', { creator_id: creatorId });
    return this.onboarding.complete(creatorId);
  }

  @Get(':creator_id')
  async findByCreator(
    @Param('creator_id') creatorId: string,
  ): Promise<OnboardingPublic | { found: false }> {
    const row = await this.onboarding.findByCreator(creatorId);
    return row ?? { found: false };
  }
}
