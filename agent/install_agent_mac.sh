#!/bin/bash
# =====================================================================
#   SecureSight Client Agent - macOS Terminal Setup & Launcher
#   SecureSight Endpoint Observability Platform
#   Usage: bash install_agent_mac.sh
# =====================================================================

cd "$(dirname "$0")"

echo "====================================================================="
echo "  SecureSight Client Agent - macOS Launcher"
echo "  SecureSight Endpoint Observability Platform"
echo "====================================================================="

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
    echo "[!] ERROR: Python 3 is not found. Please install Python 3.9+."
    exit 1
fi

VENV_DIR=".venv_securesight"
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] Creating virtual environment in $VENV_DIR..."
    $PYTHON_BIN -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "[*] Verifying/installing dependencies..."
python -m pip install --upgrade pip --quiet
python -m pip install psutil Pillow cryptography requests PyQt6 pynput

echo "[*] Launching Agent Consent UI..."
python run_agent.py
