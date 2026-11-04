# SecureSight Client Desktop Agent

The **SecureSight Client Agent** is an autonomous desktop background application built with **Python 3.10+** and **PyQt6**. It performs local performance telemetry collection, active window tracking, client-side Data Loss Prevention (DLP) redaction, structured keystroke snapshot generation, and hardware-accelerated **AES-256-GCM** screen encryption before transmitting data to the cloud backend.

---

## 🏛️ Agent Architecture & Modules

```
agent/
├── README.md               # Architecture, module, and usage documentation
├── README_INSTALLATION.txt # Quick installation notes for enterprise workstations
├── .env.example            # Environment configuration template
├── assets/                 # SecureSight official branding logos & iconography
│   ├── README.md           # Branding usage and PyInstaller asset bundling guide
│   └── securesight-logo.png # High-resolution SecureSight shield logo
├── config/
│   ├── blacklist.json      # Process and window title blacklist
│   ├── privacy_rules.json  # Dynamic DLP rules definitions (regex, domain, process, title)
│   ├── config.example.json # Template configuration file
│   └── config.json         # Workstation configuration (server_url, keys, s3_bucket)
├── src/
│   ├── core/
│   │   ├── activity_tracker.py # Active window, KPM counter, timestamped audit snapshots
│   │   ├── crypto_engine.py    # AES-256-GCM authenticated encryption engine
│   │   ├── privacy_filter.py   # Regex DLP engine (SSN, Credit Cards, Credentials, Portals)
│   │   └── screen_capture.py   # Display buffer grabber and memory redactor
│   ├── transport/
│   │   └── api_client.py       # Telemetry transmitter, presigned S3 uploader, & keylog sync
│   ├── ui/
│   │   ├── branding.py         # SecureSight runtime icon generator & UI branding helper
│   │   ├── consent_modal.py    # Interactive user consent and authorization dialog
│   │   └── system_tray.py      # System tray icon with pause/resume and clean shutdown
│   └── main.py                 # Application orchestrator, lifecycle, and polling loops
└── tests/
    ├── test_activity_tracker.py # Buffer flushing, snapshot naming, S3 sync, listener controls
    ├── test_crypto.py           # AES-256-GCM encryption & decryption validation
    ├── test_decrypt_capture.py  # Integrity hash verification & media recovery
    ├── test_privacy_filter.py   # Builtin rules & stream regex evaluation
    └── test_s3_upload.py        # Presigned URL header & S3 response parsing
```

---

## 🔒 Privacy & DLP Engineering

### 1. Zero-Knowledge Redaction Engine
The agent evaluates the foreground application and active window title prior to every telemetry cycle:
- **Process Blacklist**: Applications like password managers (`1password.exe`, `bitwarden.exe`, `keepass.exe`) instantly suppress capture.
- **Title Blacklist**: Windows containing keywords like `"banking"`, `"chase"`, or `"credential"` trigger an immediate privacy suspension state.
- **Pattern Matching (Regex DLP)**:
  - Credit Card pattern matching (Luhn algorithm compliance).
  - Social Security Number (SSN) pattern detection (`\d{3}-\d{2}-\d{4}`).
  - Password field detection.

### 2. Keystroke Audit Snapshots & S3 Synchronization
The agent generates timestamped audit text files (`<endpoint_name>_<YYYYMMDD_HHMMSS>_<trigger>.txt`):
- **Triggers**:
  - `1-min`: Periodic snapshot created every 60 seconds while monitoring is active.
  - `pause`: Created immediately when the user pauses monitoring via the tray menu.
  - `end-session`: Created cleanly when the user terminates the agent.
  - `kicked`: Created when the fleet administrator de-authorizes the workstation.
- **Interval Buffer Management**:
  - Each snapshot writes only the keystrokes captured during that specific interval.
  - If no typing occurred, an explicit notice is written (`[No keystrokes recorded in this period.]`) to prevent stale repetitive logging.
- **Server Sync & Cloud Archival**:
  - As soon as a snapshot file is written locally to `agent/keylogs/<endpoint_id>/`, the orchestrator streams it via HTTP `POST /api/v1/endpoints/{endpoint_id}/keylogs/upload` to the fleet backend.
  - The fleet backend saves the log and automatically mirrors it into the Amazon S3 compliance bucket (`keylogs/{endpoint_id}/{filename}`).

### 3. Client-Side Cryptographic Screen Encryption
When a screen capture is triggered (every 6th cycle / ~60 seconds):
1. The display buffer is captured in memory.
2. The buffer is encrypted using **AES-256-GCM** with a random 96-bit initialization vector (IV) and a 128-bit authentication tag.
3. The encrypted binary payload (`.enc`) is streamed directly to Amazon S3 via a presigned PUT URL.
4. **No unencrypted image ever leaves workstation RAM or traverses the network.**

---

## ⚙️ Configuration Setup

### Option A: JSON Configuration (`agent/config/config.json`)
Copy the template if needed (`cp config.example.json config.json`) and configure:

```json
{
  "endpoint_id": 1,
  "server_url": "http://<YOUR_EC2_PUBLIC_IP>/api/v1/telemetry",
  "polling_interval_seconds": 10,
  "screenshot_frequency_ticks": 6,
  "crypto_key_hex": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "interval_ms": 10000,
  "enable_keystrokes": true,
  "capture_keys_to_file": true,
  "s3_bucket_name": "<YOUR_S3_BUCKET_NAME>"
}
```

### Option B: Environment Variables (`.env`)
You can optionally create an `.env` file in `agent/` from `.env.example`:

```ini
EDMT_SERVER_URL=http://<YOUR_EC2_PUBLIC_IP>/api/v1/telemetry
EDMT_CRYPTO_KEY_HEX=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
S3_BUCKET_NAME=<YOUR_S3_BUCKET_NAME>
AWS_REGION=us-east-1
```

---

## 🚀 Running the Agent

### 1-Click Launchers (Recommended)
- **Windows**: Double-click `install_agent_windows.bat`
- **macOS**: Double-click `install_agent_mac.command` (or run `bash install_agent_mac.sh`)

### Manual Terminal Setup

#### Step 1: Create and Activate Virtual Environment
```bash
cd agent

# On Linux/macOS:
python3 -m venv venv
source venv/bin/activate

# On Windows (PowerShell):
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

#### Step 3: Launch Agent
```bash
python run_agent.py
```

1. **Consent Dialog**: The SecureSight consent dialog displays the workstation hostname and target server URL. Verify your EC2 URL, check the authorization box, and click **"Start Monitoring"**.
2. **Background Mode**: The agent registers with `/api/v1/endpoints/register` and minimizes to the system tray with the SecureSight shield icon.
3. **Autonomy Controls**: The user can pause or resume monitoring anytime via the tray menu.
4. **Clean Exit**: Selecting **"Exit Agent"** flushes a final snapshot and notifies the backend to mark the workstation **Offline** immediately.

---

## 🧪 Testing Agent Privacy Modules

Run unit tests for the DLP regex engine, cryptographic modules, and activity tracker:

```bash
pytest agent/tests -v
```
*(All tests pass across activity tracking, crypto, decryption validation, privacy filtering, and S3 uploading).*
