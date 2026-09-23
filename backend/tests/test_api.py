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