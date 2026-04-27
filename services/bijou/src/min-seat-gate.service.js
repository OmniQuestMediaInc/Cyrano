"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MinSeatGateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinSeatGateService = void 0;
const common_1 = require("@nestjs/common");
const governance_config_1 = require("../../../services/core-api/src/config/governance.config");
let MinSeatGateService = MinSeatGateService_1 = class MinSeatGateService {
    constructor() {
        this.logger = new common_1.Logger(MinSeatGateService_1.name);
    }
    evaluate(params) {
        const platform_minimum = params.venue === 'BIJOU'
            ? governance_config_1.BIJOU_PRICING.MIN_SEATS_TO_GO_LIVE
            : governance_config_1.SHOWZONE_PRICING.MIN_SEATS_TO_GO_LIVE;
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
};
exports.MinSeatGateService = MinSeatGateService;
exports.MinSeatGateService = MinSeatGateService = MinSeatGateService_1 = __decorate([
    (0, common_1.Injectable)()
], MinSeatGateService);
//# sourceMappingURL=min-seat-gate.service.js.map