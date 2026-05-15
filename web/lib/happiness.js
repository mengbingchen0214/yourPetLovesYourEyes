const fs = require('fs');
const path = require('path');

const DEFAULT_HAPPINESS = 50;
const MAX_HAPPINESS = 100;
const MIN_HAPPINESS = 0;
const DEFAULT_PET_NAME = '安球';
const DECAY_PER_HOUR = 1;

const EVENT_VALUES = {
  'rest-completed': 8,
  'cycle-started': 2,
  'on-time-rest': 5,
  'paused': -3,
  'skipped-rest': -15,
  'long-session': 1
};

const MOOD_THRESHOLDS = [
  { max: 20, mood: 'sad', emoji: '😢' },
  { max: 40, mood: 'neutral', emoji: '😐' },
  { max: 60, mood: 'happy', emoji: '😊' },
  { max: 80, mood: 'very-happy', emoji: '😄' },
  { max: 100, mood: 'ecstatic', emoji: '🥰' }
];

let _configPath = null;
let _data = null;

function setConfigPath(p) {
  _configPath = p;
  _data = null;
}

function getDataPath() {
  if (!_configPath) {
    const { app } = require('electron') || { app: { getPath: () => '.' } };
    return path.join(app.getPath('userData') || '.', 'happiness.json');
  }
  return path.join(_configPath, 'happiness.json');
}

function loadData() {
  if (_data) return _data;
  try {
    const raw = fs.readFileSync(getDataPath(), 'utf-8');
    _data = JSON.parse(raw);
  } catch {
    _data = {
      happiness: DEFAULT_HAPPINESS,
      petName: DEFAULT_PET_NAME,
      stats: {
        totalRests: 0,
        totalPauses: 0,
        totalSkips: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastEventAt: 0
      }
    };
  }
  return _data;
}

function saveData() {
  if (!_data) return;
  try {
    fs.writeFileSync(getDataPath(), JSON.stringify(_data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Happiness] Failed to save:', err.message);
  }
}

function clamp(val) {
  return Math.max(MIN_HAPPINESS, Math.min(MAX_HAPPINESS, val));
}

function getMoodForLevel(level) {
  for (const t of MOOD_THRESHOLDS) {
    if (level <= t.max) return { mood: t.mood, emoji: t.emoji };
  }
  return { mood: 'ecstatic', emoji: '🥰' };
}

function addEvent(eventType) {
  const data = loadData();
  const delta = EVENT_VALUES[eventType];
  if (delta === undefined) return;

  data.happiness = clamp(data.happiness + delta);

  switch (eventType) {
    case 'rest-completed':
      data.stats.totalRests++;
      data.stats.currentStreak++;
      if (data.stats.currentStreak > data.stats.bestStreak) {
        data.stats.bestStreak = data.stats.currentStreak;
      }
      break;
    case 'paused':
      data.stats.totalPauses++;
      break;
    case 'skipped-rest':
      data.stats.totalSkips++;
      data.stats.currentStreak = 0;
      break;
    case 'cycle-started':
      break;
    case 'long-session':
      break;
  }

  data.stats.lastEventAt = Date.now();
  saveData();
}

function getHappiness() {
  return loadData().happiness;
}

function getMood() {
  return getMoodForLevel(loadData().happiness).mood;
}

function getMoodEmoji() {
  return getMoodForLevel(loadData().happiness).emoji;
}

function applyDecay(msSinceActive) {
  const data = loadData();
  const hours = Math.floor(msSinceActive / 3600000);
  if (hours > 0) {
    data.happiness = clamp(data.happiness - (hours * DECAY_PER_HOUR));
    saveData();
  }
}

function getPetName() {
  return loadData().petName || DEFAULT_PET_NAME;
}

function setPetName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return;
  const data = loadData();
  data.petName = name.trim();
  saveData();
}

function getStats() {
  return { ...loadData().stats };
}

function getStatus() {
  const data = loadData();
  const moodInfo = getMoodForLevel(data.happiness);
  return {
    happiness: data.happiness,
    mood: moodInfo.mood,
    emoji: moodInfo.emoji,
    petName: data.petName || DEFAULT_PET_NAME,
    stats: { ...data.stats }
  };
}

function reset() {
  _data = {
    happiness: DEFAULT_HAPPINESS,
    petName: DEFAULT_PET_NAME,
    stats: {
      totalRests: 0,
      totalPauses: 0,
      totalSkips: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastEventAt: 0
    }
  };
  saveData();
}

module.exports = {
  setConfigPath,
  addEvent,
  getHappiness,
  getMood,
  getMoodEmoji,
  applyDecay,
  getPetName,
  setPetName,
  getStats,
  getStatus,
  reset,
  EVENT_VALUES,
  MAX_HAPPINESS,
  MIN_HAPPINESS,
  MOOD_THRESHOLDS
};
