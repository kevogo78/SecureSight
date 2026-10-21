import pytest
from src.core.privacy_filter import PrivacyFilter

@pytest.fixture
def filter_instance():
    return PrivacyFilter()

def test_safe_application(filter_instance):
    is_sensitive, reason = filter_instance.evaluate_environment("code.exe", "main.py - project")
    assert not is_sensitive
    assert reason == "Clean"

def test_blacklisted_banking_title(filter_instance):
    is_sensitive, reason = filter_instance.evaluate_environment("chrome.exe", "Chase Online Banking - Chrome")
    assert is_sensitive
    assert reason == "Title_Blacklisted"

def test_dlp_credit_card_detection(filter_instance):
    match, reason = filter_instance.scan_clipboard_for_dlp("Payment details: 4111-2222-3333-4444")
    assert match
    assert reason == "DLP_Credit_Card_Pattern"

def test_dlp_ssn_detection(filter_instance):
    match, reason = filter_instance.scan_clipboard_for_dlp("SSN: 123-45-6789")
    assert match
    assert reason == "DLP_SSN_Pattern"

def test_dlp_stream_scan_credit_card(filter_instance):
    is_sens, reason, sanitized = filter_instance.scan_stream("my card is 4111-2222-3333-4444 thanks")
    assert is_sens is True
    assert "Credit_Card" in reason
    assert "[REDACTED_CARD]" in sanitized
    assert "4111-2222-3333-4444" not in sanitized

def test_dlp_stream_scan_ssn(filter_instance):
    is_sens, reason, sanitized = filter_instance.scan_stream("patient ssn 987-65-4321 confirmed")
    assert is_sens is True
    assert "SSN" in reason
    assert "[REDACTED_SSN]" in sanitized
    assert "987-65-4321" not in sanitized

def test_dlp_stream_scan_password(filter_instance):
    is_sens, reason, sanitized = filter_instance.scan_stream("login config password=SuperSecretP@ss")
    assert is_sens is True
    assert "Credential" in reason
    assert "[REDACTED_SECRET]" in sanitized
    assert "SuperSecretP@ss" not in sanitized

def test_banking_domain_detection(filter_instance):
    is_sens, reason = filter_instance.evaluate_environment("firefox.exe", "https://chase.com/portal - Firefox")
    assert is_sens is True
    assert reason == "Banking_Domain_Detected"


def test_dynamic_rule_addition_and_sanitization(filter_instance):
    # 1. Dynamically add custom healthcare MRN regex rule
    custom_rule = {
        "rule_id": "rule_medical_mrn",
        "name": "Medical Record Number",
        "category": "regex",
        "pattern": r"\bMRN-\d{6}\b",
        "replacement": "[REDACTED_MRN]",
        "action": "mask_and_block",
        "reason": "DLP_Medical_Record",
        "enabled": True,
        "is_builtin": False
    }
    filter_instance.add_rule(custom_rule)

    # 2. Test sanitization applies dynamic rule
    raw_text = "Patient report for MRN-123456 received"
    sanitized = filter_instance.sanitize(raw_text)
    assert "[REDACTED_MRN]" in sanitized
    assert "MRN-123456" not in sanitized

    # 3. Test dynamic stream scanning
    is_sens, reason, stream_sanitized = filter_instance.scan_stream(raw_text)
    assert is_sens is True
    assert "Medical_Record" in reason
    assert "[REDACTED_MRN]" in stream_sanitized

    # 4. Toggle rule off (disabled)
    filter_instance.update_rule("rule_medical_mrn", {"enabled": False})
    unmasked = filter_instance.sanitize(raw_text)
    assert "MRN-123456" in unmasked

    # 5. Delete dynamic rule
    deleted = filter_instance.delete_rule("rule_medical_mrn")
    assert deleted is True
    assert not any(r["rule_id"] == "rule_medical_mrn" for r in filter_instance.get_rules())
