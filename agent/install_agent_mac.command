#!/bin/bash
# =====================================================================
#   Endpoint Device Monitor (EDMT) - macOS 1-Click Installer & Launcher
#   Georgia Gwinnett College - ITEC 4810 Capstone
<<<<<<< HEAD
#   Double-click this file in Finder to install dependencies and run.
# =====================================================================

=======
#   Double-click this file in Finder to install and launch on Mac.
# =====================================================================

set -e

>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb
# Change directory to the folder containing this script
cd "$(dirname "$0")"

echo "====================================================================="
<<<<<<< HEAD
echo "  Endpoint Device Monitor (EDMT) - macOS Installer & Launcher"
=======
echo "  Endpoint Device Monitor (EDMT) - macOS Installer"
>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb
echo "  Georgia Gwinnett College - ITEC 4810 Capstone"
echo "====================================================================="
echo ""

# 1. Locate Python 3
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
<<<<<<< HEAD
    echo "[!] ERROR: Python 3 is not found on this Mac."
    echo "    macOS requires Python 3.9+ to run the monitoring client."
    echo "    Download from: https://www.python.org/downloads/mac-osx/"
    echo "    Or via Homebrew: brew install python"
    echo ""
    read -p "Press [Enter] to exit..."
    exit 1
fi

echo "[+] Using Python interpreter: $($PYTHON_BIN --version) at $(which $PYTHON_BIN)"

# 2. Setup Virtual Environment (Required on modern macOS Sonoma/Sequoia PEP 668)
VENV_DIR=".venv_edmt"
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] Creating isolated Python virtual environment ($VENV_DIR)..."
=======
    echo "[!] ERROR: Python 3 is not installed on this Mac."
    echo "    Please install Python 3 via: https://www.python.org/downloads/"
    echo "    Or using Homebrew: brew install python"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[+] Detected Python: $($PYTHON_BIN --version)"

# 2. Setup Virtual Environment (Recommended on modern macOS with PEP 668)
VENV_DIR=".venv_edmt"
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] Creating dedicated Python virtual environment ($VENV_DIR)..."
>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb
    $PYTHON_BIN -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

<<<<<<< HEAD
# 3. Install/upgrade dependencies
echo "[*] Installing required packages (PyQt6, pynput, psutil, Pillow, cryptography, requests)..."
python -m pip install --upgrade pip --quiet
python -m pip install psutil Pillow cryptography requests PyQt6 pynput

# 4. Display macOS Privacy & Permissions Instructions
echo ""
echo "---------------------------------------------------------------------"
echo "  macOS PERMISSIONS NOTICE:"
echo "  • Accessibility: Allow Terminal / Python in:"
echo "    System Settings -> Privacy & Security -> Accessibility"
echo "  • Input Monitoring: Allow Terminal / Python in:"
echo "    System Settings -> Privacy & Security -> Input Monitoring"
echo "---------------------------------------------------------------------"
echo ""

# 5. Launch the Agent Consent UI
echo "[*] Launching Agent Consent UI on this Mac..."
if [ -f "run_agent.py" ]; then
    python run_agent.py
elif [ -f "src/main.py" ]; then
    python src/main.py
else
    python install_agent.py
fi

echo ""
echo "[+] EDMT Agent session finished."
read -p "Press [Enter] to close this window..."
=======
# 3. Run automated installer and launch Consent UI
echo "[*] Upgrading pip and installing required dependencies..."
python -m pip install --upgrade pip --quiet
python install_agent.py

echo ""
echo "[+] Agent execution finished."
>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb
