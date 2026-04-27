// services/fraud-prevention/src/events/ServiceToSaleEmitter.ts
import { Injectable, Logger } from '@nestjs/common';

export interface ServiceToSaleEvent {
  type: 'SERVICE_TO_SALE';
  guestId: string;
  agentId: string;
  action: string;
  interactionRef: string;
  reason: string;
  expiryExtensionDays?: number;
  goodwillCreditCZT?: number;
}

@Injectable()
export class ServiceToSaleEmitter {
  private readonly logger = new Logger(ServiceToSaleEmitter.name);

  async emit(event: ServiceToSaleEvent): Promise<void> {
    this.logger.log('SERVICE_TO_SALE event emitted', {
      type: event.type,
      guestId: event.guestId,
      interactionRef: event.interactionRef,
    });
    // Future: publish to NATS fabric
  }
}
