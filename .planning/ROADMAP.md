# Roadmap: EyePet Electron → Tauri Migration

## Overview

Migrate the EyePet desktop app from Electron to Tauri in 4 phases. The frontend (HTML/CSS/JS) stays unchanged. The backend (state machine, timers, tray, overlay, config, IPC) gets rewritten in Rust using Tauri's APIs. CI/CD gets simplified to a single Tauri GitHub Action.

## Phases

- [ ] **Phase 1: Foundation** — Scaffold Tauri project, port config + window management
- [ ] **Phase 2: Core Logic** — Port state machine, timers, overlay, drag system
- [ ] **Phase 3: Tray & Polish** — Port tray menu, dialogs, auto-updater, donation dialog
- [ ] **Phase 4: CI/CD & Testing** — GitHub Actions workflow, cross-platform testing, release

## Phase Details

### Phase 1: Foundation
**Goal**: Tauri project scaffolded, builds and runs, basic window + config working
**Depends on**: Nothing (first phase)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Scaffold Tauri project structure (Cargo.toml, tauri.conf.json, src-tauri/)
- [ ] 01-02: Port config I/O and pet window creation (transparent, always-on-top)

### Phase 2: Core Logic
**Goal**: State machine, timers, multi-monitor overlay, drag-to-move all working
**Depends on**: Phase 1
**Plans**: 2 plans

Plans:
- [ ] 02-01: Port state machine (GREETING/SLEEPING/RESTING/PAUSED) + timers
- [ ] 02-02: Port overlay manager (multi-monitor) + drag-to-move system

### Phase 3: Tray & Polish
**Goal**: System tray with countdown, all dialogs, auto-updater, donation dialog
**Depends on**: Phase 2
**Plans**: 2 plans

Plans:
- [ ] 03-01: Port tray manager (menu, countdown ticker, pause/resume, overlay toggle)
- [ ] 03-02: Port dialogs (text input, donation, upgrade) + auto-updater

### Phase 4: CI/CD & Testing
**Goal**: GitHub Actions builds all 3 platforms, release workflow, smoke testing
**Depends on**: Phase 3
**Plans**: 2 plans

Plans:
- [ ] 04-01: GitHub Actions workflow with Tauri action (macOS/Windows/Linux matrix)
- [ ] 04-02: Smoke test on each platform, fix platform-specific issues, tag release

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Core Logic | 0/2 | Not started | - |
| 3. Tray & Polish | 0/2 | Not started | - |
| 4. CI/CD & Testing | 0/2 | Not started | - |
