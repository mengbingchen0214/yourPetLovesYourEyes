const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialog', {
  submit: (value) => ipcRenderer.send('text-input-result', value),
  cancel: () => ipcRenderer.send('text-input-cancel'),
  onInit: (callback) => ipcRenderer.on('text-input-init', (_, data) => callback(data)),
  sendUpgradeAction: (action) => ipcRenderer.send('upgrade-action', action),
});
