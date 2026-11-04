=====================================================================
  SECURESIGHT - ENDPOINT OBSERVABILITY & PRIVACY PLATFORM
  SecureSight Endpoint Observability Platform
  Endpoint Workstation Setup & Installation Guide
=====================================================================

This package contains the client-side monitoring agent and consent UI
for deploying to Windows, macOS, and Linux workstations.

---------------------------------------------------------------------
1. WINDOWS WORKSTATION INSTALLATION
---------------------------------------------------------------------
Option A: 1-Click Automated Batch Launcher (Recommended)
  1. Double-click `install_agent_windows.bat`
  2. The script will automatically verify Python 3.10+, create an
     isolated virtual environment, install all dependencies, and
     launch the SecureSight Consent UI.

Option B: Manual Terminal Execution (PowerShell)
  1. Open PowerShell and navigate to the agent directory:
     cd agent
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     pip install -r requirements.txt
     python run_agent.py

---------------------------------------------------------------------
2. macOS WORKSTATION INSTALLATION
---------------------------------------------------------------------
Option A: 1-Click Finder Launcher
  1. Double-click `install_agent_mac.command` in Finder.
     (If macOS Gatekeeper displays a security notice, right-click the file
      and click "Open", or run: `chmod +x install_agent_mac.command`).
  2. The script creates an isolated virtual environment (`.venv_securesight`),
     installs all required packages, and launches the Consent UI.

Option B: Terminal Execution
  1. Open Terminal, change to this folder, and run:
     bash install_agent_mac.sh
     OR
     python3 install_agent.py

  * macOS Permissions Notice:
    macOS requires explicit user authorization for input monitoring:
    • Open System Settings -> Privacy & Security -> Accessibility
      (Toggle ON Terminal or Python).
    • Open System Settings -> Privacy & Security -> Input Monitoring
      (Toggle ON Terminal or Python).
    • Open System Settings -> Privacy & Security -> Screen Recording
      (Toggle ON Terminal or Python).

---------------------------------------------------------------------
3. CONNECTING TO THE AWS EC2 DASHBOARD
---------------------------------------------------------------------
1. When the Consent Modal opens on the workstation:
   • Backend Server URL:
     Enter your EC2 server address:
     http://<YOUR_EC2_PUBLIC_IP>/api/v1/telemetry
     (Or use default http://127.0.0.1:8000/api/v1/telemetry for local testing).
   • Workstation ID:
     Enter the machine hostname (defaults to local hostname).
   • Check: [X] "I acknowledge and authorize session monitoring".
   • Click: "Start Monitoring".

2. In the Admin Dashboard:
   • The workstation immediately appears in the fleet table and overview cards.
   • Real-time telemetry, active applications, CPU%, RAM%, and keystroke
     intensity (KPM) stream live.
   • Encrypted screenshots and keystroke logs are transmitted according
     to configured policies.

---------------------------------------------------------------------
4. FLEET CONTROLS & PRIVACY CONTROLS
---------------------------------------------------------------------
• Keystroke Audit Logging:
  Keystrokes are automatically logged into timestamped 1-minute, pause,
  and session-end .txt files and mirrored to Amazon S3.
• Pause / Resume:
  The user can right-click the SecureSight shield icon in the system
  tray to pause or resume monitoring at any time.
• Kick / De-authorize Endpoint:
  Administrators can click the red "Kick" button on any workstation in
  the web dashboard to immediately revoke monitoring authorization.
  The agent receives the de-authorization signal on its next heartbeat
  and automatically shuts down.
=====================================================================
