const assert = require('assert');
const { STATE, SLEEP_DURATION, REST_DURATION } = require('../lib/constants');

let passed = 0;
let failed = 0;

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function mockCtx(overrides = {}) {
  const events = {};
  return {
    _petState: STATE.GREETING,
    _overlayEnabled: true,
    _isPaused: false,
    _cycleCount: 0,
    sleepEndAt: 0,
    restEndAt: 0,
    pausedFromState: STATE.SLEEPING,
    pausedRemainingMs: 0,
    savedPosition: null,
    win: { isDestroyed: () => false },
    userConfig: {},
    notifyRenderer: (channel, data) => {
      events[channel] = events[channel] || [];
      events[channel].push(data);
    },
    updateTrayMenu: () => {},
    pickSleepImage: () => {},
    pickRestImage: () => {},
    pickTrayIcon: () => {},
    pickAppIcon: () => {},
    setGreetingText: () => {},
    pauseCycle: () => {},
    resumeCycle: () => {},
    ...overrides,
    get petState() { return this._petState; },
    set petState(v) { this._petState = v; },
    get overlayEnabled() { return this._overlayEnabled; },
    set overlayEnabled(v) { this._overlayEnabled = v; },
    get isPaused() { return this._isPaused; },
    set isPaused(v) { this._isPaused = v; },
    get cycleCount() { return this._cycleCount; },
    set cycleCount(v) { this._cycleCount = v; },
    _events: events
  };
}

describe('Constants', () => {
  it('should define all 4 states', () => {
    assert.strictEqual(STATE.GREETING, 'greeting');
    assert.strictEqual(STATE.SLEEPING, 'sleeping');
    assert.strictEqual(STATE.RESTING, 'resting');
    assert.strictEqual(STATE.PAUSED, 'paused');
  });

  it('should have correct durations', () => {
    assert.strictEqual(SLEEP_DURATION, 20 * 60 * 1000);
    assert.strictEqual(REST_DURATION, 20 * 1000);
  });
});

describe('StateMachine - State Transitions', () => {
  it('should start in GREETING state', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startGreeting();
    assert.strictEqual(ctx.petState, STATE.GREETING);
    sm.destroy();
  });

  it('should transition from GREETING to SLEEPING', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startGreeting();
    sm.startSleeping();
    assert.strictEqual(ctx.petState, STATE.SLEEPING);
    assert.strictEqual(ctx.isPaused, false);
    assert.ok(ctx.sleepEndAt > Date.now());
    sm.destroy();
  });

  it('should transition directly to RESTING state', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startResting();
    assert.strictEqual(ctx.petState, STATE.RESTING);
    assert.strictEqual(ctx.cycleCount, 1);
    sm.destroy();
  });

  it('should transition from SLEEPING to PAUSED on pause', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleeping();
    sm.pauseCycle();

    assert.strictEqual(ctx.petState, STATE.PAUSED);
    assert.strictEqual(ctx.isPaused, true);
    assert.ok(ctx.pausedRemainingMs > 0);
    assert.strictEqual(ctx.sleepEndAt, 0);
    sm.destroy();
  });

  it('should transition from RESTING to PAUSED on pause', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startResting();
    sm.pauseCycle();

    assert.strictEqual(ctx.petState, STATE.PAUSED);
    assert.strictEqual(ctx.pausedFromState, STATE.RESTING);
    assert.ok(ctx.pausedRemainingMs > 0);
    sm.destroy();
  });

  it('should resume from PAUSED to SLEEPING', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleeping();
    sm.pauseCycle();
    sm.resumeCycle();

    assert.strictEqual(ctx.petState, STATE.SLEEPING);
    assert.strictEqual(ctx.isPaused, false);
    assert.ok(ctx.sleepEndAt > Date.now());
    sm.destroy();
  });

  it('should resume from PAUSED to RESTING when paused during rest', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startResting();
    sm.pauseCycle();
    assert.strictEqual(ctx.petState, STATE.PAUSED);

    sm.resumeCycle();

    assert.strictEqual(ctx.petState, STATE.RESTING);
    assert.strictEqual(ctx.isPaused, false);
    sm.destroy();
  });

  it('should not resume if not in PAUSED state', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startGreeting();
    sm.resumeCycle();

    assert.strictEqual(ctx.petState, STATE.GREETING);
    sm.destroy();
  });

  it('should not pause if in GREETING state', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startGreeting();
    sm.pauseCycle();

    assert.strictEqual(ctx.petState, STATE.GREETING);
    sm.destroy();
  });

  it('should increment cycleCount on each RESTING entry', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);

    sm.startResting();
    assert.strictEqual(ctx.cycleCount, 1);

    sm.startResting();
    assert.strictEqual(ctx.cycleCount, 2);

    sm.startResting();
    assert.strictEqual(ctx.cycleCount, 3);
    sm.destroy();
  });

  it('should notify renderer on state change', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startGreeting();

    const stateChanges = ctx._events['state-change'] || [];
    assert.ok(stateChanges.length > 0);
    assert.strictEqual(stateChanges[0].state, STATE.GREETING);
    sm.destroy();
  });

  it('should notify renderer with correct data on sleep', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleeping();

    const stateChanges = ctx._events['state-change'] || [];
    const sleepEvent = stateChanges.find(e => e.state === STATE.SLEEPING);
    assert.ok(sleepEvent);
    assert.strictEqual(typeof sleepEvent.cycleCount, 'number');
    sm.destroy();
  });

  it('should include restImage in RESTING notification', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startResting();

    const stateChanges = ctx._events['state-change'] || [];
    const restEvent = stateChanges.find(e => e.state === STATE.RESTING);
    assert.ok(restEvent);
    assert.strictEqual(restEvent.restImage, 'assets/angel-wakeup.png');
    sm.destroy();
  });
});

describe('StateMachine - Timer-based transitions', () => {
  it('should schedule sleep-to-rest transition timer', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleepingFor(5000);

    assert.strictEqual(ctx.petState, STATE.SLEEPING);
    assert.ok(ctx.sleepEndAt > Date.now());
    sm.destroy();
  });

  it('should schedule rest-to-sleep transition timer', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startRestingFor(5000);

    assert.strictEqual(ctx.petState, STATE.RESTING);
    assert.ok(ctx.restEndAt > Date.now());
    sm.destroy();
  });
});

describe('StateMachine - Saved Position', () => {
  it('should use saved position when available', () => {
    const ctx = mockCtx({
      savedPosition: { x: 500, y: 300 }
    });
    let setPositionCalledWith = null;
    ctx.win.setPosition = (x, y) => {
      setPositionCalledWith = { x, y };
    };

    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleepingFor(5000);

    assert.ok(setPositionCalledWith, 'setPosition should be called');
    assert.strictEqual(setPositionCalledWith.x, 500);
    assert.strictEqual(setPositionCalledWith.y, 300);
    sm.destroy();
  });

  it('should fallback to random position when no saved position', () => {
    const ctx = mockCtx({ savedPosition: null });
    let setPositionCalled = false;
    ctx.win.setPosition = () => { setPositionCalled = true; };

    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleepingFor(SLEEP_DURATION);

    assert.ok(setPositionCalled, 'setPosition should still be called with random pos');
    sm.destroy();
  });
});

describe('StateMachine - Destroy', () => {
  it('should clear all timers without errors', () => {
    const ctx = mockCtx();
    const sm = require('../lib/state-machine').create(ctx);
    sm.startSleeping();
    sm.startResting();
    sm.destroy();

    assert.doesNotThrow(() => sm.destroy());
  });
});

describe('Config Module', () => {
  const { loadConfig } = require('../lib/config');

  it('loadConfig should return empty object for missing file', () => {
    const result = loadConfig();
    assert.deepStrictEqual(result, {});
  });
});

process.on('exit', () => {
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);
});
