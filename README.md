# Privacy-Centric Endpoint Observability System (EDMT)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0+-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![AWS](https://img.shields.io/badge/AWS-Free_Tier_Ready-FF9900.svg?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade, cloud-native cybersecurity telemetry and endpoint observability platform engineered for continuous compliance auditing and threat detection without compromising end-user privacy. Architected for cost-effective deployment within the **AWS Free Tier**.

---

## 📖 Overview

Traditional endpoint surveillance tools indiscriminately harvest sensitive user data, including passwords, personal communications, and financial records. The **Privacy-Centric Endpoint Observability System (EDMT)** re-engineers this paradigm by enforcing **zero-knowledge privacy safeguards directly on the endpoint** prior to any cloud transmission.

### 🌟 Core Capabilities
- **Client-Side Data Loss Prevention (DLP)**: Evaluates active processes and window titles against regex patterns and blacklists. Automatically suppresses capture for banking portals, password managers, and credential inputs.
- **Explicit Consent Framework**: Workstations are never monitored invisibly. Users must authorize monitoring via an interactive consent modal upon launch, and can pause/resume auditing at any time via the system tray.
- **End-to-End Cryptography**: Display buffers are encrypted with **AES-256-GCM** authenticated encryption in endpoint memory before direct upload to Amazon S3 via presigned URLs.
- **Dynamic Heartbeat & Offline History**: The backend detects disconnected or terminated workstations within 35 seconds, transitioning them into an **Offline / Suspended History** view with full connection audit trails.
- **Real-Time Security Dashboard**: Interactive React SPA featuring real-time activity timelines, system performance telemetry (CPU%, RAM%), compliance reporting, and administrative endpoint controls.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client Endpoints
        AGENT[Python PyQt6 Desktop Agent]
        DLP[Local DLP & Redaction Engine]
        CRYPTO[AES-256-GCM Encryption]
    end

    subgraph AWS Cloud Deployment (Ubuntu 24.04 LTS)
        NGINX[NGINX Reverse Proxy :80]
        DASH[React SPA Static Web Root]
        API[FastAPI Ingestion Engine :8000]
    end

    subgraph Managed Cloud Infrastructure
        RDS[(Amazon RDS PostgreSQL)]
        S3[(Amazon S3 Encrypted Media Bucket)]
    end

    AGENT --> DLP
    DLP --> CRYPTO
    CRYPTO -->|Telemetry Heartbeat /api/v1/telemetry| NGINX
    CRYPTO -->|Direct Encrypted Upload| S3
    
    NGINX -->|/api/*| API
    NGINX -->|/*| DASH
    API -->|Read / Write Logs & Metrics| RDS
    API -->|Generate Presigned S3 URLs| S3
    DASH -->|REST APIs| API
```

---

## 🛠️ Technology Stack

| Layer | Component | Technologies |
| :--- | :--- | :--- |
| **Endpoint Agent** | Desktop Application | Python 3.10+, PyQt6, PyAutoGUI, Cryptography, Pynput, Requests |
| **Backend API** | Ingestion Engine | FastAPI, Uvicorn, Pydantic, Psycopg2, Boto3 |
| **Frontend** | Security Operations Dashboard | React 18, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Axios |
| **Database** | Relational Telemetry Store | Amazon RDS PostgreSQL (Tables: `endpoints`, `audit_logs`, `telemetry_logs`, `media_captures`, `users`) |
| **Object Storage**| Encrypted Media Store | Amazon S3 with AES-256-GCM presigned PUT/GET access |
| **Infrastructure**| Cloud Hosting | AWS EC2 (Ubuntu 24.04 LTS), NGINX Reverse Proxy, Systemd daemons |

---

## 📁 Repository Directory Structure

```
ITEC4810_Capstone/
├── agent/                 # Python PyQt6 client surveillance agent
│   ├── config/            # Blacklist definitions & endpoint configuration
│   ├── src/               # Core trackers, crypto engine, UI modals, tray manager
│   └── tests/             # Unit and integration tests for agent modules
├── backend/               # FastAPI backend ingestion and management API
│   ├── src/               # API routes, models, DB connectors, S3 helpers
│   └── tests/             # Pytest endpoint validation tests
├── dashboard/             # React single-page administrative dashboard
│   ├── src/               # Components, views, Tailwind styles, and API services
│   └── package.json       # Vite and frontend dependencies
├── database/              # PostgreSQL database initialization scripts
│   ├── schema.sql         # Relational schema (tables, foreign keys, indices)
│   └── seed.sql           # Default admin users and cleanup routines
├── docs/                  # Project documentation (Jekyll & Markdown)
│   ├── index.md           # Documentation home
│   ├── agent-installation.md # Client setup guide
│   ├── aws-deployment-guide.md # Cloud infrastructure deployment
│   ├── threat-model.md    # STRIDE threat assessment
│   └── demos.md           # Verification testing scenarios
└── scripts/               # Automation & deployment shell scripts
    ├── deploy-ec2.sh      # Automated EC2 pull, build, and restart script
    └── init-rds.sh        # RDS PostgreSQL schema initialization script
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

#### Client Agent (Python PyQt6)
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

Run backend API tests with pytest:
```bash
python -m pytest backend/tests
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
