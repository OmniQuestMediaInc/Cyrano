// WO: WO-INIT-001
import { Controller, Get, Param } from '@nestjs/common';
import { StatementsService } from './statements.service';

@Controller('creator')
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get('studio/:studioId/statement')
  getStudioStatement(@Param('studioId') studioId: string): Promise<unknown[]> {
    return this.statementsService.getStudioStatement(studioId);
  }

  @Get('performer/:performerId/earnings')
  getCreatorEarnings(@Param('performerId') performerId: string): Promise<unknown[]> {
    return this.statementsService.getCreatorEarnings(performerId);
  }
}
