// services/bijou/src/min-seat-gate.service.ts
// Handles T-1hr auto-cancel gate for supported venues (Bijou and ShowZone).
import { Injectable, Logger } from '@nestjs/common';
import { BIJOU_PRICING, SHOWZONE_PRICING } from
  '../../../services/core-api/src/config/governance.config';

export type VenueType = 'SHOWZONE' | 'BIJOU';

export interface SeatGateResult {
  gate_passed: boolean;
  seats_sold: number;
  minimum_required: number;
  venue: VenueType;
  action: 'PROCEED' | 'AUTO_CANCEL';
  reason_code: string;
}

@Injectable()
export class MinSeatGateService {
  private readonly logger = new Logger(MinSeatGateService.name);

  evaluate(params: {
    venue: VenueType;
    show_id: string;
    seats_sold: number;
    creator_override_minimum?: number;
  }): SeatGateResult {
    const platform_minimum = params.venue === 'BIJOU'
      ? BIJOU_PRICING.MIN_SEATS_TO_GO_LIVE
      : SHOWZONE_PRICING.MIN_SEATS_TO_GO_LIVE;

    // Creator may set a HIGHER minimum but not lower than platform floor
    const minimum_required = params.creator_override_minimum
      ? Math.max(params.creator_override_minimum, platform_minimum)
      : platform_minimum;

    const gate_passed = params.seats_sold >= minimum_required;

    this.logger.log('MinSeatGateService: gate evaluated', {
      show_id: params.show_id,
      venue: params.venue,
      seats_sold: params.seats_sold,
      minimum_required,
      gate_passed,
    });

    return {
      gate_passed,
      seats_sold: params.seats_sold,
      minimum_required,
      venue: params.venue,
      action: gate_passed ? 'PROCEED' : 'AUTO_CANCEL',
      reason_code: gate_passed
        ? 'MIN_SEAT_GATE_PASSED'
        : `MIN_SEAT_GATE_FAILED: ${params.seats_sold}/${minimum_required} seats sold at T-1hr`,
    };
  }
}
