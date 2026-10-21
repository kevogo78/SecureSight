# Verification Demos & Testing Scenarios

This guide provides step-by-step procedures to verify and demonstrate all key functional capabilities, privacy protections, keystroke audit trails, encrypted media flows, and cloud integrations across the **SecureSight Endpoint Observability Platform**.

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
2. The **SecureSight Monitoring Consent Notice** dialog appears centered on the screen displaying official SecureSight shield branding.
3. **Test Decline**: Click **"Decline / Exit"**.
   - *Expected Result*: The application terminates immediately with exit code 0. No network packets are transmitted, and no endpoint appears on the dashboard.
4. Launch the agent again:
   ```bash
   python -m src.main
   ```
5. **Test Accept**: Review the Server URL and Workstation name, then click **"I Consent & Authorize"**.
   - *Expected Result*: The agent registers with `/api/v1/endpoints/register`, minimizes to the System Tray, and begins background telemetry reporting.
6. Open the SecureSight Admin Dashboard in your browser (`http://<YOUR_EC2_PUBLIC_IP>/`).
   - *Expected Result*: The **Connected Endpoints** counter increments to 1, showing your workstation with a clean green **Online** status badge.

---

## ⚡ Demo 2: Real-Time Telemetry & Process Tracking

### Objective
Verify that active application context, window titles, and system performance metrics update reactively in the SecureSight Admin Dashboard.

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
1. On the monitored workstation, locate the SecureSight shield icon in the Windows System Tray (or macOS Menu Bar).
2. Right-click the icon and select **"Pause Monitoring Consent"**.
   - *Expected Result*: The agent flushes a timestamped `_pause.txt` snapshot to `agent/logs/`, notifies the backend `/api/v1/endpoints/{id}/pause`, and halts telemetry capture.
3. In the Admin Dashboard:
   - *Expected Result*: The workstation status pill immediately turns **Amber** displaying **`Paused`** with an animated pulsing indicator.
   - The **Consent Paused** metric counter increments by 1.
4. Right-click the System Tray icon again and select **"Resume Monitoring Consent"**.
   - *Expected Result*: The workstation transitions back to **`Online`** (green), restoring normal telemetry collection and restarting the session timer.

---

## 📝 Demo 5: Keystroke Audit Snapshots & Interactive Keylogs Viewer

### Objective
Verify periodic 60-second keystroke snapshot generation, empty-state notifications, zero-redundancy buffer clearing, and dashboard text viewing.

### Execution Steps
1. On the monitored workstation, open an editor and type test sentences for 60 seconds.
2. In the Admin Dashboard, navigate to the **Keylogs** tab within the Endpoint Detail View:
   - *Expected Result*:
     - A new audit file entry appears (e.g., `WORKSTATION_20261021_193000.txt`).
     - The entry lists the file size, timestamp, and S3 status.
3. Click on the log entry:
   - *Expected Result*: The **Keystroke Text Viewer Modal** opens, displaying the sanitized keystrokes with timestamps.
4. Let the workstation sit idle for 60 seconds without typing, then check the next generated snapshot:
   - *Expected Result*: The snapshot contains the explicit diagnostic banner:
     ```
     [No keystrokes recorded in this period.]
     ```
     No duplicate text from the prior minute is present.

---

## 🔐 Demo 6: Encrypted Screen Captures (AES-256-GCM) & Decrypted Gallery

### Objective
Demonstrate client-side authenticated encryption before upload to Amazon S3 and authenticated server-side decryption in the dashboard.

### Execution Steps
1. Ensure the agent has been running in an unmasked environment for at least 60 seconds.
2. The agent executes `ScreenCaptureEngine.capture_and_redact()`, encrypts the PNG display buffer using AES-256-GCM, and uploads the ciphertext to Amazon S3 under `screenshots/{endpoint_id}/`.
3. In the Admin Dashboard on the Endpoint Detail View, click the **Screenshots** tab:
   - *Expected Result*:
     - Captures appear in a responsive grid gallery showing capture timestamps and SHA-256 integrity digests.
     - Captured images stream cleanly through the authenticated decryption proxy (`GET /api/v1/media/{capture_id}/image`).
4. Click on any screenshot card:
   - *Expected Result*: Opens the full-screen screenshot inspection modal with zoom controls and metadata details.

---

## ⚙️ Demo 7: Dynamic Privacy Rules Engine & Sandbox

### Objective
Demonstrate runtime creation, toggling, and live testing of regex DLP rules without agent restarts.

### Execution Steps
1. In the Admin Dashboard, navigate to the **Privacy Rules** tab.
2. Review the built-in rules (SSN Redaction, Credit Card Masking, Password Control Suppression).
3. Click **"Add Privacy Rule"** to create a custom rule:
   - **Name**: `AWS API Key Redaction`
   - **Category**: `Credentials`
   - **Pattern**: `AKIA[0-9A-Z]{16}`
   - **Replacement**: `[REDACTED_AWS_KEY]`
   - **Action**: `mask_and_block`
4. Use the **Regex Testing Sandbox** at the bottom of the page:
   - Enter sample test text: `My key is AKIAIOSFODNN7EXAMPLE.`
   - Click **"Evaluate Rule"**.
   - *Expected Result*: The sandbox instantly previews the sanitized output: `My key is [REDACTED_AWS_KEY].` with rule match highlights.

---

## 🔌 Demo 8: Heartbeat Disconnection & Offline Device History

### Objective
Verify that disconnected machines automatically clear out of the active fleet and transition into the **Offline / Suspended History** view.

### Execution Steps
1. Right-click the agent System Tray icon and select **"Exit Agent"** (or terminate the process).
   - *Expected Result*: The agent notifies `/api/v1/endpoints/{id}/disconnect` and exits cleanly.
2. Inspect the Admin Dashboard:
   - *Expected Result*:
     - The **Connected Endpoints** metric decrements to 0.
     - The machine disappears from the **Active Fleet** table.
3. In the Endpoints Tab, click the **"Offline / Suspended History"** tab:
   - *Expected Result*:
     - The workstation appears with a grey **Offline** badge, showing last seen relative time, MAC address, and total logged cycles.
     - Clicking **"History"** preserves complete access to past audit trails, telemetry charts, and keylogs.

---

## 🗑️ Demo 9: Endpoint Renaming, Cascade Deletion & Re-Enrollment

### Objective
Demonstrate friendly alias assignment, safe cascade deletion of an endpoint's historical data, and seamless re-enrollment upon reconnection.

### Execution Steps
1. In the Endpoints table, click the **Edit / Rename** icon next to an endpoint:
   - Enter a custom alias: `Finance-Workstation-01`.
   - *Expected Result*: The endpoint displays the custom alias alongside its hardware hostname.
2. Click the **Delete** icon on an endpoint and confirm the prompt:
   - *Expected Result*: The endpoint and all cascading records (telemetry logs, audit logs, media captures, connection history) are cleanly removed from PostgreSQL.
3. Re-launch the agent on that machine:
   ```bash
   python -m src.main
   ```
4. Accept the consent dialog:
   - *Expected Result*: The agent detects its persistent hardware fingerprint and MAC address, re-registers cleanly as a fresh endpoint, and resumes monitoring without database foreign key errors.
