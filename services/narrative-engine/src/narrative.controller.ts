// services/narrative-engine/src/narrative.controller.ts
// CYR: Narrative Engine REST controller

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NarrativeService } from './narrative.service';
import { BuildContextRequest, MemoryType } from './narrative.types';

@Controller('cyrano/narrative')
export class NarrativeController {
  constructor(private readonly narrativeService: NarrativeService) {}

  /** Store a new memory for a user+twin relationship. */
  @Post('memory')
  async storeMemory(
    @Body()
    body: {
      session_id: string;
      twin_id: string;
      user_id: string;
      memory_type: MemoryType;
      content: string;
      importance_score?: number;
      expires_in_days?: number;
      correlation_id: string;
    },
  ) {
    return this.narrativeService.storeMemory(body);
  }

  /** Recall top memories for a user+twin pair. */
  @Get('memory/:twinId/:userId')
  async recallMemories(
    @Param('twinId') twinId: string,
    @Param('userId') userId: string,
  ) {
    return this.narrativeService.recallMemories(twinId, userId);
  }

  /** Build assembled narrative context for LLM injection. */
  @Post('context')
  async buildContext(@Body() req: BuildContextRequest) {
    return this.narrativeService.buildContext(req);
  }

  /** Create a cinematic branch choice point. */
  @Post('branch')
  async createBranch(
    @Body()
    body: {
      twin_id: string;
      user_id: string;
      branch_title: string;
      branch_premise: string;
      decision_prompt: string;
      options: Array<{ option_key: string; label: string; consequence_hint: string }>;
      correlation_id: string;
    },
  ) {
    return this.narrativeService.createBranch(body);
  }

  /** Resolve a branch — user has made their narrative choice. */
  @Post('branch/:branchId/resolve')
  async resolveBranch(
    @Param('branchId') branchId: string,
    @Body() body: { chosen_option_key: string; correlation_id: string },
  ) {
    return this.narrativeService.resolveBranch(
      branchId,
      body.chosen_option_key,
      body.correlation_id,
    );
  }
}
