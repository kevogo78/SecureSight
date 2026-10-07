# EDMT Client Desktop Agent

The **EDMT Client Agent** is an autonomous desktop background application built with **Python 3.10+** and **PyQt6**. It performs local performance telemetry collection, active window tracking, client-side Data Loss Prevention (DLP) redaction, and hardware-accelerated **AES-256-GCM** screen encryption before transmitting data to the cloud backend.

---

## 🏛️ Agent Architecture & Modules

```
agent/
├── README_INSTALLATION.txt # Quick installation notes for enterprise workstations
├── config/
│   ├── blacklist.json      # Process executable and window title keyword blacklists
│   ├── config.example.json # Template configuration file
│   └── config.json         # Active workstation configuration
├── src/
│   ├── core/
│   │   ├── activity_tracker.py # Active window title, process name, and KPM counter
│   │   ├── crypto_engine.py    # AES-256-GCM authenticated encryption engine
│   │   ├── privacy_filter.py   # Regex DLP engine (SSN, Credit Cards, Credentials)
│   │   └── screen_capture.py   # Display buffer grabber and memory redactor
│   ├── transport/
│   │   └── api_client.py       # HTTP client for FastAPI & direct S3 uploads
│   ├── ui/
│   │   ├── consent_modal.py    # Interactive user consent dialog
│   │   └── system_tray.py      # System tray icon and pause/resume/exit controls
│   └── main.py                 # Application entry point and orchestrator
└── tests/
    └── test_privacy.py         # Unit tests for DLP redaction and crypto engines
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

### 2. Client-Side Cryptographic Screen Encryption
When a screen capture is triggered (every 6th cycle / ~60 seconds):
1. The display buffer is captured in memory.
2. The buffer is encrypted using **AES-256-GCM** with a random 96-bit initialization vector (IV) and a 128-bit authentication tag.
3. The encrypted binary payload (`.enc`) is streamed directly to Amazon S3 via a presigned PUT URL.
4. **No unencrypted image ever leaves workstation RAM or traverses the network.**

---

## ⚙️ Configuration Setup

Edit `agent/config/config.json`:

```json
{
  "server_url": "http://<YOUR_EC2_PUBLIC_IP>/api/v1/telemetry",
  "crypto_key_hex": "<YOUR_64_CHAR_HEX_AES_256_KEY>",
  "interval_ms": 10000,
  "enable_keystrokes": true,
  "capture_keys_to_file": false
}
```

---

## 🚀 Running the Agent

### Step 1: Virtual Environment
```bash
cd agent
python -m venv venv
source venv/bin/activate       # Linux/macOS
# .\venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
```

### Step 2: Launch Orchestrator
```bash
python -m src.main
```

1. **Consent Dialog**: The user reviews the monitoring terms and target server URL, then clicks **"I Consent & Authorize"**.
2. **Background Mode**: The agent registers with `/api/v1/endpoints/register` and minimizes to the system tray.
3. **Autonomy Controls**: The user can pause or resume monitoring anytime via the tray menu.
4. **Clean Exit**: Selecting **"Exit Agent"** notifies the backend to mark the workstation **Offline** immediately.

---

## 🧪 Testing Agent Privacy Modules

Run unit tests for the DLP regex engine and cryptographic modules:

```bash
python -m pytest tests/
```

