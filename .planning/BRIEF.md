# EyePet — Electron → Tauri Migration

**One-liner**: Migrate EyePet desktop pet app from Electron to Tauri for smaller binaries, faster builds, and lower resource usage.

## Problem

EyePet is a tiny desktop utility (~500 lines of JS logic) but ships as a ~200MB Electron binary because it bundles an entire Chromium browser. Building for Windows requires a separate Windows runner with electron-builder, and the CI builds are slow due to Electron's size and complexity. Users complain about download size and memory usage for what's essentially a floating pet with a timer.

## Success Criteria

- [ ] EyePet runs identically on macOS and Windows via Tauri
- [ ] Binary size drops from ~200MB to under 20MB
- [ ] RAM usage drops from ~100MB to under 40MB
- [ ] GitHub Actions builds all 3 platforms (macOS/Windows/Linux) in a single workflow
- [ ] All existing features preserved: pet window, overlay, tray, drag, customization, auto-updater
- [ ] Frontend (HTML/CSS/JS) unchanged — zero UI rework

## Constraints

- Keep the existing frontend code (index.html, overlay.html, CSS, animations) — it works
- Must build on GitHub Actions (no local-only builds)
- Auto-updater must work via Tauri's built-in plugin (replacing electron-updater)
- System tray countdown, multi-monitor overlay, drag-to-move must all work on both macOS and Windows
- Don't break the existing web landing page (Netlify) or Python backend (FastAPI)

## Out of Scope

- No new features (pure migration)
- No changes to the web landing page or Python image-processing backend
- No iOS/Android support (desktop only)
- No code signing / notarization setup (can be added later)
