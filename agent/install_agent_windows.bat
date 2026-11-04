@echo off
setlocal EnableDelayedExpansion
title SecureSight Endpoint Monitor & Consent UI Installer - Windows
color 0A

echo =====================================================================
echo   SecureSight Client Agent - Windows 1-Click Installer
echo   SecureSight Endpoint Observability Platform
echo =====================================================================
echo.

:: 1. Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if !errorlevel! neq 0 (
        color 0C
        echo [!] ERROR: Python 3 was not found on this system.
        echo.
        echo Please install Python 3.10+ from:
        echo   https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation.
        echo.
        pause
        exit /b 1
    ) else (
        set PYTHON_CMD=py
    )
) else (
    set PYTHON_CMD=python
)

echo [+] Python runtime detected:
%PYTHON_CMD% --version
echo.

:: 2. Navigate to agent directory
cd /d "%~dp0"

:: 3. Run the automated installer and launch consent UI
echo [*] Executing installer and launching Consent UI...
echo.
%PYTHON_CMD% install_agent.py

if %errorlevel% neq 0 (
    echo.
    echo [!] Agent terminated with exit code %errorlevel%.
    pause
)
