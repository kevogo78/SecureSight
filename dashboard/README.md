# SecureSight Admin Security & Compliance Dashboard

The **SecureSight Admin Dashboard** is a modern Single Page Application (SPA) engineered with **React 18**, **Vite**, **Tailwind CSS v4**, and **Recharts**. It provides security analysts and compliance officers with fleet-wide observability, real-time activity timelines, decrypted visual auditing, and workstation lifecycle management.

---

## 🖥️ Dashboard Views & Capabilities

### 1. Fleet Overview (`FleetOverviewView.jsx`)
- High-level executive banner displaying active SecureSight fleet monitoring state.
- Live KPI cards: **Connected Endpoints**, **Online & Streaming**, **Offline / Suspended**, and **Privacy Redactions Masked**.
- One-click navigation to deeper investigation workflows.

### 2. Endpoints Management (`EndpointsView.jsx`)
- **Active Fleet (Connected)**: Displays workstations currently responsive to heartbeats with clean status indicators (`Online`, `Offline`, `Paused`), CPU%, RAM%, active application, and consent status.
- **Offline / Suspended History**: Displays past consented workstations that are currently disconnected, showing their **Connection History**, last seen timestamps, and hardware identifiers (`MAC Address` / `Device Fingerprint`).
- **Administrator Controls**:
  - **View History / Details**: Deep-dive into an endpoint's individual telemetry and logs.
  - **Pause / Resume**: Remotely pause or resume monitoring consent.
  - **Kick**: Revoke authorization and immediately disconnect an endpoint.
  - **Delete Endpoint (Danger Zone)**: Permanently purges an endpoint, cascading deletion through its logs, telemetry, and connection history.

### 3. Endpoint Detail Investigation (`EndpointDetailView.jsx`)
- **Identity & Session Uptime**: Header displaying friendly workstation name, assigned user, OS, IP address, and dynamic active session uptime (`uptime_seconds`).
- **Modern Investigation Sub-Tabs**:
  - **Activity**: Recent applications and activity rates.
  - **Applications**: Foreground application usage share and categorization.
  - **Activity Index & DLP Timeline**: Visual event stream of applications, keystrokes, and privacy filter decisions scoped strictly to this machine.
  - **Keylogs**: Interactive audit text file explorer displaying timestamped `.txt` snapshot files (`1-min`, `pause`, `end-session`, `kicked`), text viewer modal, one-click downloads, and batch deletion.
  - **Screenshots**: Encrypted capture gallery displaying Amazon S3 media captures with authenticated server-side AES-256-GCM image decryption and batch deletion.
  - **System Usage**: Time-series charts tracking CPU% and RAM% utilization over time.

### 4. Fleet Activity Stream (`ActivityView.jsx`)
- Unified chronological event log across all endpoints.
- Filter by endpoint, activity state (`Active`, `Privacy_Suspended`), and filter status (`Clean`, `Title_Blacklisted`, `Password_Control_Suppressed`).

### 5. Compliance Reports (`ReportsView.jsx`)
- Summary compliance scores, DLP incident ratios, and fleet health metrics.
- Export complete telemetry and compliance audit data to structured JSON.

### 6. System & Privacy Settings (`SettingsView.jsx`)
- Configure agent polling intervals and encrypted screenshot frequency.
- **Dynamic Privacy Rules Manager**: Add, edit, enable/disable, and delete database-backed DLP privacy rules (regex patterns, domains, process names, window titles).
- **Interactive Rule Evaluation Sandbox**: Real-time interactive testing interface simulating text masking, process suppression, and screenshot blocking before committing rules.
- Test live FastAPI service latency and Amazon RDS connectivity via the `/health` diagnostic tool.

---

## 🛠️ Project Structure

```
dashboard/
├── package.json           # Dependencies and scripts (Vite, Tailwind v4, Lucide)
├── postcss.config.js      # PostCSS configuration with @tailwindcss/postcss
├── vite.config.js         # Vite configuration and proxy rules
├── public/
│   └── branding/          # SecureSight official branding logos and icons
│       └── securesight-logo.png
├── src/
│   ├── App.jsx            # Main application router and state synchronization loop
│   ├── index.css          # Tailwind CSS v4 styling rules
│   ├── main.jsx           # React DOM root entry point
│   ├── components/        # Modals, Header, Sidebar, and reusable widgets
│   ├── services/
│   │   └── api.js         # Axios API client, endpoint getters, and auth tokens
│   └── components/views/  # Individual tab view components
└── dist/                  # Optimized production build artifacts
```

---

## 🚀 Development & Build Instructions

### Local Development Server
```bash
cd dashboard
npm install
npm run dev
```
Access the local development server at `http://localhost:5173/`.

### Production Build
```bash
npm run build
```
The optimized static bundle is output to `dashboard/dist/` and is ready for static web hosting via NGINX or AWS S3/CloudFront.
