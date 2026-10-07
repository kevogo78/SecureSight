import sys
import os
import time
import socket
import zlib
import platform
import getpass
import requests
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer
from src.ui.consent_modal import ConsentModal
from src.ui.system_tray import SystemTrayManager
from src.core.activity_tracker import ActivityTracker
from src.core.privacy_filter import PrivacyFilter
from src.core.crypto_engine import CryptoEngine
from src.core.screen_capture import ScreenCaptureEngine
from src.transport.api_client import TelemetryAPIClient

# Default static demo configuration
CONFIG = {
    "server_url": "http://127.0.0.1:8000/api/v1/telemetry",
    "crypto_key_hex": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "interval_ms": 10000
}

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "192.168.1.101"

def derive_endpoint_id(name: str) -> int:
    if not name:
        return 1
    clean = name.strip()
    if clean == "WORKSTATION-WIN11" or clean == "1":
        return 1
    if "mac" in clean.lower() or clean == "MACBOOK-PRO-M2" or clean == "2":
        return 2
    # Deterministic positive integer between 10 and 999
    return (zlib.crc32(clean.encode('utf-8')) % 990) + 10

class AgentOrchestrator:
    def __init__(self, qt_app, server_url: str = None, endpoint_name: str = None):
        self.app = qt_app
        self.endpoint_name = endpoint_name or socket.gethostname()
        self.endpoint_id = derive_endpoint_id(self.endpoint_name)
        self.server_url = server_url or CONFIG["server_url"]
        
        self.tracker = ActivityTracker(enable_keystrokes=True)
        self.privacy = PrivacyFilter()
        self.crypto = CryptoEngine(CONFIG["crypto_key_hex"])
        self.api = TelemetryAPIClient(self.server_url)
        self.tray = SystemTrayManager(self.app)
        
        self.is_suspended = False
        self.tick_counter = 0

        self.tray.stop_requested.connect(self.terminate)
        self.tray.pause_requested.connect(self.handle_manual_pause)

        self.timer = QTimer()
        self.timer.timeout.connect(self.execute_polling_loop)

    def start(self):
        self.tracker.start()
        self.register_endpoint()
        self.timer.start(CONFIG["interval_ms"])
        # Transmit initial telemetry handshake packet immediately upon start
        QTimer.singleShot(600, self.execute_polling_loop)

    def register_endpoint(self):
        """Notifies fleet backend of newly consented workstation."""
        try:
            reg_url = self.server_url.replace("/telemetry", "/endpoints/register")
            payload = {
                "endpoint_id": self.endpoint_id,
                "hostname": self.endpoint_name,
                "os_type": f"{platform.system()} {platform.release()}",
                "user": getpass.getuser(),
                "agent_ver": "1.0.0",
                "ip_address": get_local_ip()
            }
            response = requests.post(reg_url, json=payload, timeout=3)
            if response.status_code != 200:
                print(f"Endpoint registration failed: HTTP {response.status_code}")
        except Exception as e:
            # Backend may not have endpoints route; telemetry loop will auto-enroll
            print(f"Endpoint registration transport failed: {e}")

    def handle_manual_pause(self, paused: bool):
        self.is_suspended = paused
        try:
            action = "pause" if paused else "resume"
            pause_url = self.server_url.replace("/telemetry", f"/endpoints/{self.endpoint_id}/{action}")
            requests.post(pause_url, timeout=2)
        except Exception:
            pass

    def execute_polling_loop(self):
        self.tick_counter += 1
        metrics = self.tracker.get_system_metrics()
        activity = self.tracker.get_and_reset_activity()
        kpm = activity.get("kpm", 0)

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
            "endpoint_id": self.endpoint_id,
            "active_app": active_proc,
            "app_category": "Development",
            "keystroke_count": kpm,
            "activity_state": "Privacy_Suspended" if is_sensitive else "Active",
            "cpu_percent": metrics["cpu_percent"],
            "ram_percent": metrics["ram_percent"],
            "filter_status": status_msg,
            "dlp_flag": is_sensitive,
            "consent_paused": self.is_suspended,
            "capture_requested": capture_requested,
            "file_hash": file_hash,
            "encryption_iv": iv_hex,
            "hostname": self.endpoint_name,
            "os_type": f"{platform.system()} {platform.release()}",
            "user": getpass.getuser(),
            "ip_address": get_local_ip()
        }

        res = self.api.transmit_telemetry(payload)
        if res and res.get("upload_error"):
            print(f"Screenshot upload unavailable: {res['upload_error']}")
        
        # Check if endpoint was de-authorized or kicked by fleet administrator
        if res and res.get("status") == "kicked":
            print(f"[!] Workstation {self.endpoint_name} (ID: {self.endpoint_id}) was kicked by administrator. Shutting down agent.")
            self.terminate()
            return

        if res and res.get("upload_url") and encrypted_media:
            uploaded = self.api.upload_encrypted_media(res["upload_url"], encrypted_media)
            print(f"Encrypted screenshot upload {'completed' if uploaded else 'failed'} (log {res.get('log_id')})")
            if uploaded and res.get("upload_complete_path"):
                verified = self.api.confirm_media_upload(res["upload_complete_path"])
                print(f"S3 database confirmation {'completed' if verified else 'failed'}")

    def terminate(self):
        self.timer.stop()
        self.tracker.stop()
        self.app.quit()

def main():
    qt_app = QApplication(sys.argv)
    qt_app.setQuitOnLastWindowClosed(False)

    modal = ConsentModal()
    if modal.exec() == ConsentModal.DialogCode.Accepted:
        orchestrator = AgentOrchestrator(
            qt_app, 
            server_url=modal.server_url, 
            endpoint_name=modal.endpoint_name
        )
        orchestrator.start()
        sys.exit(qt_app.exec())
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
