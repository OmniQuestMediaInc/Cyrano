import pytest
from gateguard.federation.participant_sim import run_federation_simulation


def test_simulation_returns_correct_node_count():
    results = run_federation_simulation(num_nodes=3)
    assert len(results) == 3


def test_all_nodes_signed_and_verified():
    results = run_federation_simulation(num_nodes=3)
    for r in results:
        assert r["signed"] is True
        assert r["verified"] is True


def test_single_node_simulation():
    results = run_federation_simulation(num_nodes=1)
    assert len(results) == 1
    assert results[0]["node_id"] == "node_0"
    assert results[0]["verified"] is True
