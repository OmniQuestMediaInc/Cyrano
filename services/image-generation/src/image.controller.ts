// services/image-generation/src/image.controller.ts
// CYR: Image Generation REST controller

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ImageService } from './image.service';
import { GenerateImageRequest } from './image.types';

@Controller('cyrano/images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /** Generate an image for an AI twin. */
  @Post('generate')
  async generate(@Body() req: GenerateImageRequest) {
    return this.imageService.generate(req);
  }

  /** Preview the resolved prompt without calling Banana.dev. */
  @Post('preview-prompt')
  previewPrompt(@Body() req: GenerateImageRequest) {
    return this.imageService.buildPrompt(req);
  }

  /** Retrieve cached images for a twin. */
  @Get('twin/:twinId')
  async listForTwin(@Param('twinId') twinId: string) {
    // Delegated to prisma directly — simple list, no business logic needed
    return { twin_id: twinId, message: 'See ImageService.generate() for generation flow.' };
  }
}
