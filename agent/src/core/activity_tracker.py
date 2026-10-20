import os
import re
import platform
import socket
import getpass
import psutil
import threading
import time
import uuid
import hashlib
from typing import Dict, Any, Optional, Callable

# Win32 bindings for foreground window detection (Task 5)
try:
    import win32gui
    import win32process
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Pynput bindings for live keystroke monitoring
try:
    from pynput import keyboard
    HAS_PYNPUT = True
except (ImportError, Exception):
    class _MockKeyboard:
        class Listener:
            def __init__(self, *args, **kwargs):
                self.daemon = False
            def start(self):
                pass
            def stop(self):
                pass
    keyboard = _MockKeyboard()
    HAS_PYNPUT = False

# Import Privacy Filter (Task 6)
try:
    from src.core.privacy_filter import PrivacyFilter
except ImportError:
    from privacy_filter import PrivacyFilter

# AWS S3 Boto3 bindings for keystroke audit log synchronization
try:
    import boto3
    from botocore.config import Config
    HAS_BOTO3 = True
except (ImportError, Exception):
    HAS_BOTO3 = False


class ActivityTracker:
    @staticmethod
    def _resolve_audit_file_path(file_path: str) -> str:
        """Resolves local keystroke audit file path reliably across repo root and agent working directory."""
        if not file_path:
            file_path = "agent/keystroke_audit.txt"
        if os.path.isabs(file_path):
            return file_path

        cwd = os.getcwd()
        # If running from inside agent directory and path starts with 'agent/', strip it
        if (os.path.basename(cwd) == "agent" or os.path.exists(os.path.join(cwd, "src", "core"))) and (file_path.startswith("agent/") or file_path.startswith("agent\\")):
            file_path = file_path[6:]

        # If file exists in current working directory directly
        if os.path.exists(file_path):
            return os.path.abspath(file_path)

        # Check if cwd has an 'agent' subfolder and path doesn't already specify it
        if os.path.exists(os.path.join(cwd, "agent")) and not (file_path.startswith("agent/") or file_path.startswith("agent\\")):
            return os.path.abspath(os.path.join(cwd, "agent", file_path))

        return os.path.abspath(file_path)

    def __init__(
        self, 
        poll_interval: float = 2.0, 
        enable_keystrokes: bool = True,
        on_sensitive_activity: Optional[Callable[[str], None]] = None,
        keystroke_log_file: str = "agent/keystroke_audit.txt",
        s3_bucket_name: Optional[str] = None
    ):
        self.privacy_filter = PrivacyFilter()
        self.poll_interval = poll_interval
        self.on_sensitive_activity = on_sensitive_activity
        
        # Threading lifecycle management
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        # Activity metrics counters (KPM / keystrokes / mouse activity)
        self.keystroke_count = 0
        self.mouse_click_count = 0
        self.enable_keystrokes = enable_keystrokes
        self.keystroke_log_file = self._resolve_audit_file_path(keystroke_log_file)
        self._keyboard_listener = None
        self.keystroke_buffer = []  # In-memory recent keys for DLP pattern detection
        self._write_buffer = []     # In-memory buffer for local text file writing
        self.s3_bucket_name = s3_bucket_name or os.getenv("S3_BUCKET_NAME", os.getenv("S3_BUCKET"))
        self._s3_client = None
        
        # Dynamic DLP state
        self.last_sensitive_time: float = 0.0
        self.last_sensitive_reason: str = "Clean"
        self._last_window_check_time: float = 0.0
        self._cached_window_sensitive: bool = False
        self._cached_window_reason: str = "Clean"
        
        # In-memory snapshot cache
        self.current_snapshot: Dict[str, Any] = {}

    def _trigger_sensitive_event(self, reason: str):
        """Notifies listeners and updates last sensitive detection timestamp."""
        self.last_sensitive_time = time.time()
        self.last_sensitive_reason = reason
        if self.on_sensitive_activity:
            try:
                self.on_sensitive_activity(reason)
            except Exception:
                pass

    def is_sensitive_active(self, cooldown: float = 30.0) -> tuple[bool, str]:
        """Returns True if sensitive activity was detected within the cooldown window."""
        now = time.time()
        if (now - self.last_sensitive_time) < cooldown:
            return True, self.last_sensitive_reason
        return False, "Clean"

    def _check_current_window_sensitivity(self) -> tuple[bool, str]:
        """Throttled active window sensitivity lookup for keyboard listener."""
        now = time.time()
        if (now - self._last_window_check_time) > 0.5:
            self._last_window_check_time = now
            try:
                win_info = self.get_active_window()
                app = win_info.get("app_name", "")
                title = win_info.get("window_title_raw", "")
                is_sens, reason = self.privacy_filter.evaluate_environment(app, title)
                self._cached_window_sensitive = is_sens
                self._cached_window_reason = reason
            except Exception:
                pass
        return self._cached_window_sensitive, self._cached_window_reason

    def _on_key_press(self, key):
        """Callback for keyboard event monitoring with real-time DLP redaction."""
        if not self.enable_keystrokes:
            return
        self.record_keystroke()
        try:
            if hasattr(key, 'char') and key.char:
                char = key.char
            elif hasattr(key, 'name'):
                if key.name == 'enter':
                    char = "\n"
                elif key.name == 'space':
                    char = " "
                elif key.name == 'tab':
                    char = "\t"
                elif key.name == 'backspace':
                    char = "[backspace]"
                else:
                    char = f"[{key.name}]"
            else:
                char = f"[{str(key)}]"

            # 1. Proactive Environment DLP check (Banking apps, password managers, login prompts)
            is_env_sensitive, env_reason = self._check_current_window_sensitivity()
            if is_env_sensitive:
                self._trigger_sensitive_event(env_reason)
                # Suppress writing raw keystrokes in sensitive contexts
                char_to_write = "*" if char not in ("\n", "\t") else char
                self._append_to_audit_log(char_to_write)
                return

            # 2. Reactive Stream DLP check (SSN, credit card, or password assignment in text buffer)
            is_stream_sensitive = False
            stream_reason = "Clean"
            with self._lock:
                self.keystroke_buffer.append(char)
                if len(self.keystroke_buffer) > 200:
                    self.keystroke_buffer.pop(0)

                # Reconstruct recent plain text sequence for regex scanning
                recent_chars = []
                for item in self.keystroke_buffer[-50:]:
                    if item.startswith("[") and item.endswith("]"):
                        if item == "[backspace]" and recent_chars:
                            recent_chars.pop()
                        continue
                    recent_chars.append(item)
                recent_text = "".join(recent_chars)

                is_stream_sensitive, stream_reason, _ = self.privacy_filter.scan_stream(recent_text)
                if is_stream_sensitive:
                    self._trigger_sensitive_event(stream_reason)

            # Redact before writing to log file if sensitive pattern matched
            char_to_write = char
            if is_stream_sensitive and char not in ("\n", " ", "\t") and not (char.startswith("[") and char.endswith("]")):
                char_to_write = "*"

            self._append_to_audit_log(char_to_write)
        except Exception:
            pass

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

    @staticmethod
    def get_mac_address() -> str:
        """Derives primary hardware MAC address for persistent workstation identification."""
        try:
            node = uuid.getnode()
            return ':'.join(f'{(node >> i) & 0xff:02x}' for i in range(40, -1, -8))
        except Exception:
            return "02:00:00:00:00:01"

    def get_device_fingerprint(self) -> str:
        """Computes deterministic hardware fingerprint combining OS, hostname, and MAC."""
        try:
            raw = f"{socket.gethostname()}|{platform.machine()}|{platform.system()}|{self.get_mac_address()}"
            return "fp_" + hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]
        except Exception:
            return f"fp_{socket.gethostname()}"

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
            "disk_percent": disk.percent,
            "mac_address": self.get_mac_address(),
            "device_fingerprint": self.get_device_fingerprint()
        }

    @staticmethod
    def extract_website_url(app_name: str, window_title: str) -> Optional[str]:
        """
        Extracts active website domain or URL visited during the session.
        Matches browser processes, explicit URLs, domain suffixes, and known web services.
        """
        if not window_title or window_title in ("Unknown", "Desktop", "Active Application (Platform Fallback)"):
            return None

        clean_app = (app_name or "").lower()
        is_browser = any(b in clean_app for b in (
            "chrome", "msedge", "edge", "firefox", "brave", "safari", "opera", "vivaldi", "browser"
        ))

        # 1. Direct explicit HTTP/HTTPS URL in title
        url_match = re.search(r'https?://([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?)', window_title, re.IGNORECASE)
        if url_match:
            return url_match.group(1).rstrip('/')

        # 2. Domain pattern in title (e.g. "portal.ggc.edu", "github.com/project", "aws.amazon.com/console")
        domain_match = re.search(
            r'\b((?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|edu|gov|co|ai|dev|app|cloud|tech|info|me|us|uk|ca|de|fr|jp|au)(?:/[a-zA-Z0-9_.~!*\'();:@&=+$,/?%#-]*)?)\b',
            window_title,
            re.IGNORECASE
        )
        if domain_match:
            return domain_match.group(1).rstrip('/')

        # 3. Known web platform brand resolution when active process is a browser
        if is_browser:
            title_lower = window_title.lower()
            known_platforms = [
                ("github", "github.com"),
                ("stack overflow", "stackoverflow.com"),
                ("stackoverflow", "stackoverflow.com"),
                ("aws", "aws.amazon.com"),
                ("amazon web services", "aws.amazon.com"),
                ("google search", "google.com"),
                ("google", "google.com"),
                ("youtube", "youtube.com"),
                ("reddit", "reddit.com"),
                ("linkedin", "linkedin.com"),
                ("twitter", "x.com"),
                ("jira", "atlassian.net"),
                ("confluence", "atlassian.net"),
                ("salesforce", "salesforce.com"),
                ("chatgpt", "chatgpt.com"),
                ("claude", "claude.ai"),
                ("gemini", "gemini.google.com"),
                ("wikipedia", "wikipedia.org"),
                ("microsoft teams", "teams.microsoft.com"),
                ("outlook", "outlook.office.com"),
                ("gmail", "mail.google.com"),
                ("facebook", "facebook.com"),
                ("instagram", "instagram.com"),
                ("notion", "notion.so"),
                ("slack", "slack.com"),
                ("figma", "figma.com"),
                ("canva", "canva.com"),
                ("gitlab", "gitlab.com"),
                ("bitbucket", "bitbucket.org")
            ]
            for kw, domain in known_platforms:
                if kw in title_lower:
                    return domain

            # 4. Strip browser trailing tags (e.g. " - Google Chrome", " — Mozilla Firefox")
            stripped = re.sub(
                r'\s*[-—|]\s*(Google Chrome|Microsoft Edge|Mozilla Firefox|Brave|Opera|Safari)\s*$',
                '',
                window_title,
                flags=re.IGNORECASE
            ).strip()
            if stripped and stripped != window_title:
                tokens = stripped.split()
                if tokens and '.' in tokens[0] and len(tokens[0]) > 4:
                    return tokens[0].lower().rstrip('/')

        return None

    def get_active_window(self) -> Dict[str, Any]:
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
        website_url = self.extract_website_url(app_name, raw_title)

        return {
            "app_name": app_name,
            "window_title_raw": raw_title,
            "window_title_sanitized": sanitized_title,
            "website_url": website_url
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
            "website_url": active_app_data.get("website_url"),
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
        """Starts background tracking thread and keyboard listener."""
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self._thread.start()
            print("[ACTIVITY TRACKER] Background monitor loop started.")

            # Start pynput keyboard listener if available
            if HAS_PYNPUT and self.enable_keystrokes and not self._keyboard_listener:
                try:
                    self._keyboard_listener = keyboard.Listener(on_press=self._on_key_press)
                    self._keyboard_listener.daemon = True
                    self._keyboard_listener.start()
                    print("[ACTIVITY TRACKER] Live keyboard listener started.")
                except Exception as e:
                    print(f"[ACTIVITY TRACKER] Keyboard listener notice: {e}")

    def _append_to_audit_log(self, char_to_write: str):
        """Buffers character and writes to the local temporary audit file while keystrokes are active."""
        if not self.enable_keystrokes or not self.keystroke_log_file:
            return
        with self._lock:
            self._write_buffer.append(char_to_write)
            try:
                parent_dir = os.path.dirname(os.path.abspath(self.keystroke_log_file))
                if parent_dir and not os.path.exists(parent_dir):
                    os.makedirs(parent_dir, exist_ok=True)
                with open(self.keystroke_log_file, "a", encoding="utf-8") as f:
                    f.write(char_to_write)
                    f.flush()
            except Exception:
                pass

    def flush_buffer(self) -> bool:
        """
        Performs a final flush of any buffered keystroke data to the local temporary text file.
        """
        with self._lock:
            if not self.keystroke_log_file:
                return True
            try:
                parent_dir = os.path.dirname(os.path.abspath(self.keystroke_log_file))
                if parent_dir and not os.path.exists(parent_dir):
                    os.makedirs(parent_dir, exist_ok=True)
                if self._write_buffer:
                    with open(self.keystroke_log_file, "a", encoding="utf-8") as f:
                        f.write("".join(self._write_buffer))
                        f.flush()
                    self._write_buffer.clear()
                print(f"[ACTIVITY TRACKER] Flushed buffer to '{self.keystroke_log_file}'.")
                return True
            except Exception as e:
                print(f"[ACTIVITY TRACKER FLUSH ERROR] Could not flush buffer to file: {e}")
                return False

    def _get_s3_client(self):
        """
        Initializes boto3 S3 client using environment variables
        (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) without hardcoding credentials.
        """
        if self._s3_client:
            return self._s3_client
        if not HAS_BOTO3:
            try:
                import boto3
                from botocore.config import Config
            except ImportError:
                print("[ACTIVITY TRACKER S3 ERROR] boto3 is not installed.")
                return None
        else:
            import boto3
            from botocore.config import Config

        region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

        config = Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=5,
            retries={"max_attempts": 3}
        )

        client_kwargs = {
            "region_name": region,
            "config": config
        }
        if access_key and secret_key:
            client_kwargs["aws_access_key_id"] = access_key
            client_kwargs["aws_secret_access_key"] = secret_key

        try:
            self._s3_client = boto3.client("s3", **client_kwargs)
            return self._s3_client
        except Exception as e:
            print(f"[ACTIVITY TRACKER S3 ERROR] Failed to initialize S3 client: {e}")
            return None

    def sync_to_s3(
        self, 
        bucket_name: Optional[str] = None, 
        s3_key: Optional[str] = None,
        s3_client = None
    ) -> bool:
        """
        Uploads the local keystroke audit text file to Amazon S3.
        Properly references AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME
        environment variables without hardcoding credentials.
        """
        if not self.keystroke_log_file or not os.path.exists(self.keystroke_log_file):
            print(f"[ACTIVITY TRACKER S3] Audit file '{self.keystroke_log_file}' not found. Skipping S3 upload.")
            return False

        bucket = bucket_name or self.s3_bucket_name or os.getenv("S3_BUCKET_NAME") or os.getenv("S3_BUCKET")
        if not bucket:
            print("[ACTIVITY TRACKER S3 WARNING] S3_BUCKET_NAME environment variable not configured. Skipping S3 upload.")
            return False

        client = s3_client or self._get_s3_client()
        if not client:
            print("[ACTIVITY TRACKER S3 ERROR] Could not obtain S3 client for upload.")
            return False

        if not s3_key:
            filename = os.path.basename(self.keystroke_log_file)
            s3_key = f"keystroke_audit/{filename}"

        try:
            print(f"[ACTIVITY TRACKER S3] Uploading '{self.keystroke_log_file}' to s3://{bucket}/{s3_key}...")
            client.upload_file(self.keystroke_log_file, bucket, s3_key)
            print(f"[ACTIVITY TRACKER S3] Successfully uploaded '{self.keystroke_log_file}' to s3://{bucket}/{s3_key}.")
            return True
        except Exception as e:
            print(f"[ACTIVITY TRACKER S3 ERROR] S3 upload failed: {e}")
            return False

    def set_keystrokes_enabled(self, enabled: bool) -> bool:
        """
        Toggles keystroke capture on or off.
        When toggled off:
          1. Performs a final flush of the buffer to the local text file.
          2. Executes the S3 upload one last time.
          3. Safely shuts down the keyboard listener thread.
        """
        with self._lock:
            prev_state = self.enable_keystrokes
            self.enable_keystrokes = enabled

        if prev_state and not enabled:
            print("[ACTIVITY TRACKER] Keystroke logging toggled OFF.")
            # 1. Final flush of the buffer
            self.flush_buffer()
            # 2. Execute S3 upload one last time
            upload_success = self.sync_to_s3()
            # 3. Safely shut down the keyboard listener thread
            if self._keyboard_listener:
                try:
                    self._keyboard_listener.stop()
                except Exception:
                    pass
                self._keyboard_listener = None
                print("[ACTIVITY TRACKER] Keyboard listener safely shut down.")
            return upload_success
        elif not prev_state and enabled:
            print("[ACTIVITY TRACKER] Keystroke logging toggled ON.")
            if HAS_PYNPUT and not self._keyboard_listener:
                try:
                    self._keyboard_listener = keyboard.Listener(on_press=self._on_key_press)
                    self._keyboard_listener.daemon = True
                    self._keyboard_listener.start()
                    print("[ACTIVITY TRACKER] Keyboard listener safely restarted.")
                except Exception as e:
                    print(f"[ACTIVITY TRACKER] Failed to restart keyboard listener: {e}")
            return True
        return True

    def toggle_keystrokes(self, enabled: Optional[bool] = None) -> bool:
        """Convenience method to toggle keystroke logging state."""
        new_state = (not self.enable_keystrokes) if enabled is None else enabled
        return self.set_keystrokes_enabled(new_state)

    def stop(self):
        """Stops background tracking thread and keyboard listener cleanly."""
        self._running = False
        
        # When stopping, if keystrokes were enabled, toggle off to trigger final flush, S3 sync, and listener shutdown
        if self.enable_keystrokes:
            self.set_keystrokes_enabled(False)
        else:
            self.flush_buffer()
            if self._keyboard_listener:
                try:
                    self._keyboard_listener.stop()
                except Exception:
                    pass
                self._keyboard_listener = None

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
            print("[ACTIVITY TRACKER] Background monitor loop stopped.")