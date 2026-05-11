# EyePet 🐾

> A desktop pet that reminds you to rest your eyes every 20 minutes.

---

## Features

- **Eye Care Reminder**: Follows the 20-20-20 rule — triggers every 20 minutes with full-screen overlay prompting you to look 20 feet away for 20 seconds
- **Desktop Resident**: Borderless transparent window, always on top, freely draggable
- **Pet Animation**: Gentle floating animation while sleeping, nodding during rest reminders
- **Customizable**: Custom pet images (sleeping/rest states), tray icon, app icon, greeting text
- **System Tray**: Real-time countdown display, pause/resume, show/hide pet
- **Multi-Monitor**: Rest overlay covers all connected displays

---

## Installation

### macOS (After Download)

If macOS says "EyePet is damaged and cannot be run":

1. **Option A - Quick Bypass**:
   - Right-click **EyePet.app** → **Open**
   - Click **"Open"** button in the dialog
   - macOS will remember this choice for future launches

2. **Option B - Terminal Command**:
   ```bash
   sudo spctl --master-disable
   ```
   (This disables Gatekeeper temporarily - re-enable with `--master-enable` after opening the app)

3. **Option C - Extract ZIP** (Recommended):
   - Download the **ZIP** file instead of DMG
   - Extract it and run EyePet directly
   - Same right-click → Open workaround may still be needed

### Development Mode

```bash
npm install
npm run dev
```

### Building & Releasing

This project uses **GitHub Actions** for automated multi-platform builds. The CI/CD pipeline automatically builds installers for macOS, Windows, and Linux.

#### Manual Build (Recommended for Testing)

1. Go to [GitHub Actions](https://github.com/mengbingchen0214/yourPetLovesYourEyes/actions/workflows/release.yml)
2. Click **"Run workflow"** → **"Run workflow"**
3. Wait for the build to complete (typically 10-15 minutes)
4. Download the artifacts from the workflow run

#### Automated Release

Push a new version tag to trigger automatic release builds:

```bash
npm version patch  # or minor/major
git push --tags
```

This creates a new GitHub Release with installers for all platforms:
- **macOS**: DMG and ZIP (ARM64 + x64)
- **Windows**: NSIS installer and portable EXE (x64)
- **Linux**: AppImage, DEB, and RPM (x64)

#### Build Requirements

- Node.js 22+
- pnpm 9+
- Platform-specific builds run on GitHub-hosted runners:
  - macOS builds: `macos-latest`
  - Windows builds: `windows-latest`
  - Linux builds: `ubuntu-latest`

---

## Usage

| Action | Effect |
|---|---|
| Click "Start Eye Protection" | Start 20-minute countdown |
| Drag pet | Move anywhere on screen |
| `Cmd+Shift+E` | Show / hide pet window |
| Right-click tray icon | Pause, customize settings, support developer, quit |

### Personalization (Right-click Tray → Personalize)

- **Change 20-min Pet Photo**: Image displayed during work state
- **Change 20-sec Pet Photo**: Image displayed during rest reminder
- **Change Tray Icon**: Menu bar icon
- **Change App Icon**: Dock icon
- **Modify Greeting Text**: Welcome message on first launch

---

## Support Developer

If you enjoy this app, you can support the developer via Alipay:

- Right-click tray icon → **☕ Support Developer**
- Suggested amount: ¥2.88
- No registration or activation code needed, scan to support

Thank you for your support! ❤️

---

## File Structure

```
eye-pet/
├── main.js              # Electron main process (state machine, timer, tray)
├── preload.js           # Renderer IPC bridge
├── index.html           # Desktop pet UI
├── overlay.html         # Full-screen rest reminder overlay
├── input-dialog.html    # Greeting text input dialog
├── dialog-preload.js    # Dialog IPC bridge
├── assets/              # Pet image assets
│   ├── angel.png        # Default pet image
│   ├── angel-wakeup.png # Rest reminder image
│   └── donation-qrcode.jpeg # Alipay QR code
├── backend/             # Image processing backend (optional, standalone service)
│   ├── server.py        # FastAPI: background removal + Q-version processing
│   └── requirements.txt
├── web/                 # Netlify landing page
│   └── index.html
├── build/               # Icon resources and build config
└── scripts/
    └── package.sh       # Build script
```

---

## Backend Image Processing (Optional)

`backend/` provides a standalone Python service for pet photo background removal and Q-version style processing:

```bash
cd backend
pip install -r requirements.txt
python server.py
# Visit http://localhost:8765 after starting
```

Endpoints:
- `POST /process-qversion`: Background removal + Q-version, returns base64 PNG
- `POST /remove-background`: Background removal only

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron 41 + HTML/CSS/JS |
| Image Processing Backend | Python + FastAPI + rembg + Pillow |
| Landing Page | Pure HTML, deployed on Netlify |

---

## System Requirements

- macOS 12+
- Eye care reminder works offline
- All features completely free, voluntary donations welcome to support development
