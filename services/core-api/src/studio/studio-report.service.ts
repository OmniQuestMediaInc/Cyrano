// WO: WO-INIT-001
import { Injectable } from '@nestjs/common';

@Injectable()
export class StudioReportService {
  async getStudioEarnings(): Promise<Record<string, unknown>> {
    return {};
  }
}
