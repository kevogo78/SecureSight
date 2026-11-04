#!/usr/bin/env python3
"""
Cross-Platform Endpoint Agent & Consent UI Installer
Works on: Windows, macOS, Linux
Author: SecureSight Team

Automatically verifies Python environment, installs all required dependencies
(psutil, Pillow, cryptography, requests, PyQt6, pynput, and pywin32 on Windows),
and launches the Endpoint Device Monitor with the native Consent Authorization UI.
"""

import sys
import os
import subprocess
import platform
import shutil

REQUIRED_PACKAGES = [
    "psutil>=5.9.0",
    "Pillow>=10.0.0",
    "cryptography>=41.0.0",
    "requests>=2.31.0",
    "PyQt6>=6.5.0",
    "pynput>=1.7.6",
]

WINDOWS_SPECIFIC = [
    "pywin32>=306",
]

def print_header(title: str):
    bar = "=" * 68
    print(f"\n{bar}\n  {title}\n{bar}\n")

def check_python_version():
    print(f"[*] Detected Operating System: {platform.system()} ({platform.release()})")
    print(f"[*] Python Interpreter: {sys.executable}")
    print(f"[*] Python Version: {platform.python_version()}")
    
    if sys.version_info < (3, 9):
        print("\n[!] ERROR: Python 3.9 or newer is required to run this agent.")
        print("    Please download and install Python from https://www.python.org/downloads/")
        sys.exit(1)
    print("[+] Python version is compatible.")

def install_dependencies():
    print_header("Installing Required Agent Dependencies")
    
    packages_to_install = list(REQUIRED_PACKAGES)
    if platform.system() == "Windows":
        packages_to_install.extend(WINDOWS_SPECIFIC)

    # Upgrade pip first
    print("[*] Upgrading pip installer...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip", "--quiet"])
    except Exception as e:
        print(f"[-] Note: Could not upgrade pip ({e}), continuing...")

    print(f"[*] Installing packages: {', '.join(packages_to_install)}")
    try:
        cmd = [sys.executable, "-m", "pip", "install"] + packages_to_install
        subprocess.check_call(cmd)
        print("\n[+] All dependencies successfully installed!")
    except subprocess.CalledProcessError as e:
        print(f"\n[!] ERROR: Failed to install packages. Error code: {e.returncode}")
        print("    Try running with administrator/root privileges or in a virtual environment.")
        sys.exit(1)

def verify_imports():
    print_header("Verifying Library Integrations")
    checks = [
        ("PyQt6 GUI Framework", "PyQt6.QtWidgets"),
        ("System Metrics (psutil)", "psutil"),
        ("Screen Capture (Pillow)", "PIL.ImageGrab"),
        ("AES-256 Crypto Engine", "cryptography.hazmat.primitives.ciphers.aead"),
        ("Telemetry Transport (requests)", "requests"),
        ("Input Activity Monitor (pynput)", "pynput"),
    ]

    if platform.system() == "Windows":
        checks.append(("Win32 Window Capture (pywin32)", "win32gui"))

    all_passed = True
    for name, module in checks:
        try:
            __import__(module)
            print(f"  [OK] {name}")
        except ImportError as e:
            print(f"  [FAIL] {name} - Import error: {e}")
            all_passed = False

    if not all_passed:
        print("\n[!] WARNING: Some modules failed to import. Telemetry features may run in fallback mode.")
    else:
        print("\n[+] All required modules verified successfully!")

def macos_permissions_notice():
    if platform.system() == "Darwin":
        print_header("macOS Privacy & Permissions Notice")
        print("Note for macOS test machines:")
        print("  • Accessibility: If prompted, allow Terminal / Python in:")
        print("    System Settings -> Privacy & Security -> Accessibility")
        print("  • Screen Recording: If prompted, allow Terminal / Python in:")
        print("    System Settings -> Privacy & Security -> Screen Recording")
        print("  • Window Inspection: macOS uses native osascript / System Events.")

def launch_agent():
    print_header("Launching Endpoint Device Monitor & Consent UI")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    entry_point = os.path.join(script_dir, "run_agent.py")
    if not os.path.exists(entry_point):
        entry_point = os.path.join(script_dir, "src", "main.py")

    print(f"[*] Starting: {entry_point}")
    print("[*] Displaying Consent Authorization Dialog on test workstation...")
    try:
        subprocess.call([sys.executable, entry_point])
    except Exception as e:
        print(f"[!] Failed to launch agent: {e}")

if __name__ == "__main__":
    print_header("Endpoint Device Monitor (EDMT) - Test Workstation Installer")
    check_python_version()
    install_dependencies()
    verify_imports()
    macos_permissions_notice()
    launch_agent()
