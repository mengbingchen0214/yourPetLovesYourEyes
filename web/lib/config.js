const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const CONFIG_FILENAME = 'config.json';

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config), 'utf8');
  } catch (err) {
    console.error('[EyePet] Failed to save config:', err.message);
  }
}

module.exports = { getConfigPath, loadConfig, saveConfig };
