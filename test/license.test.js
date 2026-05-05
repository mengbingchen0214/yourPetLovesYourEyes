const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;
let _afterEachFns = [];
let _testQueue = [];

function describe(name, fn) {
  console.log(`\n${name}`);
  const prevLen = _afterEachFns.length;
  fn();
  _afterEachFns.length = prevLen;
}

function it(name, fn) {
  _testQueue.push({ name, fn });
}

function afterEach(fn) {
  _afterEachFns.push(fn);
}

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eyepet-license-test-'));

let _originalActivate = null;
let _originalValidateOnline = null;

function mockPaymentAPI(shouldSucceed = true) {
  const payment = require('../lib/payment');
  if (!_originalActivate) _originalActivate = payment.activate;
  if (!_originalValidateOnline) _originalValidateOnline = payment.validate;

  payment.activate = () => shouldSucceed ? Promise.resolve({
    activated: true,
    instance: { id: 'test-instance-id', name: 'Test', created_at: new Date().toISOString() },
    meta: { product_id: 1, customer_email: 'test@example.com' },
    license_key: { id: 1, status: 'active' }
  }) : Promise.resolve({ activated: false, error: 'Invalid key' });

  payment.validate = () => Promise.resolve({
    valid: true,
    license_key: { status: 'active' },
    instance: null
  });
}

function restorePaymentAPI() {
  const payment = require('../lib/payment');
  if (_originalActivate) payment.activate = _originalActivate;
  if (_originalValidateOnline) payment.validate = _originalValidateOnline;
}

function mockLicense() {
  delete require.cache[require.resolve('../lib/license')];
  const mod = require('../lib/license');
  mod.setConfigPath(TMP_DIR);
  const licPath = path.join(TMP_DIR, 'license.json');
  if (fs.existsSync(licPath)) fs.unlinkSync(licPath);
  return mod;
}

function reloadLicense() {
  delete require.cache[require.resolve('../lib/license')];
  const mod = require('../lib/license');
  mod.setConfigPath(TMP_DIR);
  return mod;
}

function cleanup() {
  const licPath = path.join(TMP_DIR, 'license.json');
  if (fs.existsSync(licPath)) fs.unlinkSync(licPath);
  restorePaymentAPI();
}

describe('License System', () => {
  afterEach(cleanup);

  describe('Trial Initialization', () => {
    it('should create trial data on first init', async () => {
      const lic = mockLicense();
      const data = lic.initTrial();
      assert.strictEqual(data.tier, 'trial');
      assert.ok(data.firstLaunchAt > 0);
      assert.ok(data.machineId);
      assert.strictEqual(data.licenseKey, null);
      assert.strictEqual(data.instanceId, null);
    });

    it('should return existing trial on subsequent calls', async () => {
      const lic = mockLicense();
      const first = lic.initTrial();
      assert.ok(lic.loadLicense());
      assert.strictEqual(lic.loadLicense().firstLaunchAt, first.firstLaunchAt);
    });

    it('should generate consistent machine ID format', async () => {
      const lic = mockLicense();
      const data = lic.initTrial();
      assert.strictEqual(data.machineId.length, 16);
      assert.ok(/^[a-f0-9]{16}$/.test(data.machineId));
    });
  });

  describe('Tier Detection', () => {
    it('should return FREE when no license file exists', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.getTier(), 'free');
    });

    it('should return TRIAL during trial period', async () => {
      const lic = mockLicense();
      lic.initTrial();
      assert.strictEqual(lic.getTier(), 'trial');
    });

    it('should return PRO with valid key after LS activation', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      const result = await lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tier, 'pro');
      assert.strictEqual(lic.getTier(), 'pro');
      assert.ok(result.instanceId);
    });

    it('should revert to FREE if key becomes invalid', async () => {
      mockPaymentAPI(false);
      const lic = mockLicense();
      lic.initTrial();
      const result = await lic.activateLicense('bad-key');
      assert.strictEqual(result.success, false);
      assert.strictEqual(lic.getTier(), 'trial');
    });
  });

  describe('Feature Gating', () => {
    it('should allow non-Pro features for free users', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFeatureAvailable('start-cycle'), true);
      assert.strictEqual(lic.isFeatureAvailable('pause'), true);
    });

    it('should block Pro features for free users', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), false);
      assert.strictEqual(lic.isFeatureAvailable('pet-name'), false);
      assert.strictEqual(lic.isFeatureAvailable('pet-happiness'), false);
    });

    it('should allow all features for Pro users', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      await lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), true);
      assert.strictEqual(lic.isFeatureAvailable('pet-name'), true);
      assert.strictEqual(lic.isFeatureAvailable('pet-happiness'), true);
    });

    it('should allow Pro features during trial period', async () => {
      const lic = mockLicense();
      lic.initTrial();
      assert.strictEqual(lic.getTier(), 'trial');
      assert.strictEqual(lic.isFeatureAvailable('custom-pet'), true);
    });
  });

  describe('License Key Validation', () => {
    it('should reject empty or short keys', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.validateKey(null), false);
      assert.strictEqual(lic.validateKey(''), false);
      assert.strictEqual(lic.validateKey('short'), false);
    });

    it('should reject keys without dashes', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.validateKey('notavalidkeyformat'), false);
    });

    it('should accept valid generated keys (legacy format)', async () => {
      const lic = mockLicense();
      const key = lic.generateTestKey();
      assert.strictEqual(lic.validateKey(key), true);
    });

    it('should accept LemonSqueezy UUID format keys', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.validateKey('38b1460a-5104-4067-a91d-77b872934d51'), true);
      assert.strictEqual(lic.validateKey('abc123-def456-ghi789-jkl012'), true);
    });

    it('should generate legacy keys in correct format', async () => {
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

  describe('License Activation (LemonSqueezy)', () => {
    it('should activate with valid key via LS API', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      const result = await lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tier, 'pro');
      assert.ok(result.instanceId);
      assert.strictEqual(result.instanceId, 'test-instance-id');
    });

    it('should fail with invalid key via LS API', async () => {
      mockPaymentAPI(false);
      const lic = mockLicense();
      const result = await lic.activateLicense('invalid-key');
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should persist activation across reloads', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      const key = lic.generateTestKey();
      await lic.activateLicense(key);

      const lic2 = reloadLicense();
      assert.strictEqual(lic2.getTier(), 'pro');
      assert.ok(lic2.loadLicense().instanceId);
    });

    it('should save instanceId from LS response', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      await lic.activateLicense('any-key');
      const data = lic.loadLicense();
      assert.strictEqual(data.instanceId, 'test-instance-id');
      assert.ok(data.meta);
      assert.ok(data.activatedAt > 0);
    });
  });

  describe('Online Validation', () => {
    it('should validate successfully with cached state', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      await lic.activateLicense('test-key');
      const result = await lic.validateOnline();
      assert.strictEqual(result.valid, true);
    });

    it('should return error when no key exists', async () => {
      const lic = mockLicense();
      const result = await lic.validateOnline();
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });
  });

  describe('Deactivation', () => {
    it('should deactivate active license', async () => {
      mockPaymentAPI(true);
      const lic = mockLicense();
      lic.initTrial();
      await lic.activateLicense('test-key');
      assert.strictEqual(lic.getTier(), 'pro');

      const payment = require('../lib/payment');
      payment.deactivate = () => Promise.resolve({ deactivated: true });
      delete require.cache[require.resolve('../lib/license')];
      const lic2 = reloadLicense();

      const result = await lic2.deactivateLicense();
      assert.strictEqual(result.success, true);
      assert.strictEqual(lic2.getTier(), 'free');
      assert.strictEqual(lic2.loadLicense().licenseKey, null);
    });
  });

  describe('Trial Info', () => {
    it('should report correct remaining days', async () => {
      const lic = mockLicense();
      lic.initTrial();
      const info = lic.getTrialInfo();
      assert.strictEqual(info.isActive, true);
      assert.ok(info.daysRemaining > 13);
      assert.ok(info.daysRemaining <= 14);
      assert.strictEqual(info.totalDays, 14);
    });

    it('should report inactive when no trial exists', async () => {
      const lic = mockLicense();
      const info = lic.getTrialInfo();
      assert.strictEqual(info.isActive, false);
      assert.strictEqual(info.daysRemaining, 0);
    });
  });

  describe('Convenience Methods', () => {
    it('isPro should work correctly', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isPro(), false);
      lic.initTrial();
      mockPaymentAPI(true);
      await lic.activateLicense(lic.generateTestKey());
      assert.strictEqual(lic.isPro(), true);
    });

    it('isTrial should work correctly', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isTrial(), false);
      lic.initTrial();
      assert.strictEqual(lic.isTrial(), true);
    });

    it('isFree should work correctly', async () => {
      const lic = mockLicense();
      assert.strictEqual(lic.isFree(), true);
      lic.initTrial();
      assert.strictEqual(lic.isFree(), false);
    });
  });
});

console.log(`\n${'='.repeat(40)}`);
(async function runTests() {
  for (const { name, fn } of _testQueue) {
    try {
      await fn();
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
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();

