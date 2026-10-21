# SecureSight Client Agent Installation & Setup Guide

The **SecureSight Client Agent** is a lightweight, cross-platform Python application designed to collect privacy-filtered endpoint telemetry, track active window states, enforce client-side Data Loss Prevention (DLP), encrypt periodic screen captures using **AES-256-GCM**, and generate structured keystroke audit snapshot `.txt` files with S3 mirroring before transmission to the cloud backend.

---

## 💻 System Requirements

| Specification | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS 12+ (Monterey+), Ubuntu 22.04+ LTS | Windows 11 Enterprise / macOS Sonoma |
| **Python Version** | Python 3.10 or higher | Python 3.11 or 3.12 |
| **RAM** | 250 MB free memory | 500 MB free memory |
| **Disk Space** | 150 MB for agent and dependencies | 300 MB |
| **Network** | Outbound HTTP/HTTPS access to AWS EC2 instance | Continuous broadband connection |

---

## 📦 Prerequisites & Environment Setup

### 1. Install Python
Ensure Python 3.10+ is installed and accessible in your system path:
```bash
python --version
# Output should be Python 3.10.x or higher
```

### 2. Set Up a Virtual Environment
It is best practice to install agent dependencies within an isolated virtual environment:

**On Windows (PowerShell):**
```powershell
cd C:\path\to\ITEC4810_Capstone\agent
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On macOS / Linux (Bash):**
```bash
cd /path/to/ITEC4810_Capstone/agent
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Install all required libraries specified in `requirements.txt`:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

Key dependencies installed include:
- `PyQt6`: Cross-platform GUI framework for the interactive consent modal and system tray manager.
- `psutil`: Real-time system performance metrics (CPU%, RAM%, Disk, Network I/O).
- `pyautogui` & `Pillow`: Display buffer capture and coordinate processing.
- `cryptography`: Cryptographic primitives for AES-256-GCM authenticated encryption.
- `requests`: HTTP client for telemetry ingestion and S3 presigned binary streaming.
- `pynput`: Low-level keyboard event hooks for aggregate keystroke activity auditing.
- `boto3`: AWS SDK for direct S3 keystroke snapshot and encrypted capture synchronization.

---

## ⚙️ Configuration

The agent reads configuration parameters from `agent/config/config.json`. A sample configuration template is provided at `agent/config/config.example.json`:

```json
{
  "server_url": "http://<YOUR_EC2_PUBLIC_IP_OR_DOMAIN>/api/v1/telemetry",
  "crypto_key_hex": "<YOUR_64_CHAR_HEX_AES_256_KEY>",
  "interval_ms": 10000,
  "enable_keystrokes": true,
  "capture_keys_to_file": true,
  "s3_bucket_name": "<YOUR_S3_BUCKET_NAME>"
}
```

### Configuration Fields Explained

| Key | Description | Default / Example |
| :--- | :--- | :--- |
| `server_url` | Full URL to the FastAPI telemetry ingestion endpoint on your AWS EC2 instance. | `http://<YOUR_EC2_IP>/api/v1/telemetry` |
| `crypto_key_hex` | 256-bit hexadecimal string (64 characters) used for AES-GCM media encryption. Must match the master key in the Admin Dashboard. | `0123456789abcdef...` |
| `interval_ms` | Telemetry transmission frequency in milliseconds. | `10000` (10 seconds) |
| `enable_keystrokes`| Enables aggregate keystrokes-per-minute (KPM) activity tracking. | `true` |
| `capture_keys_to_file`| When enabled, generates periodic keystroke snapshot `.txt` files in `agent/logs/`. | `true` |
| `s3_bucket_name`| Target Amazon S3 bucket name for direct keystroke snapshot upload and screenshot mirroring. If omitted, S3 uploads are gracefully skipped with diagnostic logging. | `"securesight-captures-bucket"` |

> [!NOTE]
> Environment variable overrides: You can override settings at runtime using `EDMT_SERVER_URL` or `SECURESIGHT_SERVER_URL` and `S3_BUCKET_NAME`.

---

## 📝 Keystroke Audit Snapshots (`.txt`)

When `capture_keys_to_file` is enabled, the agent's Activity Tracker automatically generates timestamped `.txt` snapshot files stored in `agent/logs/` and mirrored to Amazon S3 under `keylogs/{endpoint_id}/`:

### Snapshot Triggers
1. **Periodic Active Snapshot**: Generated every 60 seconds while typing activity is observed (`<hostname>_<timestamp>.txt`).
2. **Pause Snapshot**: Automatically triggered when monitoring consent is paused from the system tray (`<hostname>_<timestamp>_pause.txt`).
3. **Session Termination**: Generated when the user stops monitoring or exits the agent (`<hostname>_<timestamp>_end_session.txt`).
4. **Admin Kick Snapshot**: Generated if the workstation receives a kick signal from the dashboard (`<hostname>_<timestamp>_kicked.txt`).

### Zero-Redundancy & Empty-State Handling
- **Interval Buffer Reset**: The keystroke buffer resets immediately after each snapshot write. Each `.txt` file contains solely the keys typed during that specific observation interval, preventing duplicate lines across consecutive logs.
- **Empty-State Diagnostics**: If zero typing occurs during an observation cycle or before a pause/kick event, the snapshot includes an explicit diagnostic banner:
  ```
  [No keystrokes recorded in this period.]
  ```
- **Local Sanitization**: All passwords, credit cards, and sensitive tokens are redacted in local workstation memory before the `.txt` snapshot is saved or uploaded.

---

## 🚀 Running the Agent

Launch the agent directly via Python:

```bash
python -m src.main
```
*(Or on Windows: `python src/main.py`)*

### 1. Interactive Consent Modal Flow
Upon launch, the agent presents the **SecureSight Consent Authorization Modal**:
- The dialog displays the official SecureSight shield branding and informs the user of active auditing, metrics collected, and local DLP protections.
- Users can review the target server URL and computer name.
- **Grant Consent**: Clicking **"I Consent & Authorize"** registers the workstation with the fleet backend and activates background monitoring.
- **Decline Consent**: Clicking **"Decline / Exit"** immediately shuts down the agent without transmitting any system data.

```
+-------------------------------------------------------------+
|              SECURESIGHT MONITORING CONSENT NOTICE          |
+-------------------------------------------------------------+
| This workstation is subject to cybersecurity auditing and    |
| performance telemetry monitoring.                           |
|                                                             |
| All telemetry is sanitized locally via DLP prior to upload. |
| Passwords, credit cards, and sensitive windows are redacted.|
|                                                             |
| Server URL:    [ http://<YOUR_EC2_IP>/api/v1/telemetry    ] |
| Workstation:   [ WORKSTATION-USER01                      ] |
|                                                             |
|   [ Decline / Exit ]             [ I Consent & Authorize ]  |
+-------------------------------------------------------------+
```

### 2. System Tray Controls & User Autonomy
Once running, the agent minimizes to the operating system's system tray notification area with the SecureSight shield icon:
- **Status Indicator**: Hovering or right-clicking the tray icon displays current monitoring status (`SecureSight - Monitoring Active`, `SecureSight - Monitoring Paused`).
- **Pause Consent**: Selecting **"Pause Monitoring Consent"** temporarily suspends foreground telemetry, flags the status as `User_Suspended`, flushes a `_pause.txt` keystroke snapshot, and halts screenshot capture.
- **Resume Consent**: Selecting **"Resume Monitoring Consent"** restores active auditing and restarts the session interval timer.
- **Exit & Disconnect**: Selecting **"Exit Agent"** performs a clean shutdown, flushes an `_end_session.txt` snapshot, and immediately notifies the backend via `/api/v1/endpoints/{id}/disconnect`, transitioning the workstation to **Offline / Standby** status in the Admin Dashboard.

---

## 🔒 Privacy Blacklist & DLP Rule Enforcement

The agent evaluates active process names and window titles against local rules defined in `agent/config/blacklist.json`:

```json
{
  "blacklisted_processes": [
    "keepass.exe",
    "1password.exe",
    "bitwarden.exe",
    "banking_portal.exe"
  ],
  "blacklisted_window_titles": [
    "chase online banking",
    "bank of america",
    "wellsfargo",
    "password manager",
    "credential"
  ]
}
```

- When a blacklisted process or window title is detected:
  1. Keystroke collection is instantly suspended (`keystrokes = 0`).
  2. Telemetry state is marked `Privacy_Suspended`.
  3. Screen capture is suppressed (`capture_requested = False`).
  4. The audit log filter status is recorded as `Title_Blacklisted` or `Process_Blacklisted`.

---

## 🧪 Running Agent Tests

The agent codebase includes 36 comprehensive unit tests validating tracking, cryptographic operations, DLP rules, and keystroke snapshot generation:

```bash
pytest agent/tests -v
```

---

## 📦 Packaging as an Executable (PyInstaller)

To deploy the agent on end-user machines without requiring manual Python installation, package the agent using PyInstaller with the bundled assets:

**On Windows:**
```bash
pip install pyinstaller

pyinstaller --noconfirm --onedir --windowed \
  --name "SecureSightAgent" \
  --add-data "config;config" \
  --add-data "assets;assets" \
  --add-data "src/ui;src/ui" \
  src/main.py
```

**On macOS / Linux:**
```bash
pyinstaller --noconfirm --onedir --windowed \
  --name "SecureSightAgent" \
  --add-data "config:config" \
  --add-data "assets:assets" \
  --add-data "src/ui:src/ui" \
  src/main.py
```

The resulting binary will be output to `agent/dist/SecureSightAgent/` and can be distributed to enterprise endpoints.
