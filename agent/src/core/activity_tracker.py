import os
import platform
import socket
import getpass
import psutil
import threading
import time
from typing import Dict, Any, Optional

# Win32 bindings for foreground window detection (Task 5)
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
    from privacy_filter import PrivacyFilter


class ActivityTracker:
    def __init__(self, poll_interval: float = 2.0):
        self.privacy_filter = PrivacyFilter()
        self.poll_interval = poll_interval
        
        # Threading lifecycle management
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        # Activity metrics counters (KPM / keystrokes / mouse activity)
        self.keystroke_count = 0
        self.mouse_click_count = 0
        
        # In-memory snapshot cache
        self.current_snapshot: Dict[str, Any] = {}

    def record_keystroke(self):
        """Thread-safe increment of keystroke counts."""
        with self._lock:
            self.keystroke_count += 1

    def record_mouse_click(self):
        """Thread-safe increment of mouse clicks."""
        with self._lock:
            self.mouse_click_count += 1

    def get_and_reset_activity(self) -> Dict[str, int]:
        """
        Retrieves active keystroke/activity rates and resets
        counters for the next polling interval.
        """
        with self._lock:
            activity = {
                "keystrokes": self.keystroke_count,
                "mouse_clicks": self.mouse_click_count,
                "kpm": self.keystroke_count  # Keystrokes per interval/minute window
            }
            # Reset counters
            self.keystroke_count = 0
            self.mouse_click_count = 0
            return activity

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
        """Detects current foreground window and process (Task 5)."""
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
        elif platform.system() == "Darwin":
            try:
                import subprocess
                cmd_app = "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'"
                app_res = subprocess.check_output(cmd_app, shell=True, text=True, timeout=1).strip()
                if app_res:
                    app_name = app_res
                cmd_title = "osascript -e 'tell application \"System Events\" to tell (first application process whose frontmost is true) to get name of front window'"
                try:
                    title_res = subprocess.check_output(cmd_title, shell=True, text=True, timeout=1).strip()
                    raw_title = f"{app_res} - {title_res}" if title_res else app_res
                except Exception:
                    raw_title = app_res or "macOS Active Application"
            except Exception:
                raw_title = "macOS Active Application"
                app_name = "System Process"
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
        """Consolidates metrics, active app, and privacy redaction matching backend schema."""
        metrics = self.get_system_metrics()
        active_app_data = self.get_active_window()

        return {
            **metrics,
            **active_app_data,
            "endpoint_id": 1,  # Backend schema expects an integer foreign key
            "active_app": active_app_data.get("app_name", "Unknown"),
        }

    def _monitor_loop(self):
        """Background thread polling loop."""
        while self._running:
            try:
                self.current_snapshot = self.get_snapshot()
            except Exception as e:
                print(f"[TRACKER ERROR] {e}")
            time.sleep(self.poll_interval)

    def start(self):
        """Starts background tracking thread."""
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self._thread.start()
            print("[ACTIVITY TRACKER] Background monitor loop started.")

    def stop(self):
        """Stops background tracking thread cleanly."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
            print("[ACTIVITY TRACKER] Background monitor loop stopped.")