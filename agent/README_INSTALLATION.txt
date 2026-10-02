=====================================================================
  ENDPOINT DEVICE MONITORING & CONSENT SYSTEM (EDMT)
  Georgia Gwinnett College - ITEC 4810 Senior Capstone
  Test Device Setup & Installation Guide
=====================================================================

This package contains the client-side monitoring agent and consent UI
for deploying to Windows and macOS test workstations.

---------------------------------------------------------------------
1. WINDOWS TEST MACHINE INSTALLATION
---------------------------------------------------------------------
Option A: Standalone Windows Executable (No Python Required)
  1. Double-click `EDMT_Agent_Windows.exe`.
  2. The native Consent UI dialog will appear.

Option B: Automated Batch Script (With Python 3.9+)
  1. Double-click `install_agent_windows.bat` OR in PowerShell run:
     python install_agent.py
  2. All dependencies (PyQt6, pynput, psutil, Pillow, requests, etc.)
     will be verified and installed automatically.

---------------------------------------------------------------------
2. macOS TEST MACHINE INSTALLATION
---------------------------------------------------------------------
Option A: 1-Click Finder Launcher
  1. Double-click `install_agent_mac.command` in Finder.
     (If Gatekeeper displays a security notice, right-click the file
      and click "Open", or run: `chmod +x install_agent_mac.command`).
  2. The script creates an isolated virtual environment (`.venv_edmt`),
     installs all required packages, and launches the Consent UI.

Option B: Terminal Execution
  1. Open Terminal, change to this folder, and run:
     bash install_agent_mac.sh
     OR
     python3 install_agent.py

  * macOS Permissions Note:
    macOS requires explicit user authorization for input monitoring:
    • Open System Settings -> Privacy & Security -> Accessibility
      (Toggle ON Terminal or Python).
    • Open System Settings -> Privacy & Security -> Input Monitoring
      (Toggle ON Terminal or Python).

---------------------------------------------------------------------
3. CONNECTING TO THE AWS EC2 DASHBOARD
---------------------------------------------------------------------
1. When the Consent Modal opens on the test device:
   • Backend Server URL:
     Enter your EC2 server address:
     http://<YOUR-EC2-PUBLIC-IP>:8000/api/v1/telemetry
     (Or leave default http://127.0.0.1:8000/api/v1/telemetry for local testing).
   • Workstation ID:
     Enter the computer name (e.g. WORKSTATION-WIN11, MACBOOK-PRO-M2, etc.).
   • Check: [X] "I acknowledge and authorize session monitoring".
   • Click: "Start Monitoring".

2. In the Admin Dashboard:
   • The workstation immediately appears in the fleet table and overview cards.
   • Real-time telemetry, active applications, CPU%, RAM%, and keystroke
     intensity (KPM) will stream live.
   • Session recordings and decrypted screenshots can be inspected.

---------------------------------------------------------------------
4. FLEET CONTROLS & KICK FEATURE
---------------------------------------------------------------------
• Keystroke Audit Logging Toggle:
  Toggle hardware keystrokes on/off directly from the dashboard. When
  enabled, unmasked keystrokes are recorded to `agent/keystrokes_audit.txt`.
• Session Screen Recording Toggle:
  Toggle session screen streaming on/off (720p @ 1 FPS).
• Kick / De-authorize Endpoint:
  Click the red "Kick" button on any workstation to immediately terminate
  its monitoring session. The agent receives the de-authorization signal
  on its next heartbeat and automatically shuts down.
=====================================================================
