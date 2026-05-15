# Phase 1 Plan 1: Foundation Summary

**Scaffolded Tauri 2.x project with all platform builds passing.**

## Accomplishments
- Created `src-tauri/` with Cargo.toml, tauri.conf.json, build.rs, capabilities/, icons/, src/
- Configured borderless transparent always-on-top window (200×260, skip taskbar, macOS accessory mode)
- Set up dependencies: tauri, serde, tokio, dialog, shell, single-instance plugins
- Created GitHub Actions workflow with `tauri-apps/tauri-action` (single matrix, 4 targets)
- Moved frontend assets from root to `web/` directory (Tauri requires separate frontendDist)
- Added `icon.ico` (generated from PNG via Pillow) for Windows/Linux builds
- All 4 CI builds pass: macOS (arm64 + x64), Windows (x64), Ubuntu (x64)

## Files Created/Modified
- `src-tauri/Cargo.toml` — Rust dependencies
- `src-tauri/tauri.conf.json` — Tauri config (window, bundle, plugins)
- `src-tauri/build.rs` — Tauri build script
- `src-tauri/capabilities/default.json` — Window/dialog/shell permissions
- `src-tauri/src/main.rs` — Entry point
- `src-tauri/src/lib.rs` — App setup (Accessory policy, window show)
- `src-tauri/icons/icon.icns` — macOS icon (from build/)
- `src-tauri/icons/icon.png` — Linux icon (from assets/)
- `src-tauri/icons/icon.ico` — Windows icon (generated from PNG)
- `.github/workflows/build.yml` — CI workflow (replaces old electron-builder workflow)
- `.gitignore` — Added src-tauri/target/, Cargo.lock
- `web/` — Moved all frontend files here (index.html, overlay.html, assets/, etc.)

## Decisions
- **Frontend in `web/` directory**: Tauri's `frontendDist` cannot point to project root if `src-tauri/` exists there. Moved all web assets to `web/`.
- **No updater plugin yet**: `tauri-plugin-updater` with reqwest pulls in heavy dependencies that caused OOM on local build. Added in Phase 3.
- **macOS Accessory activation policy**: Hides dock icon, makes it a menu-bar-only app (matches Electron behavior).

## Issues Encountered
- `src-tauri/target/` grew to 23GB from failed local Rust builds — added to .gitignore
- Tauri build refused to include `src-tauri/` in frontendDist — moved frontend to `web/`
- Missing `icon.ico` caused Windows/Linux CI failures — generated from PNG using Pillow
- Local Rust build kept timing out/OOM — switched to CI-only builds

## Next Step
Ready for Phase 1 Plan 2 (port config + window management) — already completed in same session.
