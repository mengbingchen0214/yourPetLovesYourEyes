const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');

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

  const overlayHtml = `
    <html>
      <body style="margin:0;width:100vw;height:100vh;background:rgba(128,128,128,0.55);"></body>
    </html>
  `;
  const overlayDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`;

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
    ow.loadURL(overlayDataUrl);
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
