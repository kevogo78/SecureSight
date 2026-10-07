# EDMT Backend API Service

The **EDMT Backend** is a high-throughput, asynchronous ingestion and fleet management API built with **FastAPI**, **Uvicorn**, and **Psycopg2**. It handles client telemetry ingestion, enforces workstation consent states, interfaces with **Amazon RDS PostgreSQL**, and manages presigned upload/download URLs for **Amazon S3**.

---

## 🏛️ Architecture & Module Organization

```
backend/
├── pytest.ini             # Pytest testing configuration
├── requirements.txt       # Python package dependencies
├── src/
│   ├── config.py          # Environment settings (DB, AWS credentials, S3)
│   ├── database.py        # PostgreSQL connection helper & connection pooling
│   ├── main.py            # FastAPI application factory, CORS, and routers
│   ├── models/
│   │   └── schemas.py     # Pydantic data schemas for requests and responses
│   ├── routes/
│   │   ├── audit.py       # GET /api/v1/audit/logs - Historical audit queries
│   │   ├── endpoints.py   # GET & POST /api/v1/endpoints - Fleet registration & management
│   │   ├── presigned.py   # Presigned S3 media URL utilities
│   │   └── telemetry.py   # POST /api/v1/telemetry - High-speed ingestion
│   └── utils/
│       └── s3_helper.py   # Boto3 client for generating presigned PUT/GET URLs
└── tests/
    └── test_api.py        # Pytest test suite for telemetry validation & endpoint lifecycle
```

---

## 📡 API Endpoint Reference

### 1. Telemetry Ingestion (`/api/v1/telemetry`)
- **`POST /api/v1/telemetry`**: Ingests real-time workstation performance metrics and application logs.
  - If the endpoint has been kicked by an administrator, returns `{"status": "kicked"}`.
  - Updates in-memory active endpoints state and commits records to PostgreSQL (`audit_logs` and `endpoints`).
  - If a screenshot capture is requested, generates an Amazon S3 presigned PUT URL for direct encrypted upload.

### 2. Fleet Endpoint Management (`/api/v1/endpoints`)
- **`GET /api/v1/endpoints`**: Returns all consented endpoints with live heartbeat status (`Online`, `Paused`, `Offline`), relative last seen timestamps (`Just now`, `30s ago`), and performance telemetry.
- **`POST /api/v1/endpoints/register`**: Registers a newly authorized workstation upon user consent.
- **`POST /api/v1/endpoints/{id}/kick`**: De-authorizes and kicks a workstation from active monitoring.
- **`POST /api/v1/endpoints/{id}/pause`**: Pauses consent monitoring for an endpoint.
- **`POST /api/v1/endpoints/{id}/resume`**: Resumes consent monitoring for an endpoint.
- **`POST /api/v1/endpoints/{id}/disconnect`**: Marks a workstation as immediately disconnected / offline upon agent exit.

### 3. Audit & Compliance Stream (`/api/v1/audit`)
- **`GET /api/v1/audit/logs?limit=50`**: Fetches recent audit logs joined with S3 presigned download URLs for encrypted screenshot media.

### 4. Health Check (`/health`)
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
S3_BUCKET_NAME=<YOUR_S3_BUCKET_NAME>

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

Run the test suite using `pytest`:

```bash
python -m pytest tests
```
*Validates schema enforcement, endpoint kicking, telemetry ingestion, and heartbeat transitions.*

