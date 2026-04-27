export type VenueType = 'SHOWZONE' | 'BIJOU';
export interface SeatGateResult {
    gate_passed: boolean;
    seats_sold: number;
    minimum_required: number;
    venue: VenueType;
    action: 'PROCEED' | 'AUTO_CANCEL';
    reason_code: string;
}
export declare class MinSeatGateService {
    private readonly logger;
    evaluate(params: {
        venue: VenueType;
        show_id: string;
        seats_sold: number;
        creator_override_minimum?: number;
    }): SeatGateResult;
}
