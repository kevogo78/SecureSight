import os
import platform
import socket
import getpass
import psutil
from typing import Dict, Any, Optional

# Optional native Windows API bindings for Active Window Detection (Task 5)
try:
    import win32gui
    import win32process
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Import Privacy Filter (Task 6)
try:
    from src.core.privacy_filter import PrivacyFilter
except ImportError:
    # Local fallback for standalone testing if path is not resolved
    from privacy_filter import PrivacyFilter


class ActivityTracker:
    def __init__(self):
        self.privacy_filter = PrivacyFilter()

    def get_system_metrics(self) -> Dict[str, Any]:
        """Collects OS, Host, and hardware utilization metrics (Tasks 3 & 4)."""
        disk = psutil.disk_usage('C:\\' if platform.system() == 'Windows' else '/')
        return {
            "hostname": socket.gethostname(),
            "username": getpass.getuser(),
            "os": f"{platform.system()} {platform.release()}",
            "os_version": platform.version(),
            "architecture": platform.machine(),
            "cpu_percent": psutil.cpu_percent(interval=None),
            "ram_percent": psutil.virtual_memory().percent,
            "disk_percent": disk.percent
        }

    def get_active_window(self) -> Dict[str, str]:
        """
        Detects the current foreground window title and active process (Task 5).
        """
        app_name = "Unknown"
        raw_title = "Unknown"

        if HAS_WIN32 and platform.system() == "Windows":
            try:
                hwnd = win32gui.GetForegroundWindow()
                if hwnd:
                    raw_title = win32gui.GetWindowText(hwnd) or "Desktop"
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    if pid > 0:
                        proc = psutil.Process(pid)
                        app_name = proc.name()
            except Exception:
                pass
        else:
            raw_title = "Active Application (Platform Fallback)"
            app_name = "System Process"

        # Apply Task 6: Privacy filter redacts sensitive data from window titles
        sanitized_title = self.privacy_filter.sanitize(raw_title)

        return {
            "app_name": app_name,
            "window_title_raw": raw_title,
            "window_title_sanitized": sanitized_title
        }

    def get_snapshot(self) -> Dict[str, Any]:
        """Consolidates metrics, active app, and privacy redaction for demonstration."""
        metrics = self.get_system_metrics()
        active_app = self.get_active_window()
        return {
            **metrics,
            **active_app
        }