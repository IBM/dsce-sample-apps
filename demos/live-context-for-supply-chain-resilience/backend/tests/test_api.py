# backend/tests/test_api.py
# FastAPI integration tests using TestClient (spec/10 contract_tests)

from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.store.in_memory_store import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    store.reset_to_seed()
    yield
    store.reset_to_seed()


class TestHealth:
    def test_health_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestDemoSimulate:
    def test_simulate_delay_detects_risk(self):
        resp = client.post("/api/demo/simulate-delay", json={
            "shipment_id": "SHP-90017",
            "requirement_id": "MR-7781",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_detected"] is True
        assert "risk_id" in data
        assert data["severity"] in ("CRITICAL", "HIGH", "MEDIUM")  # severity depends on hours until required_by

    def test_simulate_returns_correlation_id(self):
        resp = client.post(
            "/api/demo/simulate-delay",
            json={"shipment_id": "SHP-90017", "requirement_id": "MR-7781"},
            headers={"x-correlation-id": "TEST-CID-123"},
        )
        assert resp.headers.get("x-correlation-id") == "TEST-CID-123"


class TestRisksAPI:
    def test_get_nonexistent_risk_404(self):
        resp = client.get("/api/risks/RSK-NOTEXIST")
        assert resp.status_code == 404
        body = resp.json()
        assert body["code"] == "NOT_FOUND"

    def test_list_risks_empty_initially(self):
        resp = client.get("/api/risks")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_risk_appears_after_simulate(self):
        client.post("/api/demo/simulate-delay", json={
            "shipment_id": "SHP-90017", "requirement_id": "MR-7781"
        })
        resp = client.get("/api/risks")
        assert resp.json()["total"] == 1


class TestShipmentsAPI:
    def test_get_shipment(self):
        resp = client.get("/api/shipments/SHP-90017")
        assert resp.status_code == 200
        assert resp.json()["shipment"]["shipment_id"] == "SHP-90017"
        assert resp.json()["shipment"]["status"] == "DELAYED"

    def test_shipment_not_found(self):
        resp = client.get("/api/shipments/SHP-NOPE")
        assert resp.status_code == 404


class TestWorkPackageAPI:
    def test_get_work_package(self):
        resp = client.get("/api/work-packages/TW-2047")
        assert resp.status_code == 200
        data = resp.json()
        assert data["work_package"]["work_package_id"] == "TW-2047"
        assert len(data["requirements"]) == 1
        assert data["requirements"][0]["requirement_id"] == "MR-7781"


class TestInventoryAPI:
    def test_get_inventory_options(self):
        resp = client.get("/api/inventory/options", params={
            "material_id": "CVA-8842",
            "destination_location_id": "PEARL-DEMO",
            "quantity": 1,
            "required_by": "2026-10-10T00:00:00Z",
        })
        assert resp.status_code == 200
        data = resp.json()
        candidates = data["candidates"]
        # Should find REGIONAL-WH-DEMO (not PEARL-DEMO itself)
        assert any(c["position"]["location_id"] == "REGIONAL-WH-DEMO" for c in candidates)


class TestMitigationOptions:
    def test_options_returned_after_risk_detection(self):
        sim = client.post("/api/demo/simulate-delay", json={
            "shipment_id": "SHP-90017", "requirement_id": "MR-7781"
        })
        risk_id = sim.json()["risk_id"]

        resp = client.get(f"/api/risks/{risk_id}/options")
        assert resp.status_code == 200
        options = resp.json()["ranked_options"]
        assert len(options) >= 1
        types = {o["type"] for o in options}
        # Substitute must be infeasible without engineering evidence
        sub_opts = [o for o in options if o["type"] == "SUBSTITUTE"]
        if sub_opts:
            assert not sub_opts[0]["feasible"]


class TestApprovalEnforcement:
    def test_write_action_without_approval_rejected(self):
        """spec/10: action_without_approval → APPROVAL_REQUIRED"""
        resp = client.post("/api/actions/inventory-transfer", json={
            "approval_request_id": "nonexistent",
            "risk_id": "RSK-TEST",
            "option_id": "OPT-TEST",
            "source_location_id": "REGIONAL-WH-DEMO",
            "destination_location_id": "PEARL-DEMO",
            "material_id": "CVA-8842",
            "quantity": 1,
        })
        assert resp.status_code == 403
        assert resp.json()["code"] == "APPROVAL_REQUIRED"


class TestDemoReset:
    def test_reset_clears_risks(self):
        client.post("/api/demo/simulate-delay", json={
            "shipment_id": "SHP-90017", "requirement_id": "MR-7781"
        })
        client.post("/api/demo/reset")
        resp = client.get("/api/risks")
        assert resp.json()["total"] == 0
