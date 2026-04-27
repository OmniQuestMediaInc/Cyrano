"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassPricingService = void 0;
const common_1 = require("@nestjs/common");
const governance_config_1 = require("../../../services/core-api/src/config/governance.config");
let PassPricingService = class PassPricingService {
    computePassPrice(input) {
        const config = input.venue === 'BIJOU' ? governance_config_1.BIJOU_PRICING : governance_config_1.SHOWZONE_PRICING;
        const base = config.ADMISSION_ST_TOKENS_BASE ?? governance_config_1.SHOWZONE_PRICING.PASS_BASE_ST_TOKENS;
        const day_multiplier = config.DAY_MULTIPLIERS[input.day_of_week];
        const time_multiplier = this.resolveTimeMultiplier(input.show_start_hour_toronto, input.venue);
        const creator_tier_multiplier = input.venue === 'SHOWZONE'
            ? governance_config_1.SHOWZONE_PRICING.CREATOR_TIER_MULTIPLIERS[input.creator_tier]
            : 1.00;
        const advance_multiplier = input.venue === 'SHOWZONE'
            ? this.resolveAdvanceMultiplier(input.days_until_show)
            : 1.00;
        const geo_multiplier = this.resolveGeoMultiplier(input.vip_geo_tier);
        const composite = day_multiplier * time_multiplier * creator_tier_multiplier * advance_multiplier;
        const final_tokens_raw = base * composite;
        const final_tokens = Math.round(final_tokens_raw / 10) * 10;
        const st_price_usd = config.ST_PRICE_USD ?? governance_config_1.SHOWZONE_PRICING.ST_PRICE_USD;
        const final_usd_estimate = final_tokens * st_price_usd;
        return {
            base_tokens: base,
            day_multiplier,
            time_multiplier,
            creator_tier_multiplier,
            advance_multiplier,
            geo_multiplier,
            composite_multiplier: parseFloat(composite.toFixed(4)),
            final_tokens,
            final_usd_estimate: parseFloat(final_usd_estimate.toFixed(2)),
            multiplier_breakdown: {
                day: day_multiplier,
                time: time_multiplier,
                creator_tier: creator_tier_multiplier,
                advance: advance_multiplier,
                geo_display: geo_multiplier,
                composite,
            },
        };
    }
    resolveTimeMultiplier(hour, venue) {
        if (venue === 'BIJOU')
            return 1.00;
        const t = governance_config_1.SHOWZONE_PRICING.TIME_MULTIPLIERS;
        if (hour >= t.PRIME.from && hour < t.PRIME.to)
            return t.PRIME.multiplier;
        if (hour >= t.LATE_NIGHT.from || hour < (t.LATE_NIGHT.to - 24))
            return t.LATE_NIGHT.multiplier;
        if (hour >= t.AFTERNOON.from && hour < t.AFTERNOON.to)
            return t.AFTERNOON.multiplier;
        return t.OFF_PEAK.multiplier;
    }
    resolveAdvanceMultiplier(days_until_show) {
        const a = governance_config_1.SHOWZONE_PRICING.ADVANCE_PURCHASE_MULTIPLIERS;
        if (days_until_show === 0)
            return a.SAME_DAY;
        if (days_until_show <= 3)
            return a.ONE_TO_THREE;
        if (days_until_show <= 7)
            return a.FOUR_TO_SEVEN;
        return a.EIGHT_PLUS;
    }
    resolveGeoMultiplier(tier) {
        const t = governance_config_1.GEO_PRICING.TIERS;
        if (tier === 'LOW')
            return t.LOW.multiplier_min;
        if (tier === 'MED')
            return t.MED.multiplier_min;
        return 1.00;
    }
};
exports.PassPricingService = PassPricingService;
exports.PassPricingService = PassPricingService = __decorate([
    (0, common_1.Injectable)()
], PassPricingService);
//# sourceMappingURL=pass-pricing.service.js.map