# Verification Demos & Testing Scenarios

This guide provides step-by-step procedures to verify and demonstrate all key functional capabilities, privacy protections, and cloud integrations across the **Privacy-Centric Endpoint Observability System (EDMT)**.

---

## 🧪 Demo 1: Agent Registration & Explicit Consent Flow

### Objective
Demonstrate that workstations cannot be monitored without explicit user acknowledgment and consent authorization.

### Execution Steps
1. On a test workstation or terminal, navigate to the `agent/` directory:
   ```bash
   cd agent
   python -m src.main
   ```
2. The **Endpoint Monitoring Consent Notice** dialog appears centered on the screen.
3. **Test Decline**: Click **"Decline / Exit"**.
   - *Expected Result*: The application terminates immediately with exit code 0. No network packets are transmitted, and no endpoint appears on the dashboard.
4. Launch the agent again:
   ```bash
   python -m src.main
   ```
5. **Test Accept**: Review the Server URL and Workstation name, then click **"I Consent & Authorize"**.
   - *Expected Result*: The agent registers with `/api/v1/endpoints/register`, minimizes to the System Tray, and begins background telemetry reporting.
6. Open the Admin Dashboard in your browser (`http://<YOUR_EC2_PUBLIC_IP>/`).
   - *Expected Result*: The **Connected Endpoints** counter increments to 1, showing your workstation with a green **Online** status indicator.

---

## ⚡ Demo 2: Real-Time Telemetry & Process Tracking

### Objective
Verify that active application context, window titles, and system performance metrics update reactively in the Admin Dashboard.

### Execution Steps
1. With the agent running, open **Visual Studio Code** and type code.
2. In the Admin Dashboard, navigate to the **Endpoints Tab** and click **"View"** on your active workstation.
3. Observe the **Active Application** card and performance charts:
   - *Expected Result*: The active application reflects `Code.exe` (or `Visual Studio Code`). CPU% and RAM% update dynamically in real time.
4. Switch to a web browser (e.g., Google Chrome) and browse to a public website.
   - *Expected Result*: The dashboard updates within the 10-second polling window to reflect `chrome.exe` under the **Browsing** category.

---

## 🛡️ Demo 3: Privacy DLP & Blacklist Suppression

### Objective
Verify that sensitive windows (banking websites, password managers, credentials) are automatically detected and suppressed from monitoring.

### Execution Steps
1. On the monitored workstation, open a text editor or browser tab with the title:
   ```
   Chase Online Banking - Personal Accounts
   ```
2. The agent's local DLP engine evaluates the window title against `agent/config/blacklist.json`.
3. Check the Admin Dashboard under the **Activity Tab**:
   - *Expected Result*:
     - A new audit event appears with status **`Privacy_Suspended`**.
     - The filter status is recorded as **`Title_Blacklisted`** (or `Password_Control_Suppressed`).
     - Keystrokes are suppressed (`0 KPM`).
     - Screenshot capture is disabled (`media_url = None`).
     - A security alert appears in the top navigation bell notification menu.

---

## ⏸️ Demo 4: User Autonomy - System Tray Pause & Resume

### Objective
Demonstrate user autonomy by pausing and resuming monitoring directly from the operating system's system tray.

### Execution Steps
1. On the monitored workstation, locate the agent icon in the Windows System Tray (or macOS Menu Bar).
2. Right-click the icon and select **"Pause Monitoring Consent"**.
   - *Expected Result*: The agent notifies the backend `/endpoints/{id}/pause`.
3. In the Admin Dashboard:
   - *Expected Result*: The workstation status pill immediately turns **Amber** displaying **`Paused`** with an animated pulsing indicator.
   - The **Consent Paused** metric counter increments by 1.
4. Right-click the System Tray icon again and select **"Resume Monitoring Consent"**.
   - *Expected Result*: The workstation transitions back to **`Online`** (green), restoring normal telemetry collection.

---

## 🔌 Demo 5: Heartbeat Disconnection & Offline Device History

### Objective
Verify that disconnected machines automatically clear out of the active fleet and transition into the **Offline / Suspended History** view.

### Execution Steps
1. Right-click the agent System Tray icon and select **"Exit Agent"** (or terminate the process in Task Manager / Terminal).
   - *Expected Result*: The agent executes `terminate()`, notifying `/endpoints/{id}/disconnect`.
2. Inspect the Admin Dashboard:
   - *Expected Result*:
     - The **Connected Endpoints** metric decrements to 0.
     - The machine disappears from the **Active Fleet (Connected)** table.
3. In the Endpoints Tab, click the **"Offline / Suspended History"** tab button (or click the **Offline / Suspended** KPI card):
   - *Expected Result*:
     - Your workstation appears in the **Offline / Suspended History** table.
     - The table displays its **Last Known IP Address**, **Operating System**, **Last Seen** relative timestamp (`Just now` or `X seconds ago`), and total historical telemetry cycles recorded.
4. Click **"History"** on the offline workstation:
   - *Expected Result*: Opens the Endpoint Detail View, allowing the administrator to inspect past telemetry charts, activity logs, and compliance records even while the machine is offline.

---

## 🔐 Demo 6: End-to-End Encrypted Screen Captures (AES-256-GCM + S3)

### Objective
Demonstrate client-side authenticated encryption before upload to Amazon S3 and verifiable browser decryption.

### Execution Steps
1. Ensure the agent has been running in an unmasked environment for at least 6 polling ticks (~60 seconds).
2. The agent executes `ScreenCaptureEngine.capture_and_redact()`, encrypts the buffer using AES-256-GCM, and requests a presigned upload URL from `/api/v1/telemetry`.
3. The encrypted binary payload (`.enc`) is streamed directly to the Amazon S3 bucket.
4. In the Admin Dashboard on the **Endpoint Detail View**, click the **"Latest Capture"** button:
   - *Expected Result*:
     - The dashboard retrieves the presigned S3 download URL from the FastAPI backend.
     - The image is decrypted client-side in the browser using the shared master key.
     - The decrypted screenshot modal opens, displaying the capture along with the SHA-256 verification hash and timestamp.

