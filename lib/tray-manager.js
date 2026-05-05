const path = require('path');
const fs = require('fs');
const { STATE } = require('./constants');

let Tray, Menu, nativeImage, app;

try {
  const electron = require('electron');
  Tray = electron.Tray;
  Menu = electron.Menu;
  nativeImage = electron.nativeImage;
  app = electron.app;
} catch {
  Tray = null;
  Menu = null;
  nativeImage = null;
  app = null;
}

let tray = null;
let trayCountdownInterval = null;

function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function getCountdownText(ctx) {
  const { petState, sleepEndAt, restEndAt } = ctx;
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

function getCountdownCompactText(ctx) {
  const { petState, sleepEndAt, restEndAt } = ctx;
  if (petState === STATE.SLEEPING && sleepEndAt > 0) {
    return formatRemaining(sleepEndAt - Date.now());
  }
  if (petState === STATE.RESTING && restEndAt > 0) {
    return formatRemaining(restEndAt - Date.now());
  }
  return '';
}

function updateTrayDisplay(ctx) {
  if (!tray || tray.isDestroyed()) return;

  const countdownText = getCountdownText(ctx);
  tray.setToolTip(`护眼Pet  ${countdownText}`);

  if (process.platform === 'darwin') {
    tray.setTitle(getCountdownCompactText(ctx));
  }
}

function startTrayCountdownTicker(ctx) {
  clearInterval(trayCountdownInterval);
  updateTrayDisplay(ctx);
  trayCountdownInterval = setInterval(() => {
    if (!tray || tray.isDestroyed()) return;
    if (ctx.petState === STATE.SLEEPING || ctx.petState === STATE.RESTING) {
      updateTrayDisplay(ctx);
      if (ctx.updateTrayMenu) ctx.updateTrayMenu();
    }
  }, 1000);
}

function stopTrayCountdownTicker(ctx) {
  clearInterval(trayCountdownInterval);
  trayCountdownInterval = null;
  updateTrayDisplay(ctx);
}

function createTray(ctx) {
  if (!Tray || !nativeImage || !app) return;

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon;

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

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

  const { userConfig } = ctx;
  if (userConfig.trayIcon && fs.existsSync(userConfig.trayIcon)) {
    let customIcon = nativeImage.createFromPath(userConfig.trayIcon);
    const s = customIcon.getSize();
    const sq = Math.min(s.width, s.height);
    customIcon = customIcon.crop({ x: Math.floor((s.width - sq) / 2), y: Math.floor((s.height - sq) / 2), width: sq, height: sq });
    customIcon = customIcon.resize({ width: 18, height: 18, quality: 'best' });
    tray.setImage(customIcon);
  }

  if (userConfig.appIcon && fs.existsSync(userConfig.appIcon)) {
    if (app.dock) app.dock.setIcon(nativeImage.createFromPath(userConfig.appIcon));
  }

  startTrayCountdownTicker(ctx);

  tray.on('click', () => {
    if (ctx.win) {
      ctx.win.show();
      ctx.win.focus();
    }
  });
}

function buildMenu(ctx) {
  if (!Menu || !app) return null;

  updateTrayDisplay(ctx);

  return Menu.buildFromTemplate([
    { label: '显示宠物', click: () => { ctx.win && ctx.win.show(); } },
    { label: '隐藏宠物', click: () => { ctx.win && ctx.win.hide(); } },
    { type: 'separator' },
    { label: getCountdownText(ctx), enabled: false },
    { type: 'separator' },
    {
      label: '暂停/继续',
      click: () => {
        if (ctx.petState === STATE.SLEEPING || ctx.petState === STATE.RESTING) {
          ctx.pauseCycle();
        } else if (ctx.petState === STATE.PAUSED) {
          ctx.resumeCycle();
        }
      }
    },
    { label: `屏幕遮罩: ${ctx.overlayEnabled ? '开启' : '关闭'}`,
      click: () => {
        ctx.overlayEnabled = !ctx.overlayEnabled;
        ctx.notifyRenderer('overlay-toggle', ctx.overlayEnabled);
        ctx.updateTrayMenu();
      }
    },
    { type: 'separator' },
    { label: '个性化', submenu: [
      { label: '更换20分钟宠物照', click: () => ctx.pickSleepImage() },
      { label: '更换20秒宠物照', click: () => ctx.pickRestImage() },
      { label: '更换顶部图标', click: () => ctx.pickTrayIcon() },
      { label: '更换App图标', click: () => ctx.pickAppIcon() },
      { label: '修改问候语', click: () => ctx.setGreetingText() },
    ]},
    { type: 'separator' },
    { label: 'Quit 退出', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
}

function updateTrayMenu(ctx) {
  if (!tray || tray.isDestroyed()) return;
  const menu = buildMenu(ctx);
  if (menu) tray.setContextMenu(menu);
}

function setImage(icon) {
  if (tray && !tray.isDestroyed()) {
    tray.setImage(icon);
  }
}

module.exports = {
  createTray,
  updateTrayMenu,
  updateTrayDisplay: (ctx) => updateTrayDisplay(ctx),
  startTrayCountdownTicker: (ctx) => startTrayCountdownTicker(ctx),
  stopTrayCountdownTicker: (ctx) => stopTrayCountdownTicker(ctx),
  setImage
};
