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