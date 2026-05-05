const { STATE, SLEEP_DURATION, REST_DURATION } = require('./constants');
const overlayManager = require('./overlay-manager');
const trayManager = require('./tray-manager');

function create(ctx) {
  let sleepTimer = null;
  let restTimer = null;
  let sleepProgressInterval = null;

  function getScreen() {
    try {
      const { screen } = require('electron');
      return screen;
    } catch {
      return null;
    }
  }

  function notifyRenderer(channel, data) {
    ctx.notifyRenderer(channel, data);
  }

  function getRandomPosition() {
    const scr = getScreen();
    if (!scr) return { x: 100, y: 100 };
    const display = scr.getPrimaryDisplay();
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
    if (!ctx.win) return;
    const scr = getScreen();
    if (!scr) return;
    const display = scr.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const petWidth = 200;
    const petHeight = 200;

    ctx.win.setPosition(
      Math.floor((width - petWidth) / 2),
      Math.floor((height - petHeight) / 2)
    );
  }

  function clearTimers() {
    clearTimeout(sleepTimer);
    clearTimeout(restTimer);
    clearInterval(sleepProgressInterval);
    sleepProgressInterval = null;
    sleepTimer = null;
    restTimer = null;
  }

  function startGreeting() {
    ctx.petState = STATE.GREETING;
    ctx.sleepEndAt = 0;
    ctx.restEndAt = 0;
    trayManager.stopTrayCountdownTicker(ctx);
    overlayManager.hideOverlay();
    notifyRenderer('state-change', { state: ctx.petState, cycleCount: ctx.cycleCount });
    trayManager.updateTrayMenu(ctx);
  }

  function startSleeping() {
    ctx.petState = STATE.SLEEPING;
    ctx.isPaused = false;
    ctx.sleepEndAt = Date.now() + SLEEP_DURATION;
    ctx.restEndAt = 0;
    trayManager.startTrayCountdownTicker(ctx);
    overlayManager.hideOverlay();
    notifyRenderer('state-change', { state: ctx.petState, cycleCount: ctx.cycleCount });
    trayManager.updateTrayMenu(ctx);

    const pos = ctx.savedPosition || getRandomPosition();
    if (ctx.win && ctx.win.setPosition) {
      ctx.win.setPosition(pos.x, pos.y);
    }

    clearTimers();

    sleepTimer = setTimeout(() => {
      if (!ctx.isPaused) {
        startResting();
      }
    }, SLEEP_DURATION);

    let minutesLeft = 20;
    sleepProgressInterval = setInterval(() => {
      if (ctx.petState !== STATE.SLEEPING || ctx.isPaused) {
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
    ctx.petState = STATE.RESTING;
    ctx.sleepEndAt = 0;
    ctx.restEndAt = Date.now() + REST_DURATION;
    trayManager.startTrayCountdownTicker(ctx);
    clearInterval(sleepProgressInterval);
    sleepProgressInterval = null;
    ctx.cycleCount++;
    overlayManager.showOverlay(ctx.overlayEnabled);
    notifyRenderer('state-change', {
      state: ctx.petState,
      cycleCount: ctx.cycleCount,
      restImage: 'assets/angel-wakeup.png'
    });
    trayManager.updateTrayMenu(ctx);

    moveToCenter();

    clearTimers();

    restTimer = setTimeout(() => {
      if (ctx.petState === STATE.RESTING) {
        startSleeping();
      }
    }, REST_DURATION);
  }

  function pauseResumeMs() {
    if (ctx.petState === STATE.SLEEPING) {
      return Math.max(1000, ctx.sleepEndAt - Date.now());
    }
    if (ctx.petState === STATE.RESTING) {
      return Math.max(1000, ctx.restEndAt - Date.now());
    }
    return SLEEP_DURATION;
  }

  function pauseCycle() {
    if (ctx.petState === STATE.SLEEPING || ctx.petState === STATE.RESTING) {
      ctx.pausedFromState = ctx.petState;
      ctx.pausedRemainingMs = pauseResumeMs();
      ctx.isPaused = true;
      ctx.petState = STATE.PAUSED;

      clearTimers();

      ctx.sleepEndAt = 0;
      ctx.restEndAt = 0;
      trayManager.stopTrayCountdownTicker(ctx);
      overlayManager.hideOverlay();

      notifyRenderer('state-change', { state: ctx.petState, cycleCount: ctx.cycleCount });
      trayManager.updateTrayMenu(ctx);
    }
  }

  function startSleepingFor(ms) {
    ctx.petState = STATE.SLEEPING;
    ctx.isPaused = false;
    ctx.sleepEndAt = Date.now() + ms;
    ctx.restEndAt = 0;
    trayManager.startTrayCountdownTicker(ctx);
    overlayManager.hideOverlay();
    notifyRenderer('state-change', { state: ctx.petState, cycleCount: ctx.cycleCount });
    trayManager.updateTrayMenu(ctx);

    const pos = ctx.savedPosition || getRandomPosition();
    if (ctx.win && ctx.win.setPosition) {
      ctx.win.setPosition(pos.x, pos.y);
    }

    clearTimers();

    sleepTimer = setTimeout(() => {
      if (!ctx.isPaused) {
        startResting();
      }
    }, Math.max(1000, ms));

    sleepProgressInterval = setInterval(() => {
      if (ctx.petState !== STATE.SLEEPING || ctx.isPaused) {
        clearInterval(sleepProgressInterval);
        sleepProgressInterval = null;
        return;
      }

      const leftMs = Math.max(0, ctx.sleepEndAt - Date.now());
      const minutesLeft = Math.ceil(leftMs / 60000);
      notifyRenderer('progress-update', { minutesLeft, total: 20 });

      if (leftMs <= 0) {
        clearInterval(sleepProgressInterval);
        sleepProgressInterval = null;
      }
    }, 1000);
  }

  function startRestingFor(ms) {
    ctx.petState = STATE.RESTING;
    ctx.isPaused = false;
    ctx.sleepEndAt = 0;
    ctx.restEndAt = Date.now() + ms;
    trayManager.startTrayCountdownTicker(ctx);
    clearInterval(sleepProgressInterval);
    sleepProgressInterval = null;
    overlayManager.showOverlay(ctx.overlayEnabled);

    notifyRenderer('state-change', {
      state: ctx.petState,
      cycleCount: ctx.cycleCount,
      restImage: 'assets/angel-wakeup.png'
    });
    trayManager.updateTrayMenu(ctx);

    moveToCenter();

    clearTimers();

    restTimer = setTimeout(() => {
      if (ctx.petState === STATE.RESTING) {
        startSleeping();
      }
    }, Math.max(1000, ms));
  }

  function resumeCycle() {
    if (ctx.petState !== STATE.PAUSED) return;

    if (ctx.pausedFromState === STATE.RESTING) {
      startRestingFor(ctx.pausedRemainingMs || REST_DURATION);
    } else {
      startSleepingFor(ctx.pausedRemainingMs || SLEEP_DURATION);
    }

    ctx.pausedRemainingMs = 0;
  }

  function destroy() {
    clearTimers();
  }

  return {
    startGreeting,
    startSleeping,
    startResting,
    pauseCycle,
    resumeCycle,
    startSleepingFor,
    startRestingFor,
    destroy
  };
}

module.exports = { create };
