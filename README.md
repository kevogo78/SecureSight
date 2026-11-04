# SecureSight: Privacy-Centric Endpoint Observability System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0+-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![AWS](https://img.shields.io/badge/AWS-Free_Tier_Ready-FF9900.svg?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**SecureSight** is an enterprise-grade, cloud-native cybersecurity telemetry and endpoint observability platform engineered for continuous compliance auditing and insider threat detection without compromising end-user privacy. Architected for cost-effective deployment within the **AWS Free Tier**.

---

## 📖 Overview

Traditional endpoint surveillance tools indiscriminately harvest sensitive user data, including passwords, personal communications, and financial records. **SecureSight** re-engineers this paradigm by enforcing **zero-knowledge privacy safeguards directly on the endpoint** prior to any cloud transmission.

### 🌟 Core Capabilities
- **Client-Side Data Loss Prevention (DLP)**: Evaluates active processes and window titles against dynamic regex patterns and blacklists. Automatically suppresses capture and masks typing for banking portals, password managers, and credential inputs.
- **Explicit Consent Framework**: Workstations are never monitored invisibly. Users must authorize monitoring via an interactive consent modal upon launch, and can pause or resume auditing at any time via the system tray.
- **End-to-End Cryptography**: Display buffers are encrypted with **AES-256-GCM** authenticated encryption in endpoint memory before direct upload to Amazon S3 via presigned URLs. Screenshots are decrypted exclusively on-demand for authenticated administrators.
- **Timestamped Keystroke Audit Snapshots**: Keystrokes are automatically snapshotted into timestamped `.txt` files on 1-minute intervals, manual pauses, session ends, and administrative disconnects. Inactive recording windows explicitly log an empty-state message (`[No keystrokes recorded in this period.]`) rather than repeating stale input.
- **Automatic Cloud S3 Mirroring**: Keylog `.txt` audit files stream directly to the fleet server API and are mirrored into Amazon S3 (`keylogs/{endpoint_id}/{filename}`) for immutable compliance archival.
- **Dynamic Heartbeat & Session Uptime Tracking**: The backend accurately measures active session uptime and detects disconnected workstations within 35 seconds, transitioning them into an **Offline** view with complete historical telemetry and hardware device fingerprinting (`MAC` / `Fingerprint`).
- **Real-Time Security Dashboard**: Interactive React SPA featuring real-time activity timelines, system performance telemetry (CPU%, RAM%), interactive Keylog `.txt` audit explorer, encrypted Screenshot gallery with batch deletion, compliance reporting, and administrative controls (kick, pause, friendly rename, and deletion).

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client Endpoints
        AGENT["SecureSight Desktop Agent (PyQt6)"]
        DLP["Local DLP & Privacy Filter"]
        CRYPTO["AES-256-GCM Encryption"]
        AUDIT["Timestamped Snapshot & S3 Sync"]
    end

    subgraph AWS Cloud Deployment (Ubuntu 24.04 LTS)
        NGINX["NGINX Reverse Proxy (:80 / :443)"]
        DASH["SecureSight React Dashboard (Static Web Root)"]
        API["FastAPI Ingestion Engine (:8000)"]
    end

    subgraph Managed Cloud Infrastructure
        RDS[("Amazon RDS PostgreSQL\n(Threaded Connection Pool)")]
        S3[("Amazon S3 Media & Keylog Bucket")]
    end

    AGENT --> DLP
    DLP --> CRYPTO
    DLP --> AUDIT
    CRYPTO -->|Direct Encrypted Screenshot Upload| S3
    AUDIT -->|1-Min & Event Keylog Sync /keylogs/upload| NGINX
    AGENT -->|Telemetry Heartbeat /api/v1/telemetry| NGINX
    
    NGINX -->|/api/*| API
    NGINX -->|/*| DASH
    API -->|Read / Write Telemetry & Privacy Rules| RDS
    API -->|Mirror Keylog Text Files| S3
    API -->|Generate Presigned S3 URLs| S3
    API -->|Authenticated Decryption /media/{id}/image| S3
    DASH -->|REST APIs & Admin Sessions| API
```

---

## 🛠️ Technology Stack

| Layer | Component | Technologies |
| :--- | :--- | :--- |
| **Endpoint Agent** | SecureSight Desktop Application | Python 3.10+, PyQt6, PyAutoGUI, Cryptography, Pynput, Boto3, Requests |
| **Backend API** | Ingestion Engine | FastAPI, Uvicorn, Pydantic, Psycopg2 (ThreadedConnectionPool), Boto3 |
| **Frontend** | SecureSight Dashboard | React 18, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Axios |
| **Database** | Relational Telemetry Store | Amazon RDS PostgreSQL (Tables: `endpoints`, `endpoint_connection_history`, `audit_logs`, `telemetry_logs`, `media_captures`, `privacy_rules`, `users`) |
| **Object Storage**| Encrypted Media & Audit Store | Amazon S3 with AES-256-GCM presigned PUT/GET access and keylog archival |
| **Infrastructure**| Cloud Hosting | AWS EC2 (Ubuntu 24.04 LTS), NGINX Reverse Proxy, Systemd daemons |

---

## 📁 Repository Directory Structure

```
SecureSight/
├── agent/                 # SecureSight Python PyQt6 desktop agent
│   ├── .env.example       # Agent environment configuration template
│   ├── assets/            # SecureSight branding artwork & icons
│   ├── config/            # Privacy rules definitions, blacklist, & endpoint configuration
│   ├── src/               # Core trackers, crypto engine, DLP filter, UI modals, tray manager
│   ├── install_agent_windows.bat # 1-click Windows installer & launcher
│   ├── install_agent_mac.command # 1-click macOS Finder launcher
│   ├── install_agent_mac.sh      # macOS terminal launcher
│   └── tests/             # Unit and integration tests for agent modules
├── backend/               # FastAPI backend ingestion and fleet management API
│   ├── .env.example       # Backend environment configuration template
│   ├── src/
│   │   ├── routes/        # Telemetry, endpoints, keylogs, audit, media, auth, and privacy
│   │   ├── database.py    # ThreadedConnectionPool & transaction rollback protection
│   │   └── utils/         # S3 presigned URL generation and Boto3 client helpers
│   ├── nginx/             # NGINX reverse proxy template
│   └── tests/             # Pytest endpoint, media authorization, and lifecycle tests
├── dashboard/             # SecureSight React single-page administrative dashboard
│   ├── public/branding/   # SecureSight logos & UI brand assets
│   ├── src/
│   │   ├── components/    # Modals, header, sidebar, session players, and viewers
│   │   ├── views/         # FleetOverview, Endpoints, EndpointDetail, Activity, Reports, Settings
│   │   └── services/      # Axios API client, authentication state, and endpoints store
│   └── package.json       # Vite and frontend dependencies
├── database/              # PostgreSQL database initialization scripts
│   ├── schema.sql         # Relational schema (tables, foreign keys, performance indices)
│   └── seed.sql           # Default admin users, cleanup routines, and baseline privacy rules
├── docs/                  # Project documentation (Jekyll & Markdown)
│   ├── index.md           # Documentation home
│   ├── agent-installation.md # Client setup & configuration guide
│   ├── aws-deployment-guide.md # Cloud infrastructure & NGINX reverse proxy deployment
│   ├── threat-model.md    # STRIDE threat assessment
│   └── demos.md           # Verification testing scenarios
└── scripts/               # Automation & deployment shell scripts
    ├── deploy-ec2.sh      # Automated EC2 pull, build, service reload, and restart script
    └── init-rds.sh        # Automated RDS PostgreSQL schema initialization script
```

---

## 🚀 AWS Free Tier Deployment Guide

Follow these step-by-step instructions to deploy SecureSight on your personal AWS account within the AWS Free Tier.

### Step 1: Provision AWS Cloud Resources

1. **Amazon EC2**:
   - Instance Type: `t2.micro` or `t3.micro` (Free Tier eligible).
   - OS: Ubuntu 24.04 LTS (or Ubuntu 22.04 LTS).
   - Security Group Rules:
     - `SSH (22)`: Inbound from your administrative IP.
     - `HTTP (80)`: Inbound from `0.0.0.0/0` (public dashboard access).
     - `HTTPS (443)`: Inbound from `0.0.0.0/0` (optional SSL via Certbot).
     - `Custom TCP (8000)`: Inbound only from `127.0.0.1` (FastAPI local reverse proxy).

2. **Amazon RDS (PostgreSQL)**:
   - Engine: PostgreSQL 15 or 16.
   - Template: Free Tier (`db.t3.micro` or `db.t4g.micro`, 20 GB gp3 storage).
   - Master Username: `postgresadmin` (or your choice).
   - Master Password: `<YOUR_SECURE_RDS_PASSWORD>`.
   - Security Group: Allow inbound port `5432` from the Security Group ID of your EC2 instance.

3. **Amazon S3**:
   - Create a private bucket (e.g., `securesight-media-<YOUR_ACCOUNT_ID>-<REGION>`).
   - Keep "Block all public access" ENABLED.
   - Attach an IAM role to the EC2 instance with `s3:PutObject`, `s3:GetObject`, and `s3:ListBucket` permissions on `arn:aws:s3:::<YOUR_S3_BUCKET_NAME>/*`.

---

### Step 2: Initialize the Amazon RDS Database

Connect to your EC2 instance via SSH:
```bash
ssh -i "<YOUR_KEY_PAIR>.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

Clone the repository and initialize the database schema and default seeds:
```bash
git clone https://github.com/<YOUR_GITHUB_USER>/SecureSight.git
cd SecureSight

# Install PostgreSQL client tools
sudo apt update && sudo apt install -y postgresql-client

# Run the automated database initializer:
DB_HOST=<YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com \
DB_PASS=<YOUR_SECURE_RDS_PASSWORD> \
DB_USER=postgresadmin \
DB_NAME=postgres \
./scripts/init-rds.sh
```

---

### Step 3: Configure and Launch the Backend Service

1. **Create Virtual Environment & Install Dependencies**:
   ```bash
   cd /home/ubuntu/SecureSight/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   deactivate
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Fill in your configuration details:
   ```ini
   DB_HOST=<YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com
   DB_NAME=postgres
   DB_USER=postgresadmin
   DB_PASS=<YOUR_SECURE_RDS_PASSWORD>
   DB_PORT=5432
   DB_SSLMODE=prefer

   S3_BUCKET=<YOUR_S3_BUCKET_NAME>
   AWS_REGION=us-east-1

   DASHBOARD_ADMIN_USER=administrator
   DASHBOARD_ADMIN_PASSWORD=<YOUR_ADMIN_PASSWORD>
   DASHBOARD_SESSION_SECRET=<RANDOM_32_CHAR_STRING>
   DASHBOARD_COOKIE_SECURE=false
   SCREENSHOT_KEY_HEX=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   SECRET_KEY=<RANDOM_32_CHAR_STRING>
   ```

3. **Install Systemd Service (`endpoint-api.service`)**:
   ```bash
   sudo nano /etc/systemd/system/endpoint-api.service
   ```
   Paste the following:
   ```ini
   [Unit]
   Description=SecureSight FastAPI Endpoint Monitoring Daemon
   After=network.target

   [Service]
   User=ubuntu
   Group=ubuntu
   WorkingDirectory=/home/ubuntu/SecureSight/backend
   EnvironmentFile=/home/ubuntu/SecureSight/backend/.env
   ExecStart=/home/ubuntu/SecureSight/backend/venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 2
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable endpoint-api
   sudo systemctl start endpoint-api
   sudo systemctl status endpoint-api --no-pager
   ```

---

### Step 4: Build Dashboard and Configure NGINX

1. **Install Node.js & Build Frontend**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx

   cd /home/ubuntu/SecureSight/dashboard
   npm install
   npm run build

   sudo mkdir -p /usr/share/nginx/html
   sudo rm -rf /usr/share/nginx/html/*
   sudo cp -r dist/* /usr/share/nginx/html/
   ```

2. **Configure NGINX Reverse Proxy**:
   ```bash
   sudo nano /etc/nginx/sites-available/securesight
   ```
   Paste the following configuration:
   ```nginx
   server {
       listen 80 default_server;
       listen [::]:80 default_server;
       server_name _;

       root /usr/share/nginx/html;
       index index.html index.htm;
       charset utf-8;

       location /api/ {
           proxy_pass http://127.0.0.1:8000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /health {
           proxy_pass http://127.0.0.1:8000/health;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }

       location /docs {
           proxy_pass http://127.0.0.1:8000/docs;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }

       location /openapi.json {
           proxy_pass http://127.0.0.1:8000/openapi.json;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
   Enable the site and reload NGINX:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/securesight /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

   *Now open `http://<YOUR_EC2_PUBLIC_IP>` in your browser to view the SecureSight Admin Dashboard!*

---

### Step 5: Install & Connect the Client Agent

On any monitored client workstation (Windows, macOS, or Linux):

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<YOUR_GITHUB_USER>/SecureSight.git
   cd SecureSight/agent
   ```

2. **Configure Connection**:
   Edit `agent/config/config.json`:
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

3. **Launch the Agent**:
   - **Windows**: Double-click `install_agent_windows.bat`
   - **macOS**: Double-click `install_agent_mac.command` (or run `bash install_agent_mac.sh`)
   - **Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     pip install -r requirements.txt
     python run_agent.py
     ```

4. **Consent & Streaming**:
   When the Consent Dialog appears, verify your server URL (`http://<YOUR_EC2_PUBLIC_IP>/api/v1/telemetry`), check the authorization box, and click **"Start Monitoring"**. The endpoint immediately appears live in your Admin Dashboard!

---

## 💻 Local Development Setup

To run all components locally on your workstation for testing:

#### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate       # On Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```
*Interactive Swagger documentation: `http://127.0.0.1:8000/docs`*

#### Dashboard (React + Vite)
```bash
cd dashboard
npm install
npm run dev
```
*Local dashboard: `http://localhost:5173/`*

#### Client Agent (Python PyQt6)
```bash
cd agent
python -m venv venv
source venv/bin/activate       # On Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_agent.py
```

---

## 🧪 Testing & Quality Assurance

Run client agent tests:
```bash
pytest agent/tests -v
```

Run backend API tests:
```bash
pytest backend/tests -v
```

Test production frontend build:
```bash
cd dashboard
npm run build
```

---

## 📚 Documentation Links

- [Documentation Index](docs/index.md)
- [Client Agent Installation & Setup Guide](docs/agent-installation.md)
- [AWS Cloud Deployment & Infrastructure Guide](docs/aws-deployment-guide.md)
- [Threat Model & Privacy Safeguards](docs/threat-model.md)
- [Verification Demos & Testing Scenarios](docs/demos.md)

---

## 📄 License
This project is open-source and distributed under the [MIT License](LICENSE).
