// 诊断脚本 - 检查 Electron 是否能启动
const { app, BrowserWindow } = require('electron');

console.log('1. Electron 开始启动...');
console.log('平台:', process.platform);
console.log('版本:', process.versions.electron);

app.whenReady().then(() => {
  console.log('2. App 已 Ready');

  const win = new BrowserWindow({
    width: 300,
    height: 300,
    title: '护眼Pet 测试',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  console.log('3. 窗口已创建');

  win.loadFile('index.html').then(() => {
    console.log('4. HTML 加载成功!');
  }).catch(err => {
    console.error('HTML 加载失败:', err.message);
  });

  win.on('closed', () => {
    console.log('窗口已关闭');
    app.quit();
  });

  // 5秒后自动关闭
  setTimeout(() => {
    console.log('5秒测试完成，退出...');
    app.quit();
  }, 5000);
});

app.on('error', (err) => {
  console.error('App 错误:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err.message);
});
