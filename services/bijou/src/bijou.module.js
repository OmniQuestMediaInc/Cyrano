"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BijouModule = void 0;
const common_1 = require("@nestjs/common");
const bijou_session_service_1 = require("./bijou-session.service");
const pass_pricing_service_1 = require("./pass-pricing.service");
const min_seat_gate_service_1 = require("./min-seat-gate.service");
let BijouModule = class BijouModule {
};
exports.BijouModule = BijouModule;
exports.BijouModule = BijouModule = __decorate([
    (0, common_1.Module)({
        providers: [bijou_session_service_1.BijouSessionService, pass_pricing_service_1.PassPricingService, min_seat_gate_service_1.MinSeatGateService],
        exports: [bijou_session_service_1.BijouSessionService, pass_pricing_service_1.PassPricingService, min_seat_gate_service_1.MinSeatGateService],
    })
], BijouModule);
//# sourceMappingURL=bijou.module.js.map