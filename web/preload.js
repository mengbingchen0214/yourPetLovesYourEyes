const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyePet', {
  getState: () => ipcRenderer.invoke('get-state'),
  startCycle: () => ipcRenderer.invoke('start-cycle'),
  pauseCycle: () => ipcRenderer.invoke('pause-cycle'),
  resumeCycle: () => ipcRenderer.invoke('resume-cycle'),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  startDrag: (x, y) => ipcRenderer.send('start-drag', { x, y }),
  drag: (x, y) => ipcRenderer.send('drag', { x, y }),
  endDrag: () => ipcRenderer.send('end-drag'),
  onStateChange: (callback) => {
    ipcRenderer.on('state-change', (event, data) => callback(data));
  },
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (event, data) => callback(data));
  },
  onOverlayToggle: (callback) => {
    ipcRenderer.on('overlay-toggle', (event, enabled) => callback(enabled));
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  pickAppImage: () => ipcRenderer.invoke('pick-app-image'),
  pickSleepImage: () => ipcRenderer.invoke('pick-sleep-image'),
  pickRestImage: () => ipcRenderer.invoke('pick-rest-image'),
  pickIconImage: () => ipcRenderer.invoke('pick-icon-image'),
  setGreetingText: () => ipcRenderer.invoke('set-greeting-text'),
  onConfigChange: (callback) => {
    ipcRenderer.on('config-change', (event, data) => callback(data));
  },

  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  checkFeature: (featureName) => ipcRenderer.invoke('check-feature', featureName),
  onLicenseChange: (callback) => {
    ipcRenderer.on('license-change', (event, data) => callback(data));
  },
  onUpgradePrompt: (callback) => {
    ipcRenderer.on('upgrade-prompt', (event, data) => callback(data));
  },

  getHappinessStatus: () => ipcRenderer.invoke('get-happiness-status'),
  setPetName: (name) => ipcRenderer.invoke('set-pet-name', name),
  showLicenseDialog: () => ipcRenderer.invoke('show-license-dialog'),
  showUpgradeDialog: () => ipcRenderer.invoke('show-upgrade-dialog'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  validateOnline: () => ipcRenderer.invoke('validate-online'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  onHappinessChange: (callback) => {
    ipcRenderer.on('happiness-change', (event, data) => callback(data));
  },
});
