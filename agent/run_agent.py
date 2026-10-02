"""
Endpoint Device Monitor & Consent UI - Unified Entry Point
Compatible with Windows, macOS, and Linux test devices.
"""
import os
import sys

# Ensure the agent root folder is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.main import main

if __name__ == "__main__":
    main()
