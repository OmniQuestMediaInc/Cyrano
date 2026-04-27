// services/fraud-prevention/src/AbuseDetector.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AbuseDetector {
  private readonly logger = new Logger(AbuseDetector.name);

  async detectAbuse(guestId: string): Promise<{ isAbusive: boolean; signals: string[] }> {
    // Placeholder: future implementation integrates velocity + ML signals
    this.logger.debug('AbuseDetector.detectAbuse called', { guestId });
    return { isAbusive: false, signals: [] };
  }
}
