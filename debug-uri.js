// 調試確切的 redirect_uri
require('dotenv').config();
const { google } = require('googleapis');

console.log('🔍 調試 redirect_uri 不匹配問題');
console.log('====================================');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

console.log('CLIENT_ID:', clientId);
console.log('REDIRECT_URI:', redirectUri);

// 創建 OAuth2 客戶端
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// 生成授權 URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ],
  state: JSON.stringify({ userId: 'debug-user', test: true }),
  prompt: 'consent'
});

console.log('\n🔗 完整的授權 URL:');
console.log(authUrl);

// 解析 URL 中的 redirect_uri 參數
const url = new URL(authUrl);
const actualRedirectUri = decodeURIComponent(url.searchParams.get('redirect_uri'));

console.log('\n📋 重要資訊:');
console.log('實際發送的 redirect_uri:', actualRedirectUri);
console.log('環境變數中的 REDIRECT_URI:', redirectUri);
console.log('是否完全匹配:', actualRedirectUri === redirectUri ? '✅ 是' : '❌ 否');

console.log('\n📝 您需要在 Google Cloud Console 中確保有這個確切的 URI:');
console.log(`"${actualRedirectUri}"`);

console.log('\n🔧 Google Cloud Console 步驟:');
console.log('1. 前往: https://console.cloud.google.com/apis/credentials');
console.log('2. 點擊您的 OAuth 2.0 用戶端 ID');
console.log('3. 在「已授權的重新導向 URI」中新增:');
console.log(`   ${actualRedirectUri}`);
console.log('4. 刪除任何舊的/不匹配的 URI');
console.log('5. 點擊「儲存」');
console.log('6. 等待 1-2 分鐘生效');

// 檢查隧道狀態
const https = require('https');
const tunnel_url = 'https://metal-lions-help.loca.lt';

https.get(`${tunnel_url}/health`, (res) => {
  console.log('\n🌐 隧道狀態檢查:');
  console.log(`${tunnel_url}/health - 狀態碼: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('✅ 隧道正常運作');
  } else {
    console.log('❌ 隧道可能有問題');
  }
}).on('error', (err) => {
  console.log('\n🌐 隧道狀態檢查:');
  console.log('❌ 隧道連接失敗:', err.message);
});