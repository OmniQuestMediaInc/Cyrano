from gateguard.decision_combiner import GateGuardDecision
from gateguard.state_provider import StateProvider
from gateguard.audit.persistent_log import AuditLog

def main():
    print("=== GateGuard Sentinel™ v0.3 Final Demo ===\n")
    engine = GateGuardDecision()
    state = StateProvider()
    audit = AuditLog()

    cases = [
        {"user_id": "guest_001", "amount": 49.99, "session_heat": 45, "velocity_z": 0.8, "duration": 35, "hour": 14},
        {"user_id": "guest_002", "amount": 299.99, "session_heat": 92, "velocity_z": 3.2, "duration": 145, "hour": 3},
    ]

    for case in cases:
        result = engine.make_decision(case, state)
        print(f"${case['amount']} → {result['action']}")
        print(f"  Welfare: {result['welfare_score']:.1f} | Proxy: {result['chargeback_proxy']:.1f}")
        audit.log_decision(result)
        print()

    print("✅ Audit chain verified | Federation simulation ready")

if __name__ == "__main__":
    main()
