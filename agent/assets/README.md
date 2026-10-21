# SecureSight branding

`securesight-logo.png` is the original supplied artwork, unchanged.
The dashboard's public/branding directory contains the same image.
The Qt branding helper frames the shield from the artwork at runtime and
renders multiple icon sizes for the tray and application windows.

Source launch from the repository root:

```powershell
.\.venv311\Scripts\python.exe agent\run_agent.py
```

Restart an already running agent to see the updated icon. This starts the
normal consent flow; the branding smoke check does not start monitoring.

Standalone PyInstaller builds must include the assets directory. From agent/,
include `--add-data "assets:assets"` alongside existing build options (current
PyInstaller), or `--add-data "assets;assets"` for older Windows PyInstaller.
The existing macOS build script includes the assets. Keep existing executable
filenames/download links until the release packaging is updated together.
An existing EXE does not change when source files are updated; rebuild and
redistribute it. Dashboard branding requires building/deploying dashboard/dist
to EC2; these local edits do not update the running website.
