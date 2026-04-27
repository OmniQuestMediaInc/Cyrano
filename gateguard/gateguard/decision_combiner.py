from .welfare_engine import WelfareGuardianScore
from .chargeback_proxy import ChargebackRiskProxy
from .state_provider import StateProvider
from typing import Dict, Any


class GateGuardDecision:
    def __init__(self):
        self.welfare = WelfareGuardianScore()
        self.proxy = ChargebackRiskProxy()
        self.state = StateProvider()

    def make_decision(self, telemetry: Dict, state_provider=None) -> Dict[str, Any]:
        if state_provider:
            self.state = state_provider

        if self.state.is_in_cooling_period(telemetry["user_id"]):
            return {
                "action": "COOLING_PERIOD_24H",
                "welfare_score": 0,
                "chargeback_proxy": 0,
                "tier": "blocked",
                "reason": "Active cooling period",
            }

        welfare_result = self.welfare.calculate(telemetry, self.state)
        proxy_result = self.proxy.calculate(telemetry, self.state)

        tier = welfare_result["tier"]
        if tier == "critical":
            action = "HCZ_ESCALATION"
        elif tier == "high":
            action = "COOLING_PERIOD_5MIN"
        elif tier == "medium":
            action = "SOFT_NUDGE"
        else:
            action = "APPROVE"

        self.state.record_welfare_score(telemetry["user_id"], welfare_result["welfare_score"])

        return {
            "action": action,
            "welfare_score": welfare_result["welfare_score"],
            "chargeback_proxy": proxy_result["chargeback_proxy"],
            "tier": tier,
            "reason": f"Welfare tier: {tier}",
        }
