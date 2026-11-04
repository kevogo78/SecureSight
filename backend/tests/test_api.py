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


def test_endpoint_update_and_history_linking():
    # 1. Register with hardware identifiers
    reg_payload = {
        "endpoint_id": 88,
        "hostname": "FINANCE-DESK-88",
        "user": "alice_finance",
        "mac_address": "AA:BB:CC:DD:EE:88",
        "device_fingerprint": "fp_hardware_88"
    }
    client.post("/api/v1/endpoints/register", json=reg_payload)

    # 2. Query history to confirm connection record exists
    hist_res = client.get("/api/v1/endpoints/88/history")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    assert any(h["device_fingerprint"] == "fp_hardware_88" for h in history)

    # 3. Update display name and re-link device identifiers
    update_payload = {
        "display_name": "Executive Accounting 88",
        "mac_address": "AA:BB:CC:DD:EE:99",
        "device_fingerprint": "fp_hardware_relinked_88"
    }
    up_res = client.put("/api/v1/endpoints/88", json=update_payload)
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "success"

    # 4. Verify updated display name and identifiers in endpoint listing
    list_res = client.get("/api/v1/endpoints")
    ep = next((e for e in list_res.json() if e["endpoint_id"] == 88), None)
    assert ep is not None
    assert ep["name"] == "Executive Accounting 88"
    assert ep["mac_address"] == "AA:BB:CC:DD:EE:99"
    assert ep["device_fingerprint"] == "fp_hardware_relinked_88"

    # 5. Verify history links past logins
    hist_relinked = client.get("/api/v1/endpoints/88/history")
    assert hist_relinked.status_code == 200
    assert len(hist_relinked.json()) >= 1


def test_endpoint_safe_delete():
    # Register and then delete
    client.post("/api/v1/endpoints/register", json={
        "endpoint_id": 77,
        "hostname": "TEMP-WORKSTATION-77",
        "user": "temporary_user"
    })
    
    del_res = client.delete("/api/v1/endpoints/77")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify no longer present
    list_res = client.get("/api/v1/endpoints")
    assert not any(e["endpoint_id"] == 77 for e in list_res.json())


def test_telemetry_website_url_indexing():
    payload = {
        "endpoint_id": 66,
        "active_app": "chrome.exe",
        "app_category": "Browsing",
        "website_url": "github.com/SecureSight/Project",
        "keystroke_count": 42,
        "cpu_percent": 12.0,
        "ram_percent": 34.0,
        "hostname": "WEB-BROWSER-NODE-66",
        "os_type": "Windows 11 Enterprise"
    }
    t_res = client.post("/api/v1/telemetry", json=payload)
    assert t_res.status_code == 200

    logs_res = client.get("/api/v1/audit/logs")
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert any(
        l.get("endpoint_id") == 66 and l.get("website_url") == "github.com/SecureSight/Project"
        for l in logs
    )


def test_privacy_rules_engine_crud_and_test():
    # 1. Fetch default dynamic rules
    res = client.get("/api/v1/privacy/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 4
    assert any(r["rule_id"] == "rule_credit_cards" for r in rules)

    # 2. Create custom dynamic rule
    create_payload = {
        "name": "Internal Auth Token",
        "category": "regex",
        "pattern": r"\bAUTH_TOKEN_[A-Za-z0-9]{8}\b",
        "replacement": "[REDACTED_AUTH_TOKEN]",
        "action": "mask_and_block",
        "reason": "DLP_Internal_Token",
        "enabled": True,
        "description": "Masks internal company auth tokens"
    }
    create_res = client.post("/api/v1/privacy/rules", json=create_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    rule_id = created["rule_id"]
    assert created["replacement"] == "[REDACTED_AUTH_TOKEN]"

    # 3. Simulate text redaction via /privacy/test
    test_res = client.post("/api/v1/privacy/test", json={
        "text": "User session token is AUTH_TOKEN_abc12345 and card is 4111-2222-3333-4444"
    })
    assert test_res.status_code == 200
    test_data = test_res.json()
    assert test_data["is_sensitive"] is True
    assert "[REDACTED_AUTH_TOKEN]" in test_data["sanitized_text"]
    assert "[REDACTED_CARD]" in test_data["sanitized_text"]
    assert "AUTH_TOKEN_abc12345" not in test_data["sanitized_text"]

    # 4. Update dynamic rule (disable it)
    update_res = client.put(f"/api/v1/privacy/rules/{rule_id}", json={"enabled": False})
    assert update_res.status_code == 200
    assert update_res.json()["enabled"] is False

    # 5. Delete dynamic rule
    del_res = client.delete(f"/api/v1/privacy/rules/{rule_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

