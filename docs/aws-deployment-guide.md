# AWS Cloud Deployment & Infrastructure Guide

This guide details the complete end-to-end cloud provisioning and deployment procedure for the **Privacy-Centric Endpoint Observability System (EDMT)** on Amazon Web Services (AWS), optimized to operate within the **AWS Free Tier**.

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
|  |   └───────┬───────┘              └──────────────────┬──────────────────┘    |  |
|  |           │                                         │                       |  |
|  |           ▼ /* (Static SPA)                         │                       |  |
|  |   ┌───────────────────────────────┐                 │                       |  |
|  |   │ React Dashboard (/usr/share)  │                 │                       |  |
|  |   └───────────────────────────────┘                 │                       |  |
|  +-----------------------------------------------------┼-----------------------+  |
|                                                        │                          |
|                     ┌──────────────────────────────────┴─────────────┐            |
|                     ▼                                                ▼            |
|       +───────────────────────────+                    +───────────────────────+  |
|       | Amazon RDS PostgreSQL     |                    | Amazon S3 Bucket      |  |
|       | db.t3.micro / db.t4g.micro|                    | Encrypted Media Store |  |
|       | Tables: users, endpoints, |                    | Presigned PUT/GET URLs|  |
|       | audit_logs, telemetry_logs|                    | AES-256-GCM Buffers   |  |
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
5. **IAM Credentials**: An IAM user or instance role with `s3:PutObject`, `s3:GetObject`, and `s3:ListBucket` permissions.

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

The database structure consists of 5 core tables:

| Table Name | Description |
| :--- | :--- |
| `users` | Administrator and Auditor credentials, roles, and hashed passwords. |
| `endpoints` | Monitored workstations, computer hostnames, OS types, active status, and last seen timestamps. |
| `telemetry_logs` | Performance metrics (CPU%, RAM%, Disk%, Network I/O, Uptime). |
| `audit_logs` | Real-time events, active application, keystroke rates, privacy states, and DLP flags. |
| `media_captures` | S3 object keys, SHA-256 hashes, and AES-256-GCM initialization vectors (IV). |

### Applying Seed Users & Clearing Stale Records
Run `database/seed.sql` to initialize default administrative credentials:

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
Create the production environment file at `/home/ubuntu/ITEC4810_Capstone/backend/.env`:

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
S3_BUCKET_NAME=<YOUR_S3_BUCKET_NAME>

# Application Security
SECRET_KEY=<YOUR_RANDOM_SESSION_SECRET_KEY>
```

### Configure Systemd Service (`endpoint-api.service`)
Create the systemd daemon file to ensure FastAPI runs continuously in the background and restarts on system reboot:

```bash
sudo nano /etc/systemd/system/endpoint-api.service
```

Paste the following service definition:

```ini
[Unit]
Description=FastAPI Endpoint Monitoring Daemon
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

### Build the React Dashboard
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

Paste the following NGINX configuration:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

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
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Single Page Application (SPA) fallback routing
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
2. Updates backend dependencies and applies virtual environment fixes.
3. Installs frontend packages and executes `npm run build`.
4. Deploys static build artifacts to `/usr/share/nginx/html/`.
5. Restarts `endpoint-api` and `nginx` services with zero downtime.

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
   Configure a 30-day expiration lifecycle rule on your Amazon S3 bucket to prevent accumulation of historical screenshot buffers.

