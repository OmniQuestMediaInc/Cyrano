export type VenueType = 'SHOWZONE' | 'BIJOU';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type CreatorTier = 'NEW' | 'RISING' | 'ESTABLISHED' | 'STAR';
export type AdvanceWindow = 'SAME_DAY' | 'ONE_TO_THREE' | 'FOUR_TO_SEVEN' | 'EIGHT_PLUS';
export type GeoTier = 'LOW' | 'MED' | 'HIGH';
export interface PassPriceInput {
    venue: VenueType;
    day_of_week: DayOfWeek;
    show_start_hour_toronto: number;
    creator_tier: CreatorTier;
    days_until_show: number;
    vip_geo_tier: GeoTier;
}
export interface PassPriceResult {
    base_tokens: number;
    day_multiplier: number;
    time_multiplier: number;
    creator_tier_multiplier: number;
    advance_multiplier: number;
    geo_multiplier: number;
    composite_multiplier: number;
    final_tokens: number;
    final_usd_estimate: number;
    multiplier_breakdown: Record<string, number>;
}
export declare class PassPricingService {
    computePassPrice(input: PassPriceInput): PassPriceResult;
    private resolveTimeMultiplier;
    private resolveAdvanceMultiplier;
    private resolveGeoMultiplier;
}
