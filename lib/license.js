const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const payment = require('./payment');

const TIER = {
  FREE: 'free',
  TRIAL: 'trial',
  PRO: 'pro'
};

const TRIAL_DAYS = 14;
const LICENSE_FILENAME = 'license.json';
const PRO_FEATURES = [
  'custom-pet',
  'pet-name',
  'pet-happiness',
  'custom-intervals',
  'rest-stats'
];

let _configPath = null;
let _licenseData = null;

function setConfigPath(userDataPath) {
  _configPath = path.join(userDataPath, LICENSE_FILENAME);
}

function getLicensePath() {
  return _configPath;
}

function loadLicense() {
  if (_licenseData) return _licenseData;
  const filePath = getLicensePath();
  try {
    if (fs.existsSync(filePath)) {
      _licenseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return _licenseData;
    }
  } catch (err) {
    console.error('[License] Failed to load:', err.message);
  }
  return null;
}

function saveLicense(data) {
  const filePath = getLicensePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    _licenseData = data;
    return true;
  } catch (err) {
    console.error('[License] Failed to save:', err.message);
    return false;
  }
}

function initTrial() {
  const existing = loadLicense();
  if (existing && existing.firstLaunchAt) return existing;

  const trialData = {
    firstLaunchAt: Date.now(),
    tier: TIER.TRIAL,
    licenseKey: null,
    instanceId: null,
    activatedAt: null,
    machineId: getMachineId()
  };
  saveLicense(trialData);
  return trialData;
}

function getMachineId() {
  try {
    const os = require('os');
    const cpus = os.cpus();
    const network = os.networkInterfaces();
    const raw = JSON.stringify({ cpus: cpus[0]?.model, hostname: os.hostname(), network });
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return crypto.randomBytes(8).toString('hex');
  }
}

function getTier() {
  const data = loadLicense();
  if (!data) return TIER.FREE;

  if (data.tier === TIER.PRO && data.licenseKey) {
    return TIER.PRO;
  }

  if (data.tier === TIER.FREE) return TIER.FREE;

  if (data.firstLaunchAt) {
    const trialEnd = new Date(data.firstLaunchAt);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    if (Date.now() < trialEnd.getTime()) return TIER.TRIAL;
  }

  return TIER.FREE;
}

function isPro() {
  return getTier() === TIER.PRO;
}

function isTrial() {
  return getTier() === TIER.TRIAL;
}

function isFree() {
  return getTier() === TIER.FREE;
}

function isFeatureAvailable(featureName) {
  const tier = getTier();
  if (tier === TIER.PRO || tier === TIER.TRIAL) return true;
  return !PRO_FEATURES.includes(featureName);
}

function getTrialInfo() {
  const data = loadLicense();
  if (!data || !data.firstLaunchAt) {
    return { isActive: false, daysRemaining: 0, totalDays: TRIAL_DAYS };
  }
  const trialEnd = new Date(data.firstLaunchAt);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((trialEnd.getTime() - now) / (1000 * 60 * 60 * 24)));
  return {
    isActive: remaining > 0,
    daysRemaining: remaining,
    totalDays: TRIAL_DAYS,
    startedAt: data.firstLaunchAt,
    expiresAt: trialEnd.getTime()
  };
}

async function activateLicense(key) {
  if (!key || typeof key !== 'string') {
    return { success: false, error: 'Invalid key format' };
  }

  console.log('[License] Activating via LemonSqueezy...');
  try {
    const result = await payment.activate(key.trim());
    if (result.activated && result.instance) {
      const data = loadLicense() || {};
      data.tier = TIER.PRO;
      data.licenseKey = key.trim();
      data.instanceId = result.instance.id;
      data.activatedAt = Date.now();
      data.meta = result.meta || {};
      saveLicense(data);
      console.log('[License] Activation successful:', result.instance.id);
      return { success: true, tier: TIER.PRO, instanceId: result.instance.id };
    }
    return { success: false, error: payment.formatError(result) || 'Activation failed' };
  } catch (err) {
    console.error('[License] Activation error:', err.message);
    return { success: false, error: err.message || 'Network error' };
  }
}

async function validateOnline() {
  const data = loadLicense();
  if (!data || !data.licenseKey) {
    return { valid: false, error: 'No license key' };
  }

  try {
    const params = { licenseKey: data.licenseKey };
    if (data.instanceId) params.instanceId = data.instanceId;

    const result = await payment.validate(data.licenseKey, data.instanceId);

    if (result.valid) {
      if (!data.instanceId && result.instance) {
        data.instanceId = result.instance.id;
        saveLicense(data);
      }
      return { valid: true, status: result.license_key?.status };
    }

    if (result.error?.includes('expired') || result.error?.includes('disabled') || result.error?.includes('suspended')) {
      data.tier = TIER.FREE;
      saveLicense(data);
      return { valid: false, error: result.error, revoked: true };
    }

    return { valid: false, error: result.error || 'Validation failed' };
  } catch (err) {
    console.warn('[License] Online validation failed (offline?):', err.message);
    return { valid: true, cached: true, error: err.message };
  }
}

async function deactivateLicense() {
  const data = loadLicense();
  if (!data || !data.licenseKey || !data.instanceId) {
    return { success: true, message: 'No active license to deactivate' };
  }

  try {
    const result = await payment.deactivate(data.licenseKey, data.instanceId);
    if (result.deactivated) {
      data.tier = TIER.FREE;
      data.licenseKey = null;
      data.instanceId = null;
      data.activatedAt = null;
      data.meta = null;
      saveLicense(data);
      return { success: true };
    }
    return { success: false, error: payment.formatError(result) };
  } catch (err) {
    console.warn('[License] Deactivation error:', err.message);
    return { success: false, error: err.message };
  }
}

function validateKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('-') && key.length > 20) return true;
  return false;
}

function generateTestKey(daysValid = 365) {
  const sig = crypto.randomBytes(4).toString('hex');
  const tid = crypto.randomBytes(2).toString('hex');
  const exp = Math.floor((Date.now() + daysValid * 86400000) / 86400000).toString(16);
  const chk = crypto.createHash('md5').update(`${sig}-${tid}-${exp}`).digest('hex').slice(0, 4);
  return `${sig}-${tid}-${exp}-${chk}`;
}

module.exports = {
  TIER,
  TRIAL_DAYS,
  PRO_FEATURES,
  setConfigPath,
  getLicensePath,
  loadLicense,
  initTrial,
  getTier,
  isPro,
  isTrial,
  isFree,
  isFeatureAvailable,
  getTrialInfo,
  validateKey,
  activateLicense,
  validateOnline,
  deactivateLicense,
  generateTestKey
};
