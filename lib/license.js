const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
    if (validateKey(data.licenseKey)) return TIER.PRO;
    data.tier = TIER.FREE;
    data.licenseKey = null;
    saveLicense(data);
    return TIER.FREE;
  }

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

function validateKey(key) {
  if (!key || typeof key !== 'string' || key.length < 16) return false;
  try {
    const parts = key.split('-');
    if (parts.length !== 4) return false;
    const [sig, tid, exp, chk] = parts;
    if (sig.length !== 8 || tid.length !== 4 || exp.length !== 4 || chk.length !== 4) return false;
    const expectedChk = crypto.createHash('md5').update(`${sig}-${tid}-${exp}`).digest('hex').slice(0, 4);
    if (chk !== expectedChk) return false;
    const expDate = parseInt(exp, 16) * 86400000;
    if (Date.now() > expDate) return false;
    return true;
  } catch {
    return false;
  }
}

function activateLicense(key) {
  if (!key || typeof key !== 'string') return { success: false, error: 'Invalid key format' };
  if (validateKey(key)) {
    const data = loadLicense() || {};
    data.tier = TIER.PRO;
    data.licenseKey = key;
    data.activatedAt = Date.now();
    saveLicense(data);
    return { success: true, tier: TIER.PRO };
  }
  return { success: false, error: 'Invalid license key' };
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
  generateTestKey
};
