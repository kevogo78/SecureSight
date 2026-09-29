import platform
from unittest.mock import patch, MagicMock
import pytest
from src.core.activity_tracker import ActivityTracker, HAS_WIN32


@pytest.fixture
def tracker():
    return ActivityTracker(poll_interval=0.1)


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
        "architecture", "cpu_percent", "ram_percent", "disk_percent"
    ]
    for key in required_keys:
        assert key in metrics, f"Missing key {key} in system metrics"
    assert isinstance(metrics["cpu_percent"], (int, float))
    assert isinstance(metrics["ram_percent"], (int, float))
    assert isinstance(metrics["disk_percent"], (int, float))


def test_has_win32_on_windows():
    """Verify pywin32 is detected when running on Windows."""
    if platform.system() == "Windows":
        assert HAS_WIN32 is True, "pywin32 (win32gui/win32process) should be installed on Windows"


def test_get_active_window_mocked(tracker):
    """Test foreground window retrieval and privacy redaction using mock."""
    with patch("src.core.activity_tracker.HAS_WIN32", True), \
         patch("src.core.activity_tracker.platform.system", return_value="Windows"), \
         patch("src.core.activity_tracker.win32gui") as mock_win32gui, \
         patch("src.core.activity_tracker.win32process") as mock_win32proc, \
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

