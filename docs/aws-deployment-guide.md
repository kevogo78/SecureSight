# AWS Cloud Deployment & Infrastructure Guide

This guide details the complete end-to-end cloud provisioning and deployment procedure for the **SecureSight Endpoint Observability Platform** on Amazon Web Services (AWS), optimized to operate reliably within the **AWS Free Tier**.

---

## ☁️ Cloud Infrastructure Topology

```
+-----------------------------------------------------------------------------------+
|                               AWS CLOUD (us-east-1)                                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | AWS EC2 Instance (Ubuntu 24.04 LTS / t2.micro or t3.micro)                 |  |
|  |                                                                             |  |
|  |   [ Port 80 / 443 ]                                                         |  |
|  |          │                                                                  |  |
|  |          ▼                                                                  |  |
|  |   ┌───────────────┐  /api/v1/*   ┌─────────────────────────────────────┐    |  |
|  |   │     NGINX     │ ───────────► │ FastAPI Ingestion Engine (Port 8000)│    |  |
|  |   │ Reverse Proxy │              │ Systemd: endpoint-api.service       │    |  |
|  |   │ charset utf-8 │              │ - Auth & Session Cookies            │    |  |
|  |   └───────┬───────┘              │ - Server-Side Image Decryption      │    |  |
|  |           │                      │ - Dynamic Privacy Rules Sandbox     │    |  |
|  |           │                      │ - ThreadedConnectionPool            │    |  |
|  |           ▼ /* (Static SPA)      └──────────────────┬──────────────────┘    |  |
|  |   ┌───────────────────────────────┐                 │                       |  |
|  |   │ SecureSight Dashboard (/dist) │                 │                       |  |
|  |   └───────────────────────────────┘                 │                       |  |
|  +-----------------------------------------------------┼-----------------------+  |
|                                                        │                          |
|                     ┌──────────────────────────────────┴─────────────┐            |
|                     ▼                                                ▼            |
|       +───────────────────────────+                    +───────────────────────+  |
|       | Amazon RDS PostgreSQL     |                    | Amazon S3 Bucket      |  |
|       | db.t3.micro / db.t4g.micro|                    | Encrypted Media Store |  |
|       | 7 Relational Tables       |                    | screenshots/*.enc     |  |
|       | Cascading Deletion Rules  |                    | keylogs/*.txt         |  |
|       +───────────────────────────+                    +───────────────────────+  |
+-----------------------------------------------------------------------------------+
```

---

## 🔑 Infrastructure Prerequisites

Before deploying, ensure you have provisioned:
1. **AWS EC2 Instance**: Ubuntu 22.04 or 24.04 LTS (`t2.micro` or `t3.micro` Free Tier eligible).
2. **Security Group Rules**:
   - `SSH (22)`: Inbound from your administrative IP.
   - `HTTP (80)`: Inbound from `0.0.0.0/0` (public access).
   - `HTTPS (443)`: Inbound from `0.0.0.0/0` (public access with SSL).
   - `Custom TCP (8000)`: Restricted to local loopback `127.0.0.1` or internal VPC.
3. **Amazon RDS PostgreSQL Instance**: Single-AZ `db.t3.micro` or `db.t4g.micro` with public accessibility configured or accessible within the EC2 VPC Security Group on port `5432`.
4. **Amazon S3 Bucket**: Created in your target region (e.g., `us-east-1`) with private ACL and server-side encryption enabled.
5. **IAM Credentials**: An IAM user or EC2 IAM role with `s3:PutObject`, `s3:GetObject`, and `s3:ListBucket` permissions.

---

## 🖥️ 1. Connecting to the EC2 Instance

Connect to your Ubuntu server using your SSH key pair:

```bash
# Set secure permissions on your private key (Linux/macOS)
chmod 400 <YOUR_KEY_PAIR>.pem

# Connect to EC2
ssh -i "<YOUR_KEY_PAIR>.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

Update system packages and install required runtimes:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip postgresql-client nginx git curl
```

Install Node.js 20+ for React dashboard builds:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Verify v20.x or higher
npm -v
```

---

## 🗄️ 2. Amazon RDS PostgreSQL Database Provisioning

### Database Connection Verification
Test connectivity to your Amazon RDS PostgreSQL instance:

```bash
psql -h <YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com \
     -U postgresadmin \
     -d postgres
```

### Relational Schema Definition
Apply the relational schema from `database/schema.sql`:

```bash
cd /home/ubuntu/ITEC4810_Capstone
psql -h <YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com \
     -U postgresadmin \
     -d postgres \
     -f database/schema.sql
```

The database structure consists of 7 relational tables:

| Table Name | Description |
| :--- | :--- |
| `users` | Administrator, Auditor, and Operator credentials with PBKDF2/SHA-256 password hashing. |
| `endpoints` | Monitored workstations, computer hostnames, custom names, MAC address, hardware fingerprint, and active status. |
| `endpoint_connection_history` | Audit trail of workstation connections, sessions, IP associations, and timestamps. |
| `telemetry_logs` | High-frequency time-series system metrics (CPU%, RAM%, Disk%, Network I/O, Uptime). |
| `audit_logs` | Real-time compliance events, active foreground window titles, keystroke counts, privacy states, and DLP flags. |
| `media_captures` | Encrypted capture metadata references, S3 object keys, file hashes, and AES-256-GCM initialization vectors. |
| `privacy_rules` | Database-backed dynamic regex rules for real-time redaction, mask replacement, and categorization. |

### Applying Seed Users & Baseline Rules
Run `database/seed.sql` to initialize default administrative credentials and baseline DLP rules:

```bash
psql -h <YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com \
     -U postgresadmin \
     -d postgres \
     -f database/seed.sql
```

---

## ⚙️ 3. Backend FastAPI Ingestion Engine Setup

### Clone Repository & Create Virtual Environment
```bash
cd /home/ubuntu
git clone https://github.com/<YOUR_GITHUB_USER>/ITEC4810_Capstone.git
cd /home/ubuntu/ITEC4810_Capstone/backend

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

### Environment Variables Configuration
Create the production environment configuration file at `/home/ubuntu/ITEC4810_Capstone/backend/.env`:

```ini
# Database Connection Settings
DB_HOST=<YOUR_RDS_ENDPOINT>.us-east-1.rds.amazonaws.com
DB_NAME=postgres
DB_USER=postgresadmin
DB_PASS=<YOUR_SECURE_RDS_PASSWORD>
DB_PORT=5432

# AWS S3 Object Storage Settings
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
S3_BUCKET=<YOUR_S3_BUCKET_NAME>

# Dashboard Administrator Authentication & Decryption
DASHBOARD_ADMIN_USER=administrator
DASHBOARD_ADMIN_PASSWORD=<YOUR_ADMIN_PASSWORD>
DASHBOARD_SESSION_SECRET=<YOUR_RANDOM_SECRET_AT_LEAST_32_CHARS>
DASHBOARD_COOKIE_SECURE=false
SCREENSHOT_KEY_HEX=<YOUR_64_HEX_CHAR_AES_256_ENCRYPTION_KEY>

# Application Security
SECRET_KEY=<YOUR_RANDOM_SESSION_SECRET_KEY>
```

> [!TIP]
> If your EC2 instance uses an SSL certificate (HTTPS), set `DASHBOARD_COOKIE_SECURE=true` so that admin session cookies enforce the `Secure` flag.

### Configure Systemd Service (`endpoint-api.service`)
Create the systemd daemon file to ensure FastAPI runs continuously in the background and restarts automatically:

```bash
sudo nano /etc/systemd/system/endpoint-api.service
```

Paste the following service definition:

```ini
[Unit]
Description=SecureSight FastAPI Endpoint Monitoring Daemon
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/ITEC4810_Capstone/backend
EnvironmentFile=/home/ubuntu/ITEC4810_Capstone/backend/.env
ExecStart=/home/ubuntu/ITEC4810_Capstone/backend/venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 2
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

## 🌐 4. NGINX Reverse Proxy & Frontend SPA Deployment

### Build the SecureSight React Dashboard
Compile the optimized production bundle with Vite and Tailwind CSS v4:

```bash
cd /home/ubuntu/ITEC4810_Capstone/dashboard
npm install
npm run build
```

Copy the generated static assets to the NGINX web root:
```bash
sudo mkdir -p /usr/share/nginx/html
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
```

### Configure NGINX Server Block
Create the site configuration file:

```bash
sudo nano /etc/nginx/sites-available/endpoint-monitor
```

Paste the following NGINX configuration (with explicit `charset utf-8;` directive to ensure Unicode glyphs and status badges render cleanly without encoding artifacts):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Explicit UTF-8 character encoding
    charset utf-8;

    # Bypass unnecessary requests from SPA router
    location = /favicon.ico { 
        log_not_found off; 
        access_log off; 
        try_files $uri =204; 
    }
    location = /robots.txt  { 
        log_not_found off; 
        access_log off; 
        try_files $uri =204; 
    }

    # Reverse proxy for FastAPI Ingestion Engine
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

    # Reverse proxy for Backend Health Check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Reverse proxy for Swagger / OpenAPI Documentation
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the configuration and reload NGINX:
```bash
sudo ln -sf /etc/nginx/sites-available/endpoint-monitor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔄 5. Automated CI/CD Deploy Script (`scripts/deploy-ec2.sh`)

Whenever updates are pushed to the GitHub repository, execute the automated deployment script on your EC2 instance:

```bash
cd /home/ubuntu/ITEC4810_Capstone
chmod +x scripts/deploy-ec2.sh
./scripts/deploy-ec2.sh
```

The script automatically executes:
1. `git pull origin main` to pull latest changes.
2. Updates backend dependencies in the virtual environment.
3. Installs frontend packages and executes `npm run build`.
4. Deploys static build artifacts to `/usr/share/nginx/html/`.
5. Restarts `endpoint-api` and `nginx` services cleanly.

---

## 🔒 6. Security Hardening Recommendations

1. **Enable TLS/SSL via Let's Encrypt**:
   If a custom domain is mapped to your EC2 elastic IP:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d <your-domain.com>
   ```
2. **Restrict PostgreSQL Security Group**:
   Ensure port `5432` on your RDS instance is strictly accessible only from the Security Group ID of your EC2 instance.
3. **S3 Lifecycle Rules**:
   Configure a 30-day expiration lifecycle rule on your Amazon S3 bucket for `screenshots/` and `keylogs/` prefixes to prevent accumulation of historical buffers.
