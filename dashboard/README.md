# EDMT Admin Security & Compliance Dashboard

The **EDMT Admin Dashboard** is a modern Single Page Application (SPA) engineered with **React 18**, **Vite**, **Tailwind CSS v4**, and **Recharts**. It provides security analysts and compliance officers with fleet-wide observability, real-time activity timelines, decrypted visual auditing, and workstation lifecycle management.

---

## 🖥️ Dashboard Views & Capabilities

### 1. Fleet Overview (`FleetOverviewView.jsx`)
- High-level executive banner displaying active fleet monitoring state.
- Live KPI cards: **Connected Endpoints**, **Online & Streaming**, **Offline / Suspended**, and **Privacy Redactions Masked**.
- One-click navigation to deeper investigation workflows.

### 2. Endpoints Management (`EndpointsView.jsx`)
- **Active Fleet (Connected)**: Displays workstations currently responsive to heartbeats, with real-time CPU%, RAM%, active application, and consent status.
- **Offline / Suspended History**: Displays past consented workstations that are currently disconnected, showing their **Connection History**, last seen relative timestamps, and total historical telemetry cycles recorded.
- **Administrator Controls**:
  - **View History / Details**: Deep-dive into an endpoint's individual activity timeline.
  - **Pause / Resume**: Remotely pause or resume monitoring consent.
  - **Kick**: Revoke authorization and disconnect an endpoint.

### 3. Endpoint Detail Investigation (`EndpointDetailView.jsx`)
- Real-time time-series telemetry charts (CPU% and RAM% over time).
- **Activity Index & DLP Timeline**: Visual event stream of applications, keystrokes, and privacy filter decisions scoped strictly to this machine.
- **Latest Capture Modal**: Fetches presigned S3 media and renders client-side decrypted screenshots.
- Application usage share breakdown.

### 4. Fleet Activity Stream (`ActivityView.jsx`)
- Unified chronological event log across all endpoints.
- Filter by endpoint, activity state (`Active`, `Privacy_Suspended`), and filter status (`Clean`, `Title_Blacklisted`, `Password_Control_Suppressed`).

### 5. Compliance Reports (`ReportsView.jsx`)
- Summary compliance scores, DLP incident ratios, and fleet health metrics.
- Export complete telemetry and compliance audit data to structured JSON.

### 6. System & Privacy Settings (`SettingsView.jsx`)
- Configure agent polling intervals and encrypted screenshot frequency.
- Manage the shared **AES-256-GCM Master Key** with one-click regeneration and clipboard copying.
- Edit process and window title blacklists.
- Test live FastAPI service latency and Amazon RDS connectivity via the `/health` diagnostic tool.

---

## 🛠️ Project Structure

```
dashboard/
├── package.json           # Dependencies and scripts (Vite, Tailwind v4, Lucide)
├── postcss.config.js      # PostCSS configuration with @tailwindcss/postcss
├── vite.config.js         # Vite configuration and proxy rules
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

