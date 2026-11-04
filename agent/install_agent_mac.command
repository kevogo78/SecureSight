#!/bin/bash
# =====================================================================
#   SecureSight Client Agent - macOS 1-Click Installer & Launcher
#   SecureSight Endpoint Observability Platform
#   Double-click this file in Finder to install and launch on Mac.
# =====================================================================

set -e

# Change directory to the folder containing this script
cd "$(dirname "$0")"

echo "====================================================================="
echo "  SecureSight Client Agent - macOS Installer & Launcher"
echo "  SecureSight Endpoint Observability Platform"
echo "====================================================================="
echo ""

# 1. Locate Python 3
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
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
VENV_DIR=".venv_securesight"
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] Creating isolated Python virtual environment ($VENV_DIR)..."
    $PYTHON_BIN -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# 3. Install/upgrade dependencies
echo "[*] Verifying & installing required dependencies..."
python -m pip install --upgrade pip --quiet
python -m pip install psutil Pillow cryptography requests PyQt6 pynput

# 4. Display macOS Privacy & Permissions Notice
echo ""
echo "---------------------------------------------------------------------"
echo "  macOS PERMISSIONS NOTICE:"
echo "  • Accessibility: If prompted, allow Terminal / Python in:"
echo "    System Settings -> Privacy & Security -> Accessibility"
echo "  • Input Monitoring: If prompted, allow Terminal / Python in:"
echo "    System Settings -> Privacy & Security -> Input Monitoring"
echo "  • Screen Recording: If prompted, allow Terminal / Python in:"
echo "    System Settings -> Privacy & Security -> Screen Recording"
echo "---------------------------------------------------------------------"
echo ""

# 5. Launch the Agent Consent UI
echo "[*] Launching SecureSight Consent UI on this Mac..."
if [ -f "run_agent.py" ]; then
    python run_agent.py
elif [ -f "src/main.py" ]; then
    python src/main.py
else
    python install_agent.py
fi

echo ""
echo "[+] SecureSight Agent session finished."
read -p "Press [Enter] to close this window..."
