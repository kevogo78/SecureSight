# SecureSight Branding & Assets

`securesight-logo.png` is the official brand artwork for SecureSight.
The dashboard's `public/branding` directory contains the same image.
The Qt branding helper frames the shield from the artwork at runtime and
renders multiple icon sizes for the tray and application windows.

### Running Agent with Brand Assets
From the repository root:

```bash
# Windows
python agent/run_agent.py

# macOS / Linux
python3 agent/run_agent.py
```

### PyInstaller Standalone Builds
Standalone PyInstaller builds must bundle the assets directory:
- On Linux / macOS: include `--add-data "assets:assets"`
- On Windows: include `--add-data "assets;assets"`

The build script `agent/build_mac_executable.sh` automatically includes the assets.
