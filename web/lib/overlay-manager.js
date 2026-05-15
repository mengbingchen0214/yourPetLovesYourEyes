const path = require('path');

let BrowserWindow, screen;

try {
  const electron = require('electron');
  BrowserWindow = electron.BrowserWindow;
  screen = electron.screen;
} catch {
  BrowserWindow = null;
  screen = null;
}

let overlayWins = [];

function createOverlayWindows() {
  if (!BrowserWindow || !screen) return;
  overlayWins = overlayWins.filter(w => w && !w.isDestroyed());
  if (overlayWins.length > 0) return;

  for (const display of screen.getAllDisplays()) {
    const { x, y, width, height } = display.bounds;
    const ow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      fullscreen: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      movable: false,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      }
    });

    ow.setIgnoreMouseEvents(true, { forward: true });
    ow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    ow.setAlwaysOnTop(true, 'screen-saver');
    ow.loadFile(path.join(__dirname, '..', 'overlay.html'));
    ow.hide();

    ow.on('closed', () => {
      overlayWins = overlayWins.filter(w => w !== ow);
    });

    overlayWins.push(ow);
  }
}

function showOverlay(overlayEnabled) {
  if (!overlayEnabled) return;
  createOverlayWindows();
  for (const ow of overlayWins) {
    if (ow && !ow.isDestroyed()) {
      ow.showInactive();
    }
  }
}

function hideOverlay() {
  for (const ow of overlayWins) {
    if (ow && !ow.isDestroyed()) {
      ow.hide();
    }
  }
}

function destroyAll() {
  for (const ow of overlayWins) {
    if (ow && !ow.isDestroyed()) {
      ow.destroy();
    }
  }
  overlayWins = [];
}

module.exports = { createOverlayWindows, showOverlay, hideOverlay, destroyAll };
