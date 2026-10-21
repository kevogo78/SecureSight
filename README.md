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
ITEC4810_Capstone/
├── agent/                 # SecureSight Python PyQt6 desktop agent
│   ├── assets/            # SecureSight branding artwork & icons
│   ├── config/            # Privacy rules definitions, blacklist, & endpoint configuration
│   ├── src/               # Core trackers, crypto engine, DLP filter, UI modals, tray manager
│   └── tests/             # Unit and integration tests for agent modules (36 passing tests)
├── backend/               # FastAPI backend ingestion and fleet management API
│   ├── src/
│   │   ├── routes/        # Telemetry, endpoints, keylogs, audit, media, auth, and privacy
│   │   ├── database.py    # ThreadedConnectionPool & transaction rollback protection
│   │   └── utils/         # S3 presigned URL generation and Boto3 client helpers
│   └── tests/             # Pytest endpoint, media authorization, and lifecycle tests (34 tests)
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

## 🚀 Quick Start Guide

### 1. Local Development Setup

#### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate       # On Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```
*API docs available at: `http://127.0.0.1:8000/docs`*

#### Dashboard (React + Vite)
```bash
cd dashboard
npm install
npm run dev
```
*Dashboard available at: `http://localhost:5173/`*

#### SecureSight Client Agent (Python PyQt6)
```bash
cd agent
python -m venv venv
source venv/bin/activate       # On Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m src.main
```

---

### 2. AWS Cloud Deployment

For detailed production instructions on deploying to **AWS EC2**, **Amazon RDS**, and **Amazon S3**, refer to the [**AWS Deployment Guide**](docs/aws-deployment-guide.md).

Quick update on the live Ubuntu EC2 instance:
```bash
cd /home/ubuntu/ITEC4810_Capstone
./scripts/deploy-ec2.sh
```

---

## 🧪 Testing & Quality Assurance

Run client agent tests with pytest:
```bash
pytest agent/tests
```

Run backend API tests with pytest:
```bash
pytest backend/tests
```

Build the frontend dashboard for production:
```bash
cd dashboard
npm run build
```

---

## 📚 Documentation Links

- [Documentation Index](docs/index.md)
- [Client Agent Installation Guide](docs/agent-installation.md)
- [AWS Cloud Deployment Guide](docs/aws-deployment-guide.md)
- [Threat Model & Privacy Safeguards](docs/threat-model.md)
- [Testing & Verification Demos](docs/demos.md)

---

## 📄 License
This project is developed as part of the GGC ITEC 4810 Information Technology Capstone and is distributed under the MIT License.
