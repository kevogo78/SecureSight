#!/bin/bash
# =====================================================================
#   Build Native Standalone macOS Binary for Endpoint Device Monitor
#   Requires PyInstaller on macOS: pip install pyinstaller
# =====================================================================

set -e
cd "$(dirname "$0")"

echo "[*] Building Standalone macOS Binary..."
python3 -m pip install pyinstaller PyQt6 psutil Pillow cryptography requests pynput

pyinstaller \
    --name "EDMT_Agent_macOS" \
    --onefile \
    --windowed \
    --add-data "config:config" \
    --distpath "dist" \
    --workpath "build" \
    run_agent.py

echo "[+] Build complete! Binary generated at: agent/dist/EDMT_Agent_macOS"
