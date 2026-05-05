const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;
let _afterEachFns = [];

function describe(name, fn) {
  console.log(`\n${name}`);
  const prevLen = _afterEachFns.length;
  fn();
  _afterEachFns.length = prevLen;
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
  } finally {
    for (let i = _afterEachFns.length - 1; i >= 0; i--) {
      _afterEachFns[i]();
    }
  }
}

function afterEach(fn) { _afterEachFns.push(fn); }

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eyepet-happy-test-'));

function mockHappiness() {
  delete require.cache[require.resolve('../lib/happiness')];
  const mod = require('../lib/happiness');
  mod.setConfigPath(TMP_DIR);
  return mod;
}

function cleanup() {
  const p = path.join(TMP_DIR, 'happiness.json');
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

describe('Happiness System', () => {
  afterEach(cleanup);

  describe('Initialization', () => {
    it('should start at default happiness (50)', () => {
      const h = mockHappiness();
      assert.strictEqual(h.getHappiness(), 50);
    });

    it('should have neutral mood at start', () => {
      const h = mockHappiness();
      assert.strictEqual(h.getMood(), 'happy');
    });

    it('should persist happiness across reloads', () => {
      const h = mockHappiness();
      h.addEvent('rest-completed');
      const val = h.getHappiness();

      delete require.cache[require.resolve('../lib/happiness')];
      const h2 = require('../lib/happiness');
      h2.setConfigPath(TMP_DIR);
      assert.strictEqual(h2.getHappiness(), val);
    });
  });

  describe('Event: rest-completed', () => {
    it('should increase happiness by 8', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.addEvent('rest-completed');
      assert.strictEqual(h.getHappiness(), before + 8);
    });

    it('should clamp at 100', () => {
      const h = mockHappiness();
      for (let i = 0; i < 20; i++) h.addEvent('rest-completed');
      assert.strictEqual(h.getHappiness(), 100);
    });
  });

  describe('Event: cycle-started', () => {
    it('should increase happiness by 2', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.addEvent('cycle-started');
      assert.strictEqual(h.getHappiness(), before + 2);
    });
  });

  describe('Event: paused', () => {
    it('should decrease happiness by 3', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.addEvent('paused');
      assert.strictEqual(h.getHappiness(), before - 3);
    });

    it('should clamp at 0', () => {
      const h = mockHappiness();
      for (let i = 0; i < 30; i++) h.addEvent('paused');
      assert.strictEqual(h.getHappiness(), 0);
    });
  });

  describe('Event: skipped-rest', () => {
    it('should decrease happiness by 15', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.addEvent('skipped-rest');
      assert.strictEqual(h.getHappiness(), before - 15);
    });
  });

  describe('Event: long-session', () => {
    it('should increase happiness by 1', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.addEvent('long-session');
      assert.strictEqual(h.getHappiness(), before + 1);
    });
  });

  describe('Mood Mapping', () => {
    it('should be sad at 0-20', () => {
      const h = mockHappiness();
      for (let i = 0; i < 30; i++) h.addEvent('paused');
      assert.ok(h.getHappiness() <= 20);
      assert.strictEqual(h.getMood(), 'sad');
    });

    it('should be neutral at 21-40', () => {
      const h = mockHappiness();
      for (let i = 0; i < 5; i++) h.addEvent('paused');
      const val = h.getHappiness();
      assert.ok(val >= 21 && val <= 40, `Got ${val}, expected 21-40`);
      assert.strictEqual(h.getMood(), 'neutral');
    });

    it('should be happy at 41-60', () => {
      const h = mockHappiness();
      assert.ok(h.getHappiness() >= 41 && h.getHappiness() <= 60);
      assert.strictEqual(h.getMood(), 'happy');
    });

    it('should be very-happy at 61-80', () => {
      const h = mockHappiness();
      for (let i = 0; i < 3; i++) h.addEvent('rest-completed');
      const val = h.getHappiness();
      assert.ok(val >= 61 && val <= 80, `Got ${val}, expected 61-80`);
      assert.strictEqual(h.getMood(), 'very-happy');
    });

    it('should be ecstatic at 81-100', () => {
      const h = mockHappiness();
      for (let i = 0; i < 10; i++) h.addEvent('rest-completed');
      assert.ok(h.getHappiness() >= 81);
      assert.strictEqual(h.getMood(), 'ecstatic');
    });
  });

  describe('Decay', () => {
    it('should apply decay of -1 per hour', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.applyDecay(3600000);
      assert.strictEqual(h.getHappiness(), before - 1);
    });

    it('should not go below 0 from decay', () => {
      const h = mockHappiness();
      for (let i = 0; i < 50; i++) h.addEvent('paused');
      h.applyDecay(3600000);
      assert.strictEqual(h.getHappiness(), 0);
    });

    it('should calculate multiple hours correctly', () => {
      const h = mockHappiness();
      const before = h.getHappiness();
      h.applyDecay(7200000);
      assert.strictEqual(h.getHappiness(), before - 2);
    });
  });

  describe('Pet Name (Pro feature)', () => {
    it('should return default name initially', () => {
      const h = mockHappiness();
      assert.strictEqual(h.getPetName(), '安球');
    });

    it('should set and persist pet name', () => {
      const h = mockHappiness();
      h.setPetName('小胖');
      assert.strictEqual(h.getPetName(), '小胖');

      delete require.cache[require.resolve('../lib/happiness')];
      const h2 = require('../lib/happiness');
      h2.setConfigPath(TMP_DIR);
      assert.strictEqual(h2.getPetName(), '小胖');
    });

    it('should reject empty names', () => {
      const h = mockHappiness();
      h.setPetName('');
      assert.strictEqual(h.getPetName(), '安球');
    });
  });

  describe('Stats', () => {
    it('should track total rests completed', () => {
      const h = mockHappiness();
      h.addEvent('rest-completed');
      h.addEvent('rest-completed');
      const stats = h.getStats();
      assert.strictEqual(stats.totalRests, 2);
    });

    it('should track total pauses', () => {
      const h = mockHappiness();
      h.addEvent('paused');
      h.addEvent('paused');
      h.addEvent('paused');
      const stats = h.getStats();
      assert.strictEqual(stats.totalPauses, 3);
    });

    it('should calculate streak correctly', () => {
      const h = mockHappiness();
      h.addEvent('rest-completed');
      h.addEvent('rest-completed');
      h.addEvent('rest-completed');
      const stats = h.getStats();
      assert.strictEqual(stats.currentStreak, 3);
    });

    it('should reset streak on skip', () => {
      const h = mockHappiness();
      h.addEvent('rest-completed');
      h.addEvent('rest-completed');
      h.addEvent('skipped-rest');
      const stats = h.getStats();
      assert.strictEqual(stats.currentStreak, 0);
    });
  });

  describe('Mood Emoji', () => {
    it('should return correct emoji for each mood', () => {
      const h = mockHappiness();
      assert.strictEqual(h.getMoodEmoji(), '😊');
      for (let i = 0; i < 30; i++) h.addEvent('paused');
      assert.strictEqual(h.getMoodEmoji(), '😢');
    });
  });

  describe('Full Status', () => {
    it('should return complete status object', () => {
      const h = mockHappiness();
      h.setPetName('测试宠');
      h.addEvent('rest-completed');
      const status = h.getStatus();
      assert.strictEqual(typeof status.happiness, 'number');
      assert.strictEqual(typeof status.mood, 'string');
      assert.strictEqual(typeof status.emoji, 'string');
      assert.strictEqual(status.petName, '测试宠');
      assert.ok(status.stats);
      assert.strictEqual(status.stats.totalRests, 1);
    });
  });
});

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
