import { Injectable } from '@nestjs/common';

@Injectable()
export class GratitudeService {
  private loyaltyTiers = {
    silver: 1000,
    gold: 5000,
    platinum: 10000,
  };

  private delayIntervals = {
    silver: 1000, // 1 second
    gold: 2000, // 2 seconds
    platinum: 3000, // 3 seconds
  };

  getCustomizableDelay(tier: string): number {
    return this.delayIntervals[tier] || 1000; // Default to 1 second if tier is not found
  }

  // Existing methods and logic...
  sendGratitudeMessage(tier: string): void {
    const delay = this.getCustomizableDelay(tier);
    setTimeout(() => {
      // Implement your messaging logic here...
    }, delay);
  }
}
