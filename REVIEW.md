# Project Review: 护眼Pet (EyePet)

## What It Is
A macOS desktop pet application built with **Electron** that reminds users to rest their eyes every 20 minutes (20-20-20 rule). The pet floats on the desktop, and when it's time for a break, it moves to screen center with a full-screen overlay. Users can customize the pet's appearance with their own pet photos, which can be Q-version processed via a Python/FastAPI backend.

---

## Strengths

1. **Well-structured state machine**: `main.js` implements a clean 4-state FSM (`GREETING -> SLEEPING -> RESTING -> PAUSED`) with proper timer management, pause/resume with remaining time preservation.

2. **Security-conscious IPC design**: `preload.js` uses `contextBridge` with `contextIsolation: true` and `nodeIntegration: false` - follows Electron security best practices.

3. **Multi-monitor support**: `overlay.html` creates per-display overlay windows via `screen.getAllDisplays()`, covering all monitors.

4. **Good separation of concerns**: Main process (state/timers/tray), renderer (UI/animations), preload (IPC bridge), dialog (input modal) - each has its own file.

5. **Comprehensive spec document**: `SPEC.md` is detailed with product vision, feature list, tech stack, business model, and roadmap - excellent product thinking.

6. **Personalization system**: Tray menu supports custom sleep/rest images, tray icon, app icon, and greeting text - all persisted to `config.json`.

7. **Tray countdown display**: Real-time countdown shown in both tooltip and macOS menu bar title (`tray.setTitle()`).

---

## Issues & Areas for Improvement

### Critical / High Priority

| # | Issue | Location | Details |
|---|-------|----------|---------|
| 1 | **Hardcoded image path with special character** | `main.js`, `index.html` | `'assets/angel-wakeup.png'` uses an em dash instead of hyphen in the filename. This is fragile and error-prone across different filesystems/encodings. |
| 2 | **No error handling in config I/O** | `main.js` | `loadConfig()` silently catches all errors returning `{}`; `saveConfig()` has no try/catch at all - a disk write failure would crash the app. |
| 3 | **Memory leak risk - overlay windows not cleaned up on quit** | `main.js` | `before-quit` handler iterates `overlayWins` but doesn't call `.close()` or `.destroy()` on them. |
| 4 | **Timer leaks possible** | `main.js` | Multiple `setTimeout`/`setInterval` calls (`sleepTimer`, `restTimer`, `sleepProgressInterval`, `trayCountdownInterval`) - if state transitions happen rapidly, old timers may not be fully cleared. |
| 5 | **CORS wildcard `allow_origins=["*"]`** | `backend/server.py` | Accepting all origins is fine for dev but risky if deployed publicly. No rate limiting either. |

### Medium Priority

| # | Issue | Location | Details |
|---|-------|----------|---------|
| 6 | **No drag position persistence** | `main.js` | User can drag the pet but position resets on each SLEEPING cycle (`getRandomPosition()`). SPEC Phase 2 lists this as TODO but it's a noticeable UX gap. |
| 7 | **`src/` directory appears to be a duplicate/outdated copy** | `src/` | Contains its own `main.js`, `index.html`, `preload.js`, `package.json` - looks like an old or alternative version. Should be removed or clearly documented. |
| 8 | **`test.js` is a manual diagnostic script, not automated tests** | `test.js` | No unit tests, no integration tests. For a state machine app, testing state transitions is critical. |
| 9 | **Web landing page has non-functional demo** | `web/index.html` | The Q-version preview just shows the original image twice - doesn't actually call the backend API. External image URLs (freepik) may also break. |
| 10 | **Large main.js (~750 lines)** | `main.js` | All logic (state machine, tray, timers, IPC, dialogs, window management) in one file. Could benefit from splitting into modules (e.g., `StateManager.js`, `TrayManager.js`, `OverlayManager.js`). |
| 11 | **`.gitignore` missing common entries** | `.gitignore` | Missing: `dist/`, `*.dmg`, `userData/`, environment files like `.env`. |

### Low Priority / Nice to Have

| # | Issue | Details |
|---|-------|---------|
| 12 | **No logging system** | All output relies on `console.log`/`console.error`. A structured logger would help production debugging. |
| 13 | **No auto-launch/login-item setup** | SPEC mentions this as Phase 2. Users need to manually start the app each time. |
| 14 | **Configurable reminder interval hardcoded** | Only 20min/20sec. SPEC Phase 2 lists configurable intervals (15/20/30/45/60 min). |
| 15 | **Package.json uses Chinese in `description`** | Works fine, but mixed language metadata can cause issues with some tooling. |
| 16 | **`pnpm-workspace.yaml` exists but workspace isn't used meaningfully** | Root + `src/package.json` suggest monorepo intent, but `src/` seems like a leftover. |

---

## Architecture Assessment

```
+---------------------------------------------+
|                  main.js                     |
|  State Machine | Tray | Timers | IPC Handler  |
|         ~750 lines, single file              |
+--------------+--------------+----------------+
|   preload.js |dialog-preload|  overlay.html  |
|  IPC Bridge  |  IPC Bridge  |  Full-screen    |
+--------------+--------------+----------------+
|              index.html                      |
|     Pet UI | Animations | Drag | Bubble      |
+----------------------------------------------+
|          backend/server.py (FastAPI)          |
|       rembg + Pillow Q-version processing     |
+----------------------------------------------+
|            web/index.html (Netlify)           |
|              Landing page (static)             |
+----------------------------------------------+
```

**Verdict**: Functional and well-conceived for a Phase 1 MVP. The core eye-care reminder loop works correctly. The biggest technical debt is the monolithic `main.js` and lack of tests.

---

## Recommendations (Priority Order)

1. **Rename** `angel-wakeup.png` -> `angel-wakeup.png` (avoid Unicode-in-path issues)
2. **Add try/catch** around `saveConfig()` and all fs operations
3. **Properly destroy overlay windows** in `before-quit`
4. **Split `main.js`** into modules (State, Tray, Overlay, Config)
5. **Add unit tests** for the state machine (at minimum)
6. **Remove or document** the `src/` directory
7. **Wire up the web demo** to actually call the backend API (or remove the fake preview)
8. **Persist drag position** so users don't lose their pet placement

---

*Review generated on 2026-05-05*
