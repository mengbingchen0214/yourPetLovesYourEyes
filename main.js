const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ===================== 配置持久化 =====================
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); }
  catch { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config), 'utf8');
}

let userConfig = {};

// ===================== 常量定义 =====================
const STATE = {
  GREETING: 'greeting',    // 打招呼状态
  SLEEPING: 'sleeping',   // 睡觉状态
  RESTING: 'resting',     // 休息状态
  PAUSED: 'paused'        // 暂停状态
};

const SLEEP_DURATION = 20 * 60 * 1000;  // 20分钟睡觉
const REST_DURATION = 20 * 1000;        // 20秒休息

// ===================== 全局变量 =====================
let win = null;
let tray = null;
let overlayWins = [];
let petState = STATE.GREETING;
let sleepTimer = null;
let restTimer = null;
let sleepProgressInterval = null;
let trayCountdownInterval = null;
let sleepEndAt = 0;
let restEndAt = 0;
let pausedFromState = STATE.SLEEPING;
let pausedRemainingMs = 0;
let isPaused = false;
let overlayEnabled = true;
let cycleCount = 0;        // 完成的护眼次数

// ===================== 工具函数 =====================
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

function moveToCenter() {
  if (!win) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const petWidth = 200;
  const petHeight = 200;
  
  win.setPosition(
    Math.floor((width - petWidth) / 2),
    Math.floor((height - petHeight) / 2)
  );
}

// ===================== 窗口创建 =====================
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

function createOverlayWindows() {
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
    ow.loadFile('overlay.html');
    ow.hide();

    ow.on('closed', () => {
      overlayWins = overlayWins.filter(w => w !== ow);
    });

    overlayWins.push(ow);
  }
}

function showOverlay() {
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

// ===================== 系统托盘 =====================
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let icon;

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

  // 托盘图标自适应：先居中裁成正方形，再缩放到系统推荐尺寸（避免拉伸变形）
  if (!icon.isEmpty()) {
    const size = icon.getSize();
    const square = Math.min(size.width, size.height);
    const cropX = Math.max(0, Math.floor((size.width - square) / 2));
    const cropY = Math.max(0, Math.floor((size.height - square) / 2));

    icon = icon.crop({ x: cropX, y: cropY, width: square, height: square });

    const targetSize = process.platform === 'darwin' ? 18 : 20;
    icon = icon.resize({ width: targetSize, height: targetSize, quality: 'best' });
  }

  tray = new Tray(icon);
  tray.setToolTip('护眼Pet');
  if (process.platform === 'darwin') {
    tray.setTitle('');
  }

  // 恢复用户自定义顶部图标
  if (userConfig.trayIcon && fs.existsSync(userConfig.trayIcon)) {
    let customIcon = nativeImage.createFromPath(userConfig.trayIcon);
    const s = customIcon.getSize();
    const sq = Math.min(s.width, s.height);
    customIcon = customIcon.crop({ x: Math.floor((s.width - sq) / 2), y: Math.floor((s.height - sq) / 2), width: sq, height: sq });
    customIcon = customIcon.resize({ width: 18, height: 18, quality: 'best' });
    tray.setImage(customIcon);
  }
  // 恢复用户自定义App图标
  if (userConfig.appIcon && fs.existsSync(userConfig.appIcon)) {
    if (app.dock) app.dock.setIcon(nativeImage.createFromPath(userConfig.appIcon));  // appIcon 存的已是本地路径，无需转换
  }

  updateTrayDisplay();
  updateTrayMenu();

  tray.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function getCountdownText() {
  if (petState === STATE.SLEEPING && sleepEndAt > 0) {
    return `倒计时: ${formatRemaining(sleepEndAt - Date.now())}`;
  }
  if (petState === STATE.RESTING && restEndAt > 0) {
    return `倒计时: ${formatRemaining(restEndAt - Date.now())}`;
  }
  if (petState === STATE.PAUSED) {
    return '倒计时: 已暂停';
  }
  return '倒计时: --:--';
}

function getCountdownCompactText() {
  if (petState === STATE.SLEEPING && sleepEndAt > 0) {
    return formatRemaining(sleepEndAt - Date.now());
  }
  if (petState === STATE.RESTING && restEndAt > 0) {
    return formatRemaining(restEndAt - Date.now());
  }
  return '';
}

function updateTrayDisplay() {
  if (!tray || tray.isDestroyed()) return;

  const countdownText = getCountdownText();
  tray.setToolTip(`护眼Pet  ${countdownText}`);

  if (process.platform === 'darwin') {
    tray.setTitle(getCountdownCompactText());
  }
}

function startTrayCountdownTicker() {
  clearInterval(trayCountdownInterval);
  updateTrayDisplay();
  trayCountdownInterval = setInterval(() => {
    if (!tray || tray.isDestroyed()) return;
    if (petState === STATE.SLEEPING || petState === STATE.RESTING) {
      updateTrayDisplay();
      updateTrayMenu();
    }
  }, 1000);
}

function stopTrayCountdownTicker() {
  clearInterval(trayCountdownInterval);
  trayCountdownInterval = null;
  updateTrayDisplay();
}

function updateTrayMenu() {
  updateTrayDisplay();

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示宠物', click: () => { win && win.show(); } },
    { label: '隐藏宠物', click: () => { win && win.hide(); } },
    { type: 'separator' },
    { label: getCountdownText(), enabled: false },
    { type: 'separator' },
    {
      label: '暂停/继续',
      click: () => {
        if (petState === STATE.SLEEPING || petState === STATE.RESTING) {
          pauseCycle();
        } else if (petState === STATE.PAUSED) {
          resumeCycle();
        }
      }
    },
    { label: `屏幕遮罩: ${overlayEnabled ? '开启' : '关闭'}`,
      click: () => {
        overlayEnabled = !overlayEnabled;
        notifyRenderer('overlay-toggle', overlayEnabled);
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    { label: '个性化', submenu: [
      { label: '更换20分钟宠物照', click: () => pickSleepImage() },
      { label: '更换20秒宠物照', click: () => pickRestImage() },
      { label: '更换顶部图标', click: () => pickTrayIcon() },
      { label: '更换App图标', click: () => pickAppIcon() },
      { label: '修改问候语', click: () => setGreetingText() },
    ]},
    { type: 'separator' },
    { label: 'Quit 退出', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setContextMenu(contextMenu);
}

// ===================== 状态机逻辑 =====================
function startGreeting() {
  petState = STATE.GREETING;
  sleepEndAt = 0;
  restEndAt = 0;
  stopTrayCountdownTicker();
  hideOverlay();
  notifyRenderer('state-change', { state: petState, cycleCount });
  updateTrayMenu();
}

function startSleeping() {
  petState = STATE.SLEEPING;
  isPaused = false;
  sleepEndAt = Date.now() + SLEEP_DURATION;
  restEndAt = 0;
  startTrayCountdownTicker();
  hideOverlay();
  notifyRenderer('state-change', { state: petState, cycleCount });
  updateTrayMenu();

  // 随机位置
  const pos = getRandomPosition();
  if (win) {
    win.setPosition(pos.x, pos.y);
  }

  // 开始20分钟倒计时
  clearTimeout(sleepTimer);
  clearInterval(sleepProgressInterval);

  sleepTimer = setTimeout(() => {
    if (!isPaused) {
      startResting();
    }
  }, SLEEP_DURATION);

  // 发送进度更新（每分钟）
  let minutesLeft = 20;
  sleepProgressInterval = setInterval(() => {
    if (petState !== STATE.SLEEPING || isPaused) {
      clearInterval(sleepProgressInterval);
      sleepProgressInterval = null;
      return;
    }

    minutesLeft = Math.max(0, minutesLeft - 1);
    notifyRenderer('progress-update', { minutesLeft, total: 20 });

    if (minutesLeft <= 0) {
      clearInterval(sleepProgressInterval);
      sleepProgressInterval = null;
    }
  }, 60000);
}

function startResting() {
  petState = STATE.RESTING;
  sleepEndAt = 0;
  restEndAt = Date.now() + REST_DURATION;
  startTrayCountdownTicker();
  clearInterval(sleepProgressInterval);
  sleepProgressInterval = null;
  cycleCount++;
  showOverlay();
  notifyRenderer('state-change', {
    state: petState,
    cycleCount,
    restImage: 'assets/angel——wakeup.png'
  });
  updateTrayMenu();

  // 移动到屏幕中央
  moveToCenter();

  // 20秒休息
  clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    if (petState === STATE.RESTING) {
      startSleeping();
    }
  }, REST_DURATION);
}

function pauseResumeMs() {
  if (petState === STATE.SLEEPING) {
    return Math.max(1000, sleepEndAt - Date.now());
  }
  if (petState === STATE.RESTING) {
    return Math.max(1000, restEndAt - Date.now());
  }
  return SLEEP_DURATION;
}

function pauseCycle() {
  if (petState === STATE.SLEEPING || petState === STATE.RESTING) {
    pausedFromState = petState;
    pausedRemainingMs = pauseResumeMs();
    isPaused = true;
    petState = STATE.PAUSED;

    clearTimeout(sleepTimer);
    clearTimeout(restTimer);
    clearInterval(sleepProgressInterval);
    sleepProgressInterval = null;

    sleepEndAt = 0;
    restEndAt = 0;
    stopTrayCountdownTicker();
    hideOverlay();

    notifyRenderer('state-change', { state: petState, cycleCount });
    updateTrayMenu();
  }
}

function startSleepingFor(ms) {
  petState = STATE.SLEEPING;
  isPaused = false;
  sleepEndAt = Date.now() + ms;
  restEndAt = 0;
  startTrayCountdownTicker();
  hideOverlay();
  notifyRenderer('state-change', { state: petState, cycleCount });
  updateTrayMenu();

  const pos = getRandomPosition();
  if (win) {
    win.setPosition(pos.x, pos.y);
  }

  clearTimeout(sleepTimer);
  clearInterval(sleepProgressInterval);

  sleepTimer = setTimeout(() => {
    if (!isPaused) {
      startResting();
    }
  }, Math.max(1000, ms));

  sleepProgressInterval = setInterval(() => {
    if (petState !== STATE.SLEEPING || isPaused) {
      clearInterval(sleepProgressInterval);
      sleepProgressInterval = null;
      return;
    }

    const leftMs = Math.max(0, sleepEndAt - Date.now());
    const minutesLeft = Math.ceil(leftMs / 60000);
    notifyRenderer('progress-update', { minutesLeft, total: 20 });

    if (leftMs <= 0) {
      clearInterval(sleepProgressInterval);
      sleepProgressInterval = null;
    }
  }, 1000);
}

function startRestingFor(ms) {
  petState = STATE.RESTING;
  sleepEndAt = 0;
  restEndAt = Date.now() + ms;
  startTrayCountdownTicker();
  clearInterval(sleepProgressInterval);
  sleepProgressInterval = null;
  showOverlay();

  notifyRenderer('state-change', {
    state: petState,
    cycleCount,
    restImage: 'assets/angel——wakeup.png'
  });
  updateTrayMenu();

  moveToCenter();

  clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    if (petState === STATE.RESTING) {
      startSleeping();
    }
  }, Math.max(1000, ms));
}

function resumeCycle() {
  if (petState !== STATE.PAUSED) return;

  if (pausedFromState === STATE.RESTING) {
    startRestingFor(pausedRemainingMs || REST_DURATION);
  } else {
    startSleepingFor(pausedRemainingMs || SLEEP_DURATION);
  }

  pausedRemainingMs = 0;
}

// ===================== 通知渲染进程 =====================
function notifyRenderer(channel, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

// ===================== IPC 通信 =====================
const { ipcMain } = require('electron');

ipcMain.handle('start-cycle', () => {
  startSleeping();
  return { success: true };
});

ipcMain.handle('pause-cycle', () => {
  pauseCycle();
  return { success: true };
});

ipcMain.handle('resume-cycle', () => {
  resumeCycle();
  return { success: true };
});

ipcMain.handle('toggle-overlay', () => {
  overlayEnabled = !overlayEnabled;
  if (!overlayEnabled) {
    hideOverlay();
  } else if (petState === STATE.RESTING) {
    showOverlay();
  }
  notifyRenderer('overlay-toggle', overlayEnabled);
  updateTrayMenu();
  return { enabled: overlayEnabled };
});

ipcMain.handle('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('get-state', () => {
  return {
    state: petState,
    cycleCount,
    overlayEnabled,
    isPaused
  };
});

const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp' };

function toDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'image/png';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

ipcMain.handle('get-config', () => {
  return {
    sleepImage: toDataUrl(userConfig.sleepImage),
    restImage: toDataUrl(userConfig.restImage),
    greetingText: userConfig.greetingText ?? '我是安球，阿弥陀佛。',
  };
});

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
  fs.copyFileSync(filePaths[0], dest);
  userConfig[configKey] = dest;
  saveConfig(userConfig);
  return toDataUrl(dest);
}

async function pickSleepImage() {
  const imagePath = await pickImageFor('sleepImage', '选择睡觉图片（20分钟）');
  if (imagePath) notifyRenderer('config-change', { sleepImage: imagePath });
}

async function pickRestImage() {
  const imagePath = await pickImageFor('restImage', '选择休息图片（20秒）');
  if (imagePath) notifyRenderer('config-change', { restImage: imagePath });
}

async function pickTrayIcon() {
  const imagePath = await pickImageFor('trayIcon', '选择顶部图标');
  if (!imagePath) return;
  const localPath = new URL(imagePath).pathname;
  let icon = nativeImage.createFromPath(localPath);
  const size = icon.getSize();
  const square = Math.min(size.width, size.height);
  icon = icon.crop({ x: Math.floor((size.width - square) / 2), y: Math.floor((size.height - square) / 2), width: square, height: square });
  icon = icon.resize({ width: 18, height: 18, quality: 'best' });
  tray.setImage(icon);
}

async function pickAppIcon() {
  const imagePath = await pickImageFor('appIcon', '选择App图标');
  if (!imagePath) return;
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

async function setGreetingText() {
  const value = await showTextInputDialog(userConfig.greetingText || '我是安球，阿弥陀佛。');
  if (value === null) return;
  userConfig.greetingText = value;
  saveConfig(userConfig);
  notifyRenderer('config-change', { greetingText: value });
}

ipcMain.handle('pick-sleep-image', () => pickSleepImage());
ipcMain.handle('pick-rest-image', () => pickRestImage());
ipcMain.handle('pick-tray-icon', () => pickTrayIcon());
ipcMain.handle('pick-app-icon', () => pickAppIcon());
ipcMain.handle('set-greeting-text', () => setGreetingText());

// ===================== 窗口拖动 =====================
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
});

// ===================== 生命周期 =====================
app.whenReady().then(() => {
  userConfig = loadConfig();
  if (app.dock) app.dock.setIcon(path.join(__dirname, 'build', 'angelicon.PNG'));
  createWindow();
  createTray();
  
  startGreeting();

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
  clearTimeout(sleepTimer);
  clearTimeout(restTimer);
  clearInterval(sleepProgressInterval);
  sleepProgressInterval = null;
  stopTrayCountdownTicker();
  sleepEndAt = 0;
  restEndAt = 0;
  hideOverlay();
  for (const ow of overlayWins) {
    if (ow && !ow.isDestroyed()) {
      ow.close();
    }
  }
  overlayWins = [];
  globalShortcut.unregisterAll();
});
