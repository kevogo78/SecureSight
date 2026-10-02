#!/bin/bash
# =====================================================================
#   Endpoint Device Monitor (EDMT) - macOS 1-Click Installer & Launcher
#   Georgia Gwinnett College - ITEC 4810 Capstone
#   Double-click this file in Finder to install and launch on Mac.
# =====================================================================

set -e

# Change directory to the folder containing this script
cd "$(dirname "$0")"

echo "====================================================================="
echo "  Endpoint Device Monitor (EDMT) - macOS Installer"
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
    $PYTHON_BIN -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# 3. Run automated installer and launch Consent UI
echo "[*] Upgrading pip and installing required dependencies..."
python -m pip install --upgrade pip --quiet
python install_agent.py

echo ""
echo "[+] Agent execution finished."
