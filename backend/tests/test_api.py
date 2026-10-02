from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_telemetry_schema_validation():
    # Negative keystroke values violate validation rules
    bad_payload = {
        "endpoint_id": 1,
        "active_app": "test.exe",
        "cpu_percent": 105.0,  # Invalid: > 100.0
        "ram_percent": -5.0,   # Invalid: < 0.0
        "keystroke_count": -1
    }
    res = client.post("/api/v1/telemetry", json=bad_payload)
    assert res.status_code == 422

def test_endpoints_flow_and_kick():
    # 1. Register an endpoint
    reg_payload = {
        "endpoint_id": 99,
        "hostname": "TEST-WORKSTATION-99",
        "os_type": "macOS 14.5",
        "user": "test_engineer",
        "agent_ver": "1.0.0"
    }
    reg_res = client.post("/api/v1/endpoints/register", json=reg_payload)
    assert reg_res.status_code == 200
    assert reg_res.json()["status"] == "registered"

    # 2. Verify it shows in endpoints list
    list_res = client.get("/api/v1/endpoints")
    assert list_res.status_code == 200
    endpoints = list_res.json()
    assert any(e["endpoint_id"] == 99 for e in endpoints)

    # 3. Post telemetry for this endpoint
    telemetry_payload = {
        "endpoint_id": 99,
        "active_app": "Terminal",
        "app_category": "Development",
        "keystroke_count": 55,
        "cpu_percent": 15.0,
        "ram_percent": 30.0,
        "hostname": "TEST-WORKSTATION-99",
        "os_type": "macOS 14.5"
    }
    t_res = client.post("/api/v1/telemetry", json=telemetry_payload)
    assert t_res.status_code == 200
    assert t_res.json()["status"] == "success"

    # 4. Kick the endpoint
    kick_res = client.post("/api/v1/endpoints/99/kick")
    assert kick_res.status_code == 200
    assert kick_res.json()["status"] == "kicked"

    # 5. Verify telemetry is rejected / responds with kicked
    t_after_kick = client.post("/api/v1/telemetry", json=telemetry_payload)
    assert t_after_kick.status_code == 200
    assert t_after_kick.json()["status"] == "kicked"