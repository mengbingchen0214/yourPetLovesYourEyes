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

### Development Mode

```bash
npm install
npm run dev
```

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
