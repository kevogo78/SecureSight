import platform
from unittest.mock import patch, MagicMock
import pytest
from src.core.activity_tracker import ActivityTracker, HAS_WIN32


@pytest.fixture
def tracker():
    return ActivityTracker(poll_interval=0.1, enable_keystrokes=False)


def test_activity_tracker_initialization(tracker):
    assert tracker.keystroke_count == 0
    assert tracker.mouse_click_count == 0
    assert tracker.poll_interval == 0.1
    assert tracker.current_snapshot == {}


def test_activity_counter_recording_and_reset(tracker):
    tracker.record_keystroke()
    tracker.record_keystroke()
    tracker.record_mouse_click()

    assert tracker.keystroke_count == 2
    assert tracker.mouse_click_count == 1

    activity = tracker.get_and_reset_activity()
    assert activity["keystrokes"] == 2
    assert activity["mouse_clicks"] == 1
    assert activity["kpm"] == 2

    # Verify counters reset to 0
    assert tracker.keystroke_count == 0
    assert tracker.mouse_click_count == 0


def test_system_metrics_structure(tracker):
    metrics = tracker.get_system_metrics()
    required_keys = [
        "hostname", "username", "os", "os_version",
        "architecture", "cpu_percent", "ram_percent", "disk_percent",
        "mac_address", "device_fingerprint"
    ]
    for key in required_keys:
        assert key in metrics, f"Missing key {key} in system metrics"
    assert isinstance(metrics["cpu_percent"], (int, float))
    assert isinstance(metrics["ram_percent"], (int, float))
    assert isinstance(metrics["disk_percent"], (int, float))
    assert isinstance(metrics["mac_address"], str)
    assert isinstance(metrics["device_fingerprint"], str)


def test_has_win32_on_windows():
    """Verify pywin32 is detected when running on Windows."""
    if platform.system() == "Windows":
        assert HAS_WIN32 is True, "pywin32 (win32gui/win32process) should be installed on Windows"


def test_get_active_window_mocked(tracker):
    """Test foreground window retrieval and privacy redaction using mock."""
    with patch("src.core.activity_tracker.HAS_WIN32", True), \
         patch("src.core.activity_tracker.platform.system", return_value="Windows"), \
         patch("src.core.activity_tracker.win32gui", create=True) as mock_win32gui, \
         patch("src.core.activity_tracker.win32process", create=True) as mock_win32proc, \
         patch("src.core.activity_tracker.psutil.Process") as mock_psutil_proc:

        mock_win32gui.GetForegroundWindow.return_value = 12345
        mock_win32gui.GetWindowText.return_value = "Project Workspace - password=secret123"
        mock_win32proc.GetWindowThreadProcessId.return_value = (None, 9999)

        mock_proc_instance = MagicMock()
        mock_proc_instance.name.return_value = "Code.exe"
        mock_psutil_proc.return_value = mock_proc_instance

        result = tracker.get_active_window()

        assert result["app_name"] == "Code.exe"
        assert result["window_title_raw"] == "Project Workspace - password=secret123"
        # Verify PrivacyFilter sanitized the secret
        assert "[REDACTED_SECRET]" in result["window_title_sanitized"]
        assert "secret123" not in result["window_title_sanitized"]


def test_get_active_window_fallback_when_win32_missing(tracker):
    """Verify fallback behavior when HAS_WIN32 is False."""
    with patch("src.core.activity_tracker.HAS_WIN32", False):
        result = tracker.get_active_window()
        assert result["app_name"] == "System Process"
        assert result["window_title_raw"] == "Active Application (Platform Fallback)"


def test_get_snapshot(tracker):
    snapshot = tracker.get_snapshot()
    assert "endpoint_id" in snapshot
    assert "active_app" in snapshot
    assert "cpu_percent" in snapshot
    assert "ram_percent" in snapshot
    assert "disk_percent" in snapshot


def test_tracker_lifecycle(tracker):
    tracker.start()
    assert tracker._running is True
    assert tracker._thread is not None
    assert tracker._thread.is_alive()
    tracker.stop()
    assert tracker._running is False


def test_dlp_sensitive_activity_callback():
    triggered_reasons = []
    tracker = ActivityTracker(
        poll_interval=0.1,
        enable_keystrokes=True,
        on_sensitive_activity=lambda r: triggered_reasons.append(r)
    )

    # Manually trigger sensitive event
    tracker._trigger_sensitive_event("DLP_SSN")
    assert len(triggered_reasons) == 1
    assert triggered_reasons[0] == "DLP_SSN"

    is_active, reason = tracker.is_sensitive_active(cooldown=5.0)
    assert is_active is True
    assert reason == "DLP_SSN"


def test_dlp_keystroke_redaction_in_sensitive_window(tmp_path):
    log_file = tmp_path / "test_keystrokes.txt"
    tracker = ActivityTracker(poll_interval=0.1, enable_keystrokes=True)
    tracker.keystroke_log_file = str(log_file)

    # Simulate blacklisted active window
    tracker._cached_window_sensitive = True
    tracker._cached_window_reason = "Title_Blacklisted"
    tracker._last_window_check_time = 9999999999.0  # prevent cache invalidation

    # Mock key press
    class MockKey:
        char = "a"

    tracker._on_key_press(MockKey())
    
    with open(tracker.keystroke_log_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Sensitive window must mask character as '*'
    assert content == "*"
    assert tracker.keystroke_count == 1
    is_active, reason = tracker.is_sensitive_active(cooldown=5.0)
    assert is_active is True
    assert reason == "Title_Blacklisted"


def test_extract_website_url():
    # 1. Direct URL in title
    assert ActivityTracker.extract_website_url("chrome.exe", "https://github.com/user/repo") == "github.com/user/repo"

    # 2. Domain pattern in title
    assert ActivityTracker.extract_website_url("msedge.exe", "AWS Console - aws.amazon.com/console") == "aws.amazon.com/console"
    assert ActivityTracker.extract_website_url("firefox.exe", "Student Portal - portal.ggc.edu") == "portal.ggc.edu"

    # 3. Known web platform brand resolution in browser
    assert ActivityTracker.extract_website_url("chrome.exe", "Stack Overflow - Questions - Google Chrome") == "stackoverflow.com"
    assert ActivityTracker.extract_website_url("msedge.exe", "YouTube - Home - Microsoft Edge") == "youtube.com"

    # 4. Non-browser local desktop processes should return None
    assert ActivityTracker.extract_website_url("Code.exe", "main.py - Visual Studio Code") is None
    assert ActivityTracker.extract_website_url("notepad.exe", "Untitled - Notepad") is None


def test_keystroke_audit_path_resolution():
    """Verify smart path resolution for keystroke audit file."""
    # Absolute path
    abs_path = "C:/tmp/custom_audit.txt" if platform.system() == "Windows" else "/tmp/custom_audit.txt"
    assert ActivityTracker._resolve_audit_file_path(abs_path) == abs_path

    # Relative path defaults
    res = ActivityTracker._resolve_audit_file_path("agent/keystroke_audit.txt")
    assert res.endswith("keystroke_audit.txt")


def test_flush_buffer_writes_to_file(tmp_path):
    """Verify that buffer flush writes pending characters to disk."""
    log_file = tmp_path / "keystroke_audit.txt"
    tracker = ActivityTracker(poll_interval=0.1, enable_keystrokes=True)
    tracker.keystroke_log_file = str(log_file)

    tracker._write_buffer = ["H", "e", "l", "l", "o", " ", "W", "o", "r", "l", "d"]
    success = tracker.flush_buffer()

    assert success is True
    assert tracker._write_buffer == []
    with open(str(log_file), "r", encoding="utf-8") as f:
        assert f.read() == "Hello World"


def test_sync_to_s3_success(tmp_path, monkeypatch):
    """Verify boto3 S3 upload properly references environment variables and uploads file."""
    log_file = tmp_path / "keystroke_audit.txt"
    log_file.write_text("user typed login credentials [REDACTED]", encoding="utf-8")

    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "TEST_KEY_ID")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "TEST_SECRET_KEY")
    monkeypatch.setenv("S3_BUCKET_NAME", "test-telemetry-bucket")

    tracker = ActivityTracker(poll_interval=0.1, enable_keystrokes=True)
    tracker.keystroke_log_file = str(log_file)

    mock_s3_client = MagicMock()
    success = tracker.sync_to_s3(s3_client=mock_s3_client)

    assert success is True
    mock_s3_client.upload_file.assert_called_once_with(
        str(log_file),
        "test-telemetry-bucket",
        "keystroke_audit/keystroke_audit.txt"
    )


def test_sync_to_s3_skips_when_no_file(tmp_path):
    """Verify S3 upload skips safely if audit file does not exist."""
    tracker = ActivityTracker(poll_interval=0.1, enable_keystrokes=True)
    tracker.keystroke_log_file = str(tmp_path / "non_existent.txt")

    mock_s3_client = MagicMock()
    success = tracker.sync_to_s3(bucket_name="test-bucket", s3_client=mock_s3_client)

    assert success is False
    mock_s3_client.upload_file.assert_not_called()


def test_set_keystrokes_enabled_toggles_and_syncs(tmp_path):
    """Verify toggling off keystrokes triggers buffer flush and S3 synchronization."""
    log_file = tmp_path / "keystroke_audit.txt"
    tracker = ActivityTracker(poll_interval=0.1, enable_keystrokes=True)
    tracker.keystroke_log_file = str(log_file)

    # Mock listener
    mock_listener = MagicMock()
    tracker._keyboard_listener = mock_listener

    with patch.object(tracker, "flush_buffer") as mock_flush, \
         patch.object(tracker, "sync_to_s3") as mock_sync:
        mock_sync.return_value = True

        # Toggle off
        result = tracker.set_keystrokes_enabled(False)
        assert result is True
        assert tracker.enable_keystrokes is False
        mock_flush.assert_called_once()
        mock_sync.assert_called_once()
        mock_listener.stop.assert_called_once()
        assert tracker._keyboard_listener is None

        # Toggle back on
        with patch("src.core.activity_tracker.HAS_PYNPUT", True), \
             patch("src.core.activity_tracker.keyboard.Listener") as mock_listener_cls:
            tracker.set_keystrokes_enabled(True)
            assert tracker.enable_keystrokes is True
            mock_listener_cls.assert_called_once()




