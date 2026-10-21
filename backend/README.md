# SecureSight Backend API Service

The **SecureSight Backend** is a high-throughput, asynchronous ingestion and fleet management API built with **FastAPI**, **Uvicorn**, and **Psycopg2**. It handles client telemetry ingestion, enforces workstation consent states, interfaces with **Amazon RDS PostgreSQL** through a threaded connection pool, and manages presigned upload/download URLs and encrypted media decryption for **Amazon S3**.

---

## 🏛️ Architecture & Module Organization

```
backend/
├── pytest.ini             # Pytest testing configuration
├── requirements.txt       # Python package dependencies
├── src/
│   ├── config.py          # Environment settings (DB, AWS credentials, S3, Session Secrets)
│   ├── database.py        # ThreadedConnectionPool & transaction rollback protection
│   ├── main.py            # FastAPI application factory, CORS, and modular routers
│   ├── models/
│   │   └── schemas.py     # Pydantic data schemas for requests and responses
│   ├── routes/
│   │   ├── audit.py       # GET /api/v1/audit/logs - Historical compliance audit queries
│   │   ├── auth.py        # POST /api/v1/auth/login & logout - Admin HMAC session cookies
│   │   ├── endpoints.py   # Fleet registration, heartbeat, keylogs, rename, kick, & cascade deletion
│   │   ├── media.py       # Authenticated AES-256-GCM screenshot decryption & batch deletion
│   │   ├── presigned.py   # Presigned Amazon S3 media URL utilities
│   │   ├── privacy.py     # Dynamic DB-backed DLP rules engine & evaluation sandbox
│   │   └── telemetry.py   # POST /api/v1/telemetry - High-speed ingestion & uptime tracker
│   └── utils/
│       └── s3_helper.py   # Boto3 client for generating presigned PUT/GET URLs
└── tests/
    ├── test_api.py        # Telemetry ingestion, validation rules, and endpoint lifecycle
    ├── test_aws_compatibility.py # AWS RDS transactions and S3 integration tests
    ├── test_deletion.py   # Keylog deletion, endpoint purge, and S3 cleanup
    ├── test_media_viewing.py     # Admin auth, session cookies, and image decryption
    └── test_s3_signing.py # Signature v4 presigned URL verification
```

---

## 📡 API Endpoint Reference

### 1. Telemetry Ingestion (`/api/v1/telemetry`)
- **`POST /api/v1/telemetry`**: Ingests real-time workstation performance metrics and application logs.
  - Returns `{"status": "kicked"}` if workstation was de-authorized by an administrator.
  - Updates in-memory active endpoints, computes session uptime, and commits records to PostgreSQL (`audit_logs` and `endpoints`).
  - If a screenshot capture is requested, generates an Amazon S3 presigned PUT URL for direct encrypted upload.

### 2. Fleet Endpoint Management (`/api/v1/endpoints`)
- **`GET /api/v1/endpoints`**: Returns all consented endpoints with live heartbeat status (`Online`, `Paused`, `Offline`), relative last seen timestamps, session uptime, and hardware identifiers (`mac_address`, `device_fingerprint`).
- **`POST /api/v1/endpoints/register`**: Registers a newly authorized workstation upon user consent.
- **`POST /api/v1/endpoints/{id}/kick`**: De-authorizes and kicks a workstation from active monitoring.
- **`POST /api/v1/endpoints/{id}/pause`**: Pauses consent monitoring for an endpoint.
- **`POST /api/v1/endpoints/{id}/resume`**: Resumes consent monitoring for an endpoint.
- **`POST /api/v1/endpoints/{id}/disconnect`**: Marks a workstation as immediately disconnected / offline upon agent exit.
- **`POST /api/v1/endpoints/{id}/rename`**: Updates workstation friendly display name in database and active memory.
- **`DELETE /api/v1/endpoints/{id}`**: Completely removes an endpoint and cascades deletion through audit logs, telemetry, connection history, and local keylogs.

### 3. Keystroke Audit Files (`/api/v1/endpoints/{id}/keylogs`)
- **`GET /api/v1/endpoints/{id}/keylogs`**: Lists all local and Amazon S3 mirrored `.txt` audit files for an endpoint.
- **`GET /api/v1/endpoints/{id}/keylogs/{filename}`**: Streams the raw text content of a selected audit `.txt` file for compliance review.
- **`POST /api/v1/endpoints/{id}/keylogs/upload`**: Ingests agent interval/event `.txt` snapshot files and mirrors them to Amazon S3.
- **`DELETE /api/v1/endpoints/{id}/keylogs/{filename}`**: Deletes an audit file from local server storage and Amazon S3.
- **`POST /api/v1/endpoints/{id}/keylogs/batch-delete`**: Deletes multiple audit log files in a single atomic operation.

### 4. Administrator Authentication & Screenshot Viewing (`/api/v1/auth` & `/api/v1/media`)
- **`POST /api/v1/auth/login`**: Authenticates administrator and sets secure HTTP-only signed cookie `edmt_admin_session`.
- **`POST /api/v1/auth/logout`**: Invalidates administrator session cookie.
- **`GET /api/v1/media/{capture_id}/image`**: Retrieves encrypted screenshot from Amazon S3 and performs server-side **AES-256-GCM** decryption for authorized administrators.
- **`DELETE /api/v1/media/{capture_id}`**: Deletes evidence screenshot from Amazon S3 and database.
- **`POST /api/v1/media/batch-delete`**: Batch deletes multiple media captures.

### 5. Dynamic Privacy Rules Engine (`/api/v1/privacy`)
- **`GET /api/v1/privacy/rules`**: Returns all builtin and custom DLP privacy rules.
- **`POST /api/v1/privacy/rules`**: Adds a new custom DLP masking rule (regex, process, title, domain).
- **`DELETE /api/v1/privacy/rules/{rule_id}`**: Deletes a custom DLP rule.
- **`POST /api/v1/privacy/evaluate`**: Runs dynamic privacy simulation against input text, process names, or window titles.

### 6. Health & Diagnostics (`/health`)
- **`GET /health`**: Evaluates service operational state and database connectivity.

---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the `backend/` directory:

```ini
# PostgreSQL Database Settings
DB_HOST=<YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com
DB_NAME=postgres
DB_USER=postgresadmin
DB_PASS=<YOUR_SECURE_RDS_PASSWORD>
DB_PORT=5432

# AWS S3 Settings
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
S3_BUCKET=<YOUR_S3_BUCKET_NAME>

# Administrator Session Auth & Media Decryption
DASHBOARD_ADMIN_USER=administrator
DASHBOARD_ADMIN_PASSWORD=<YOUR_ADMIN_PASSWORD>
DASHBOARD_SESSION_SECRET=<YOUR_RANDOM_SECRET_AT_LEAST_32_CHARS>
DASHBOARD_COOKIE_SECURE=false
SCREENSHOT_KEY_HEX=<YOUR_64_HEX_CHAR_AES_256_KEY>

# Application Security
SECRET_KEY=<YOUR_RANDOM_SESSION_SECRET_KEY>
```

---

## 🚀 Running Locally

```bash
cd backend
python -m venv venv

# Activate Virtual Environment
source venv/bin/activate       # Linux/macOS
# .\venv\Scripts\Activate.ps1   # Windows PowerShell

pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive Swagger documentation is automatically available at:
`http://localhost:8000/docs`

---

## 🧪 Running Automated Tests

Run the backend test suite using `pytest`:

```bash
pytest backend/tests -v
```
*(All 34 tests pass across ingestion, deletion cascading, auth session verification, media viewing, and S3 signing).*
