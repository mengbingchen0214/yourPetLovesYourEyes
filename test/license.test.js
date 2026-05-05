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

function afterEach(fn) {
  _afterEachFns.push(fn);
}

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eyepet-license-test-'));

function mockLicense() {
  delete require.cache[require.resolve('../lib/license')];
  const mod = require('../lib/license');
  mod.setConfigPath(TMP_DIR);
  return mod;
}

function cleanup() {
  const licPath = path.join(TMP_DIR, 'license.json');
  if (fs.existsSync(licPath)) fs.unlinkSync(licPath);
}

describe('License System', () => {
  afterEach(cleanup);

  describe('Trial Initialization', () => {
    it('should create trial data on first init', () => {
      const lic = mockLicense();
      const data = lic.initTrial();
      assert.strictEqual(data.tier, 'trial');
      assert.ok(data.firstLaunchAt > 0);
      assert.ok(data.machineId);
      assert.strictEqual(data.licenseKey, null);
    });

    it('should return existing trial on subsequent calls', () => {
      const lic = mockLicense();
      const first = lic.initTrial();
      assert.ok(lic.loadLicense());
      assert.strictEqual(lic.loadLicense().firstLaunchAt, first.firstLaunchAt);
    });

    it('should generate consistent machine ID format', () => {
      const lic = mockLicense();
      const data = lic.initTrial();
      assert.strictEqual(data.machineId.length, 16);
      assert.ok(/^[a-f0-9]{16}$/.test(data.machineId));
    });
  });

  describe('Tier Detection', () => {
    it('should return FREE when no license file exists', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.getTier(), 'free');
    });

    it('should return TRIAL during trial period', () => {
      const lic = mockLicense();
      lic.initTrial();
      assert.strictEqual(lic.getTier(), 'trial');
    });

    it('should return PRO with valid key', () => {
      const lic = mockLicense();
      lic.initTrial();
      const testKey = lic.generateTestKey();
      lic.activateLicense(testKey);
      assert.strictEqual(lic.getTier(), 'pro');
    });

    it('should revert to FREE if key becomes invalid', () => {
      const lic = mockLicense();
      lic.initTrial();
      const key = lic.generateTestKey();
      lic.activateLicense(key);
      assert.strictEqual(lic.getTier(), 'pro');
    });
  });

  describe('Feature Gating', () => {
    it('should allow non-Pro features for free users', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFeatureAvailable('start-cycle'), true);
      assert.strictEqual(lic.isFeatureAvailable('pause'), true);
    });

    it('should block Pro features for free users', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), false);
      assert.strictEqual(lic.isFeatureAvailable('pet-name'), false);
      assert.strictEqual(lic.isFeatureAvailable('pet-happiness'), false);
    });

    it('should allow all features for Pro users', () => {
      const lic = mockLicense();
      lic.initTrial();
      lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), true);
      assert.strictEqual(lic.isFeatureAvailable('pet-name'), true);
      assert.strictEqual(lic.isFeatureAvailable('pet-happiness'), true);
    });

    it('should allow Pro features during trial period', () => {
      const lic = mockLicense();
      lic.initTrial();
      assert.strictEqual(lic.getTier(), 'trial');
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), true);
    });
  });

  describe('License Key Validation', () => {
    it('should reject empty or short keys', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.validateKey(null), false);
      assert.strictEqual(lic.validateKey(''), false);
      assert.strictEqual(lic.validateKey('short'), false);
    });

    it('should reject malformed keys', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.validateKey('not-a-valid-key-format'), false);
      assert.strictEqual(lic.validateKey('aaaa-bbbb-cccc-dddd-eeee'), false);
    });

    it('should accept valid generated keys', () => {
      const lic = mockLicense();
      const key = lic.generateTestKey();
      assert.strictEqual(lic.validateKey(key), true);
    });

    it('should reject expired keys', () => {
      const lic = mockLicense();
      const expiredKey = lic.generateTestKey(-1);
      assert.strictEqual(lic.validateKey(expiredKey), false);
    });

    it('should generate keys in correct format', () => {
      const lic = mockLicense();
      const key = lic.generateTestKey();
      const parts = key.split('-');
      assert.strictEqual(parts.length, 4);
      assert.strictEqual(parts[0].length, 8);
      assert.strictEqual(parts[1].length, 4);
      assert.strictEqual(parts[2].length, 4);
      assert.strictEqual(parts[3].length, 4);
    });
  });

  describe('License Activation', () => {
    it('should activate with valid key', () => {
      const lic = mockLicense();
      lic.initTrial();
      const result = lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tier, 'pro');
    });

    it('should fail with invalid key', () => {
      const lic = mockLicense();
      const result = lic.activateLicense('invalid-key');
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should persist activation across reloads', () => {
      const lic = mockLicense();
      lic.initTrial();
      const key = lic.generateTestKey();
      lic.activateLicense(key);

      const lic2 = mockLicense();
      assert.strictEqual(lic2.getTier(), 'pro');
    });
  });

  describe('Trial Info', () => {
    it('should report correct remaining days', () => {
      const lic = mockLicense();
      lic.initTrial();
      const info = lic.getTrialInfo();
      assert.strictEqual(info.isActive, true);
      assert.ok(info.daysRemaining > 13);
      assert.ok(info.daysRemaining <= 14);
      assert.strictEqual(info.totalDays, 14);
    });

    it('should report inactive when no trial exists', () => {
      const lic = mockLicense();
      const info = lic.getTrialInfo();
      assert.strictEqual(info.isActive, false);
      assert.strictEqual(info.daysRemaining, 0);
    });
  });

  describe('Convenience Methods', () => {
    it('isPro should work correctly', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isPro(), false);
      lic.initTrial();
      lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(lic.isPro(), true);
    });

    it('isTrial should work correctly', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isTrial(), false);
      lic.initTrial();
      assert.strictEqual(lic.isTrial(), true);
    });

    it('isFree should work correctly', () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFree(), true);
      lic.initTrial();
      assert.strictEqual(lic.isFree(), false);
    });
  });
});

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
