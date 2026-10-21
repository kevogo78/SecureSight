import sys
import os
import time
import socket
import zlib
import platform
import getpass
import requests
import threading

# Automatically load environment variables (.env in agent/ or project root)
try:
    from dotenv import load_dotenv
    _agent_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv()
    load_dotenv(os.path.join(_agent_root, ".env"))
    load_dotenv(os.path.join(_agent_root, "..", ".env"))
except ImportError:
    pass
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
        
        self.privacy = PrivacyFilter()
        self.sensitive_cooldown_until = 0.0
        self.last_sensitive_reason = "Clean"
        self.session_start = time.time()
        self.last_minute_file_save = time.time()
        self.tracker = ActivityTracker(
            enable_keystrokes=True,
            on_sensitive_activity=self.on_sensitive_input_detected,
            endpoint_id=self.endpoint_id,
            endpoint_name=self.endpoint_name
        )
        self.crypto = CryptoEngine(CONFIG["crypto_key_hex"])
        self.api = TelemetryAPIClient(self.server_url)
        self.tray = SystemTrayManager(self.app)
        
        self.is_suspended = False
        self.tick_counter = 0

        self.tray.stop_requested.connect(self.terminate)
        self.tray.pause_requested.connect(self.handle_manual_pause)

        self.timer = QTimer()
        self.timer.timeout.connect(self.execute_polling_loop)

    def on_sensitive_input_detected(self, reason: str):
        """Dynamic DLP callback: activates 30-second screenshot suppression."""
        self.sensitive_cooldown_until = time.time() + 30.0
        self.last_sensitive_reason = reason
        print(f"[DLP INTERLOCK] Sensitive input detected ({reason}). Dynamic screenshot capture suppressed.")

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
                "ip_address": get_local_ip(),
                "mac_address": self.tracker.get_mac_address(),
                "device_fingerprint": self.tracker.get_device_fingerprint()
            }
            response = requests.post(reg_url, json=payload, timeout=15)
            if response.status_code != 200:
                print(f"Endpoint registration failed: HTTP {response.status_code}")
        except Exception as e:
            # Backend may not have endpoints route; telemetry loop will auto-enroll
            print(f"Endpoint registration transport failed: {e}")

    def _upload_keylog_file(self, file_path: str):
        """Uploads saved audit .txt log file to backend."""
        if not file_path or not os.path.exists(file_path):
            return
        try:
            upload_url = self.server_url.replace("/telemetry", f"/endpoints/{self.endpoint_id}/keylogs/upload")
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            fname = os.path.basename(file_path)
            payload = {"filename": fname, "content": content}
            resp = requests.post(upload_url, json=payload, timeout=3)
            if resp.status_code == 200:
                print(f"[ACTIVITY TRACKER] Successfully synced keylog '{fname}' to backend server.")
        except Exception:
            pass

    def handle_manual_pause(self, paused: bool):
        self.is_suspended = paused
        if paused:
            # 1. Stop keyboard listener immediately on first line - eliminates lag completely
            self.tracker.set_keystrokes_enabled(False)
            
            # 2. Snapshot file creation & upload run in background daemon thread
            def _async_pause_save():
                saved_file = self.tracker.save_snapshot_to_file(reason="pause")
                if saved_file:
                    self._upload_keylog_file(saved_file)
            threading.Thread(target=_async_pause_save, daemon=True).start()
        else:
            self.tracker.start_new_session()
            self.tracker.set_keystrokes_enabled(True)

        def _async_notify():
            try:
                action = "pause" if paused else "resume"
                pause_url = self.server_url.replace("/telemetry", f"/endpoints/{self.endpoint_id}/{action}")
                requests.post(pause_url, timeout=3)
            except Exception:
                pass
        threading.Thread(target=_async_notify, daemon=True).start()

    def execute_polling_loop(self):
        self.tick_counter += 1
        now = time.time()
        if (now - self.last_minute_file_save) >= 60:
            self.last_minute_file_save = now
            if not self.is_suspended and self.tracker.enable_keystrokes:
                def _async_min_save():
                    saved_file = self.tracker.save_snapshot_to_file(reason="1-min")
                    if saved_file:
                        self._upload_keylog_file(saved_file)
                threading.Thread(target=_async_min_save, daemon=True).start()
        metrics = self.tracker.get_system_metrics()
        activity = self.tracker.get_and_reset_activity()
        kpm = activity.get("kpm", 0)

        # Dynamically query active process, window title, and active website URL
        window_info = self.tracker.get_active_window()
        active_proc = window_info.get("app_name") or "Code.exe"
        active_title = window_info.get("window_title_sanitized") or window_info.get("window_title_raw") or "Active Window"
        website_url = window_info.get("website_url")

        # 1. Environment DLP check (window title and process)
        is_sensitive, status_msg = self.privacy.evaluate_environment(active_proc, active_title)
        
        # 2. Reactive stream DLP check (active typing in tracker)
        is_stream_sensitive, stream_reason = self.tracker.is_sensitive_active(cooldown=30.0)
        if is_stream_sensitive and not is_sensitive:
            is_sensitive = True
            status_msg = f"DLP_Active_Input_Masking ({stream_reason})"

        # 3. Dynamic cooldown check
        if time.time() < self.sensitive_cooldown_until and not is_sensitive:
            is_sensitive = True
            status_msg = f"DLP_Sensitive_Cooldown ({self.last_sensitive_reason})"

        if self.is_suspended:
            status_msg = "User_Suspended"
            is_sensitive = True

        # Dynamic Screenshot Guard: strictly abort captures while sensitive info is detected
        capture_requested = (self.tick_counter % 6 == 0) and not is_sensitive
        file_hash = None
        iv_hex = None
        encrypted_media = None

        if capture_requested:
            raw_screen = ScreenCaptureEngine.capture_and_redact()
            encrypted_media, iv_hex, file_hash = self.crypto.encrypt_bytes(raw_screen)

        uptime_seconds = int(time.time() - self.session_start)
        payload = {
            "endpoint_id": self.endpoint_id,
            "uptime_seconds": uptime_seconds,
            "active_app": active_proc,
            "app_category": "Browsing" if website_url else "Development",
            "website_url": website_url,
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
            "ip_address": get_local_ip(),
            "mac_address": metrics.get("mac_address") or self.tracker.get_mac_address(),
            "device_fingerprint": metrics.get("device_fingerprint") or self.tracker.get_device_fingerprint()
        }

        res = self.api.transmit_telemetry(payload)
        if res and res.get("upload_error"):
            print(f"Screenshot upload unavailable: {res['upload_error']}")
        
        # Check if endpoint was de-authorized or kicked by fleet administrator
        if res and res.get("status") == "kicked":
            print(f"[!] Workstation {self.endpoint_name} (ID: {self.endpoint_id}) was kicked by administrator. Shutting down agent.")
            saved_file = self.tracker.save_snapshot_to_file(reason="kicked")
            if saved_file:
                self._upload_keylog_file(saved_file)
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
        self.tracker.set_keystrokes_enabled(False)
        saved_file = self.tracker.save_snapshot_to_file(reason="end-session")
        if saved_file:
            self._upload_keylog_file(saved_file)
        self.tracker.stop()
        try:
            disconnect_url = self.server_url.replace("/telemetry", f"/endpoints/{self.endpoint_id}/disconnect")
            requests.post(disconnect_url, timeout=2)
        except Exception:
            pass
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
