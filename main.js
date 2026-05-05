const { app, BrowserWindow, globalShortcut, screen, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { loadConfig, saveConfig } = require('./lib/config');
const { STATE, MIME_TYPES } = require('./lib/constants');
const overlayManager = require('./lib/overlay-manager');
const trayManager = require('./lib/tray-manager');
const stateMachine = require('./lib/state-machine');
const license = require('./lib/license');
const happiness = require('./lib/happiness');

let userConfig = {};
let win = null;
let sm = null;

const ctx = {
  get win() { return win; },
  get petState() { return ctx._petState; },
  set petState(v) { ctx._petState = v; },
  _petState: STATE.GREETING,
  get overlayEnabled() { return ctx._overlayEnabled; },
  set overlayEnabled(v) { ctx._overlayEnabled = v; },
  _overlayEnabled: true,
  get isPaused() { return ctx._isPaused; },
  set isPaused(v) { ctx._isPaused = v; },
  _isPaused: false,
  get cycleCount() { return ctx._cycleCount; },
  set cycleCount(v) { ctx._cycleCount = v; },
  _cycleCount: 0,
  sleepEndAt: 0,
  restEndAt: 0,
  pausedFromState: STATE.SLEEPING,
  pausedRemainingMs: 0,
  savedPosition: null,
  get userConfig() { return userConfig; },
  notifyRenderer: (channel, data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  },
  updateTrayMenu: () => trayManager.updateTrayMenu(ctx),
  pickSleepImage: () => _pickSleepImage(),
  pickRestImage: () => _pickRestImage(),
  pickTrayIcon: () => _pickTrayIcon(),
  pickAppIcon: () => _pickAppIcon(),
  setGreetingText: () => _setGreetingText(),
  pauseCycle: () => sm && sm.pauseCycle(),
  resumeCycle: () => sm && sm.resumeCycle()
};

function getRandomPosition() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const petWidth = 200;
  const petHeight = 200;
  const margin = 100;

  return {
    x: margin + Math.floor(Math.random() * (width - petWidth - margin * 2)),
    y: margin + Math.floor(Math.random() * (height - petHeight - margin * 2))
  };
}

function createWindow() {
  const pos = getRandomPosition();

  win = new BrowserWindow({
    width: 200,
    height: 260,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('index.html');
  }

  win.on('closed', () => {
    win = null;
  });
}

function toDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'image/png';
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch (err) {
    console.error('[EyePet] Failed to read image file:', filePath, err.message);
    return null;
  }
}

async function pickImageFor(configKey, title) {
  if (win) { win.show(); win.focus(); }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title,
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const ext = path.extname(filePaths[0]).toLowerCase();
  const dest = path.join(app.getPath('userData'), `${configKey}${ext}`);
  try {
    fs.copyFileSync(filePaths[0], dest);
  } catch (err) {
    console.error('[EyePet] Failed to copy image file:', err.message);
    return null;
  }
  userConfig[configKey] = dest;
  saveConfig(userConfig);
  return toDataUrl(dest);
}

async function _pickSleepImage() {
  if (!license.isFeatureAvailable('custom-pet')) {
    ctx.notifyRenderer('upgrade-prompt', { feature: 'custom-pet' });
    return;
  }
  const imagePath = await pickImageFor('sleepImage', '选择睡觉图片（20分钟）');
  if (imagePath) ctx.notifyRenderer('config-change', { sleepImage: imagePath });
}

async function _pickRestImage() {
  if (!license.isFeatureAvailable('custom-pet')) {
    ctx.notifyRenderer('upgrade-prompt', { feature: 'custom-pet' });
    return;
  }
  const imagePath = await pickImageFor('restImage', '选择休息图片（20秒）');
  if (imagePath) ctx.notifyRenderer('config-change', { restImage: imagePath });
}

async function _pickTrayIcon() {
  const imagePath = await pickImageFor('trayIcon', '选择顶部图标');
  if (!imagePath) return;
  const { nativeImage } = require('electron');
  const localPath = new URL(imagePath).pathname;
  let icon = nativeImage.createFromPath(localPath);
  const size = icon.getSize();
  const square = Math.min(size.width, size.height);
  icon = icon.crop({ x: Math.floor((size.width - square) / 2), y: Math.floor((size.height - square) / 2), width: square, height: square });
  icon = icon.resize({ width: 18, height: 18, quality: 'best' });
  trayManager.setImage(icon);
}

async function _pickAppIcon() {
  const imagePath = await pickImageFor('appIcon', '选择App图标');
  if (!imagePath) return;
  const { nativeImage } = require('electron');
  const localPath = new URL(imagePath).pathname;
  if (app.dock) app.dock.setIcon(nativeImage.createFromPath(localPath));
}

function showTextInputDialog(currentValue) {
  if (win) { win.show(); win.focus(); }
  return new Promise((resolve) => {
    const dlg = new BrowserWindow({
      width: 340, height: 130,
      title: '修改问候语',
      resizable: false, minimizable: false, maximizable: false,
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, 'dialog-preload.js'),
        contextIsolation: true, nodeIntegration: false,
      }
    });
    dlg.setMenuBarVisibility(false);
    dlg.loadFile('input-dialog.html');
    dlg.once('ready-to-show', () => {
      dlg.show();
      dlg.webContents.send('text-input-init', { value: currentValue });
    });
    function cleanup() {
      ipcMain.removeListener('text-input-result', onResult);
      ipcMain.removeListener('text-input-cancel', onCancel);
      if (!dlg.isDestroyed()) dlg.close();
    }
    function onResult(_, value) { resolve(value); cleanup(); }
    function onCancel() { resolve(null); cleanup(); }
    ipcMain.once('text-input-result', onResult);
    ipcMain.once('text-input-cancel', onCancel);
    dlg.on('closed', () => resolve(null));
  });
}

async function _setGreetingText() {
  const value = await showTextInputDialog(userConfig.greetingText || '我是安球，阿弥陀佛。');
  if (value === null) return;
  userConfig.greetingText = value;
  saveConfig(userConfig);
  ctx.notifyRenderer('config-change', { greetingText: value });
}

let dragState = { isDragging: false, x: 0, y: 0 };

ipcMain.on('start-drag', (event, { x, y }) => {
  if (!win) return;
  dragState.isDragging = true;
  const point = screen.getCursorScreenPoint();
  dragState.x = point.x - win.getPosition()[0];
  dragState.y = point.y - win.getPosition()[1];
});

ipcMain.on('drag', (event, { x, y }) => {
  if (!win || !dragState.isDragging) return;
  win.setPosition(x - dragState.x, y - dragState.y);
});

ipcMain.on('end-drag', () => {
  dragState.isDragging = false;
  const pos = win ? win.getPosition() : null;
  if (pos) {
    ctx.savedPosition = { x: pos[0], y: pos[1] };
    saveConfig({ ...userConfig, savedPosition: ctx.savedPosition });
  }
});

ipcMain.handle('start-cycle', () => {
  sm.startSleeping();
  return { success: true };
});

ipcMain.handle('pause-cycle', () => {
  sm.pauseCycle();
  return { success: true };
});

ipcMain.handle('resume-cycle', () => {
  sm.resumeCycle();
  return { success: true };
});

ipcMain.handle('toggle-overlay', () => {
  ctx.overlayEnabled = !ctx.overlayEnabled;
  if (!ctx.overlayEnabled) {
    overlayManager.hideOverlay();
  } else if (ctx.petState === STATE.RESTING) {
    overlayManager.showOverlay(ctx.overlayEnabled);
  }
  ctx.notifyRenderer('overlay-toggle', ctx.overlayEnabled);
  trayManager.updateTrayMenu(ctx);
  return { enabled: ctx.overlayEnabled };
});

ipcMain.handle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('get-state', () => {
  return {
    state: ctx.petState,
    cycleCount: ctx.cycleCount,
    overlayEnabled: ctx.overlayEnabled,
    isPaused: ctx.isPaused
  };
});

ipcMain.handle('get-config', () => {
  return {
    sleepImage: toDataUrl(userConfig.sleepImage),
    restImage: toDataUrl(userConfig.restImage),
    greetingText: userConfig.greetingText ?? '我是安球，阿弥陀佛。',
  };
});

ipcMain.handle('pick-sleep-image', () => _pickSleepImage());
ipcMain.handle('pick-rest-image', () => _pickRestImage());
ipcMain.handle('pick-tray-icon', () => _pickTrayIcon());
ipcMain.handle('pick-app-icon', () => _pickAppIcon());
ipcMain.handle('set-greeting-text', () => _setGreetingText());

ipcMain.handle('get-license-info', () => {
  const tier = license.getTier();
  return {
    tier,
    isPro: tier === license.TIER.PRO,
    isTrial: tier === license.TIER.TRIAL,
    isFree: tier === license.TIER.FREE,
    trialInfo: license.getTrialInfo(),
    proFeatures: license.PRO_FEATURES.map(f => ({
      name: f,
      available: license.isFeatureAvailable(f)
    }))
  };
});

ipcMain.handle('activate-license', async (_, key) => {
  const result = await license.activateLicense(key);
  if (result.success) {
    ctx.notifyRenderer('license-change', { tier: result.tier });
    trayManager.updateTrayMenu(ctx);
  }
  return result;
});

ipcMain.handle('check-feature', (_, featureName) => {
  return { available: license.isFeatureAvailable(featureName) };
});

ipcMain.handle('show-license-dialog', () => {
  if (win) { win.show(); win.focus(); }
  return new Promise((resolve) => {
    const dlg = new BrowserWindow({
      width: 360, height: 140,
      title: '激活 Pro',
      resizable: false, minimizable: false, maximizable: false,
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, 'dialog-preload.js'),
        contextIsolation: true, nodeIntegration: false,
      }
    });
    dlg.setMenuBarVisibility(false);
    dlg.loadFile('input-dialog.html');
    dlg.once('ready-to-show', () => {
      dlg.show();
      dlg.webContents.send('text-input-init', { value: '', placeholder: 'xxxx-xxxx-xxxx-xxxx' });
    });
    function cleanup() {
      ipcMain.removeListener('text-input-result', onResult);
      ipcMain.removeListener('text-input-cancel', onCancel);
      if (!dlg.isDestroyed()) dlg.close();
    }
    function onResult(_, value) { resolve(value || null); cleanup(); }
    function onCancel() { resolve(null); cleanup(); }
    ipcMain.once('text-input-result', onResult);
    ipcMain.once('text-input-cancel', onCancel);
    dlg.on('closed', () => resolve(null));
  });
});

ipcMain.handle('open-external', (_, url) => {
  if (url) shell.openExternal(url);
});

const PAYMENT_URLS = {
  'buy-alipay': 'https://eyepet.lemonsqueezy.com/checkout/buy/PRO_VARIANT_ID',
  'buy-wechat': 'https://eyepet.lemonsqueezy.com/checkout/buy/PRO_VARIANT_ID',
  'buy-intl': 'https://eyepet.lemonsqueezy.com/checkout/buy/PRO_VARIANT_ID'
};

// Backup: afdian.com (爱发电) for WeChat Pay in China
// 'buy-wechat': 'https://afdian.com/a/YOUR_USERNAME?pay_type=wx',
// Note: Create afdian account and replace YOUR_USERNAME with your page username

ipcMain.handle('show-upgrade-dialog', () => {
  if (win) { win.show(); win.focus(); }
  return new Promise((resolve) => {
    const dlg = new BrowserWindow({
      width: 340,
      height: 530,
      title: '升级到 Pro - EyePet',
      resizable: false,
      minimizable: false,
      maximizable: false,
      modal: false,
      parent: win,
      webPreferences: {
        preload: path.join(__dirname, 'dialog-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      }
    });
    dlg.setMenuBarVisibility(false);
    dlg.loadFile('upgrade-dialog.html');

    function cleanup() {
      ipcMain.removeListener('upgrade-action', onAction);
      if (!dlg.isDestroyed()) dlg.close();
    }

    function onAction(_, action) {
      if (action.startsWith('buy-')) {
        const url = PAYMENT_URLS[action];
        if (url) shell.openExternal(url);
      } else if (action === 'activate') {
        if (!dlg.isDestroyed()) dlg.close();
        resolve({ action: 'activate' });
        return;
      }
    }

    ipcMain.on('upgrade-action', onAction);
    dlg.on('closed', () => { resolve(null); cleanup(); });
    dlg.once('ready-to-show', () => dlg.show());
  });
});

ipcMain.handle('get-happiness-status', () => {
  return happiness.getStatus();
});

ipcMain.handle('set-pet-name', (_, name) => {
  if (!license.isFeatureAvailable('pet-name')) {
    return { success: false, error: 'Pro feature' };
  }
  happiness.setPetName(name);
  ctx.notifyRenderer('happiness-change', happiness.getStatus());
  return { success: true, name: happiness.getPetName() };
});

ipcMain.handle('validate-online', async () => {
  return await license.validateOnline();
});

ipcMain.handle('deactivate-license', async () => {
  const result = await license.deactivateLicense();
  if (result.success) {
    ctx.notifyRenderer('license-change', { tier: 'free' });
    trayManager.updateTrayMenu(ctx);
  }
  return result;
});

app.whenReady().then(() => {
  app.setName('EyePet');
  userConfig = loadConfig();
  license.setConfigPath(app.getPath('userData'));
  license.initTrial();
  happiness.setConfigPath(app.getPath('userData'));
  if (userConfig.savedPosition) {
    ctx.savedPosition = userConfig.savedPosition;
  }
  if (app.dock) app.dock.setIcon(path.join(__dirname, 'build', 'angelicon.PNG'));
  createWindow();
  trayManager.createTray(ctx);

  sm = stateMachine.create(ctx);
  sm.startGreeting();

  ipcMain.on('state-change', (_, data) => {
    switch (data.state) {
      case 'sleeping':
        happiness.addEvent('cycle-started');
        break;
      case 'resting':
        happiness.addEvent('rest-completed');
        break;
      case 'paused':
        happiness.addEvent('paused');
        break;
    }
    ctx.notifyRenderer('happiness-change', happiness.getStatus());
  });

  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (sm) sm.destroy();
  trayManager.stopTrayCountdownTicker(ctx);
  ctx.sleepEndAt = 0;
  ctx.restEndAt = 0;
  overlayManager.hideOverlay();
  overlayManager.destroyAll();
  globalShortcut.unregisterAll();
});
