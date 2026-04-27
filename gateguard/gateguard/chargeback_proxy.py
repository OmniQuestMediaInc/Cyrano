from .welfare_engine import WelfareGuardianScore
from typing import Dict, Any


class ChargebackRiskProxy:
    def __init__(self):
        self.welfare = WelfareGuardianScore()

    def calculate(self, telemetry: Dict, state_provider=None) -> Dict[str, Any]:
        welfare = self.welfare.calculate(telemetry, state_provider)
        proxy = min(
            100.0,
            welfare["welfare_score"] * 0.75 + abs(telemetry.get("velocity_z", 0)) * 8,
        )
        return {"chargeback_proxy": round(proxy, 2), "derived_from_welfare": True}
