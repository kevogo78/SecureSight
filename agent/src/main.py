import sys
import time
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer
from src.ui.consent_modal import ConsentModal
from src.ui.system_tray import SystemTrayManager
from src.core.activity_tracker import ActivityTracker
from src.core.privacy_filter import PrivacyFilter
from src.core.crypto_engine import CryptoEngine
from src.core.screen_capture import ScreenCaptureEngine
from src.transport.api_client import TelemetryAPIClient

# Sample static demo configuration
CONFIG = {
    "endpoint_id": 1,
    "server_url": "http://127.0.0.1:8000/api/v1/telemetry",
    "crypto_key_hex": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "interval_ms": 10000
}

class AgentOrchestrator:
    def __init__(self, qt_app):
        self.app = qt_app
        self.tracker = ActivityTracker()
        self.privacy = PrivacyFilter()
        self.crypto = CryptoEngine(CONFIG["crypto_key_hex"])
        self.api = TelemetryAPIClient(CONFIG["server_url"])
        self.tray = SystemTrayManager(self.app)
        
        self.is_suspended = False
        self.tick_counter = 0

        self.tray.stop_requested.connect(self.terminate)
        self.tray.pause_requested.connect(self.handle_manual_pause)

        self.timer = QTimer()
        self.timer.timeout.connect(self.execute_polling_loop)

    def start(self):
        self.tracker.start()
        self.timer.start(CONFIG["interval_ms"])

    def handle_manual_pause(self, paused: bool):
        self.is_suspended = paused

    def execute_polling_loop(self):
        self.tick_counter += 1
        metrics = self.tracker.get_system_metrics()
        kpm = self.tracker.get_and_reset_activity()

        # Dynamically query active process and window title from activity tracker
        window_info = self.tracker.get_active_window()
        active_proc = window_info.get("app_name") or "Code.exe"
        active_title = window_info.get("window_title_sanitized") or window_info.get("window_title_raw") or "Active Window"

        is_sensitive, status_msg = self.privacy.evaluate_environment(active_proc, active_title)
        
        if self.is_suspended:
            status_msg = "User_Suspended"
            is_sensitive = True

        capture_requested = (self.tick_counter % 6 == 0) and not is_sensitive
        file_hash = None
        iv_hex = None
        encrypted_media = None

        if capture_requested:
            raw_screen = ScreenCaptureEngine.capture_and_redact()
            encrypted_media, iv_hex, file_hash = self.crypto.encrypt_bytes(raw_screen)

        payload = {
            "endpoint_id": CONFIG["endpoint_id"],
            "active_app": active_proc,
            "app_category": "Development",
            "keystroke_count": 0 if is_sensitive else kpm,
            "activity_state": "Privacy_Suspended" if is_sensitive else "Active",
            "cpu_percent": metrics["cpu_percent"],
            "ram_percent": metrics["ram_percent"],
            "filter_status": status_msg,
            "dlp_flag": is_sensitive,
            "capture_requested": capture_requested,
            "file_hash": file_hash,
            "encryption_iv": iv_hex
        }

        res = self.api.transmit_telemetry(payload)
        if res and res.get("upload_url") and encrypted_media:
            self.api.upload_encrypted_media(res["upload_url"], encrypted_media)

    def terminate(self):
        self.timer.stop()
        self.tracker.stop()
        self.app.quit()

def main():
    qt_app = QApplication(sys.argv)
    qt_app.setQuitOnLastWindowClosed(False)

    modal = ConsentModal()
    if modal.exec() == ConsentModal.DialogCode.Accepted:
        orchestrator = AgentOrchestrator(qt_app)
        orchestrator.start()
        sys.exit(qt_app.exec())
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()