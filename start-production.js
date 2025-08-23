// 生產環境啟動腳本
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 啟動生產環境 LINE Bot...');
console.log('📝 Node.js 版本:', process.version);
console.log('🌍 環境變數:', process.env.NODE_ENV);
console.log('🔌 端口:', process.env.PORT || 3000);

// 啟動主應用程式
const appPath = path.join(__dirname, 'app.js');
const child = spawn('node', [appPath], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('exit', (code, signal) => {
  console.log(`❌ 應用程式結束，退出碼: ${code}, 信號: ${signal}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ 啟動錯誤:', error);
  process.exit(1);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
  console.log('📋 收到 SIGTERM 信號，正在關閉應用程式...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📋 收到 SIGINT 信號，正在關閉應用程式...');
  child.kill('SIGINT');
});