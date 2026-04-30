const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyePet', {
  // 获取当前状态
  getState: () => ipcRenderer.invoke('get-state'),

  // 开始护眼周期
  startCycle: () => ipcRenderer.invoke('start-cycle'),

  // 暂停
  pauseCycle: () => ipcRenderer.invoke('pause-cycle'),

  // 继续
  resumeCycle: () => ipcRenderer.invoke('resume-cycle'),

  // 切换遮罩
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),

  // 退出应用
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // 窗口拖动
  startDrag: (x, y) => ipcRenderer.send('start-drag', { x, y }),
  drag: (x, y) => ipcRenderer.send('drag', { x, y }),
  endDrag: () => ipcRenderer.send('end-drag'),

  // 监听状态变化
  onStateChange: (callback) => {
    ipcRenderer.on('state-change', (event, data) => callback(data));
  },

  // 监听进度更新
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (event, data) => callback(data));
  },

  // 监听遮罩开关变化
  onOverlayToggle: (callback) => {
    ipcRenderer.on('overlay-toggle', (event, enabled) => callback(enabled));
  },
});
