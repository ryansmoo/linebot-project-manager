#!/usr/bin/env node

// Google Calendar 整合快速設定腳本

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setupCalendarIntegration() {
  console.log('🚀 Google Calendar 整合設定助手\n');
  
  try {
    // 1. 收集必要資訊
    console.log('📋 請提供以下資訊來完成設定：\n');
    
    const googleScriptUrl = await question('Google Apps Script Web App URL: ');
    const googleClientId = await question('Google OAuth Client ID: ');
    const googleClientSecret = await question('Google OAuth Client Secret: ');
    
    // 2. 更新 LINE Bot 設定
    console.log('\n🔧 正在更新 LINE Bot 設定...');
    updateLineBotConfig(googleScriptUrl);
    
    // 3. 生成 Google Apps Script 程式碼
    console.log('📝 正在生成 Google Apps Script 程式碼...');
    generateGoogleAppsScriptCode(googleClientId, googleClientSecret, googleScriptUrl);
    
    // 4. 安裝必要的依賴
    console.log('📦 正在檢查依賴...');
    await installDependencies();
    
    console.log('\n✅ 設定完成！');
    console.log('\n📖 後續步驟：');
    console.log('1. 將生成的程式碼複製到 Google Apps Script');
    console.log('2. 在 Google Apps Script 中部署為網路應用程式');
    console.log('3. 在 Google Cloud Console 設定重新導向 URI');
    console.log('4. 啟動 LINE Bot 服務');
    console.log('\n詳細說明請參考 GOOGLE_CALENDAR_INTEGRATION_SETUP.md');
    
  } catch (error) {
    console.error('❌ 設定過程發生錯誤:', error.message);
  } finally {
    rl.close();
  }
}

// 更新 LINE Bot 設定
function updateLineBotConfig(googleScriptUrl) {
  const lineBotPath = path.join(__dirname, 'LINE BOT', 'app.js');
  
  if (fs.existsSync(lineBotPath)) {
    let content = fs.readFileSync(lineBotPath, 'utf8');
    content = content.replace(
      'const GOOGLE_SCRIPT_URL = \'YOUR_GOOGLE_APPS_SCRIPT_URL\';',
      `const GOOGLE_SCRIPT_URL = '${googleScriptUrl}';`
    );
    fs.writeFileSync(lineBotPath, content);
    console.log('   ✓ LINE Bot 設定已更新');
  } else {
    console.log('   ⚠️ 找不到 LINE Bot 檔案');
  }
}

// 生成 Google Apps Script 程式碼
function generateGoogleAppsScriptCode(clientId, clientSecret, scriptUrl) {
  const templatePath = path.join(__dirname, 'google-apps-script-calendar.js');
  const outputPath = path.join(__dirname, 'google-apps-script-configured.js');
  
  if (fs.existsSync(templatePath)) {
    let content = fs.readFileSync(templatePath, 'utf8');
    content = content.replace(/YOUR_GOOGLE_CLIENT_ID/g, clientId);
    content = content.replace(/YOUR_GOOGLE_CLIENT_SECRET/g, clientSecret);
    
    fs.writeFileSync(outputPath, content);
    console.log('   ✓ Google Apps Script 程式碼已生成');
    console.log(`   📄 檔案位置: ${outputPath}`);
  } else {
    console.log('   ⚠️ 找不到 Google Apps Script 範本檔案');
  }
}

// 安裝依賴
async function installDependencies() {
  const { spawn } = require('child_process');
  
  // 檢查是否有 package.json
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('   ⚠️ 找不到 package.json，請確保在正確的專案目錄');
    return;
  }
  
  // 檢查是否已安裝 axios
  try {
    require.resolve('axios');
    console.log('   ✓ axios 已安裝');
  } catch (e) {
    console.log('   📦 正在安裝 axios...');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', 'axios'], { stdio: 'pipe' });
      
      npm.on('close', (code) => {
        if (code === 0) {
          console.log('   ✓ axios 安裝完成');
          resolve();
        } else {
          console.log('   ❌ axios 安裝失敗');
          reject(new Error('axios 安裝失敗'));
        }
      });
    });
  }
}

// 驗證設定
async function validateSetup() {
  console.log('\n🔍 驗證設定...');
  
  // 檢查檔案是否存在
  const requiredFiles = [
    'LINE BOT/app.js',
    'google-apps-script-configured.js',
    'GOOGLE_CALENDAR_INTEGRATION_SETUP.md'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ✓ ${file} 存在`);
    } else {
      console.log(`   ❌ ${file} 不存在`);
    }
  });
}

// 主程序
if (require.main === module) {
  setupCalendarIntegration()
    .then(() => validateSetup())
    .catch(error => {
      console.error('設定失敗:', error);
      process.exit(1);
    });
}

module.exports = {
  setupCalendarIntegration,
  updateLineBotConfig,
  generateGoogleAppsScriptCode,
  installDependencies,
  validateSetup
};