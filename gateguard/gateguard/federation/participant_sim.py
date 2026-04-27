from .protocol import FederationProtocol
from typing import List, Dict, Any


def run_federation_simulation(num_nodes: int = 3) -> List[Dict[str, Any]]:
    nodes = [FederationProtocol() for _ in range(num_nodes)]
    results = []
    for i, node in enumerate(nodes):
        update = {"node_id": f"node_{i}", "decision": "APPROVE", "score": 42.0}
        signed = node.sign_update(update)
        verified = node.verify_update(dict(signed))
        results.append({"node_id": f"node_{i}", "signed": True, "verified": verified})
    print(f"Federation simulation: {num_nodes} nodes signed and verified (ed25519).")
    return results
