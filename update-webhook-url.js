require('dotenv').config();
const axios = require('axios');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const CORRECT_WEBHOOK_URL = 'https://gold-clubs-fetch.loca.lt/webhook';

async function updateWebhookUrl() {
  console.log('🔧 更新 LINE Bot Webhook URL\n');
  
  try {
    // 1. 先檢查目前設定
    console.log('1️⃣ 檢查目前 Webhook 設定：');
    const currentResponse = await axios.get('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    });
    
    console.log('   目前 Webhook URL:', currentResponse.data.endpoint);
    console.log('   目前狀態:', currentResponse.data.active ? '啟用' : '停用');
    console.log('');
    
    // 2. 更新 Webhook URL
    console.log('2️⃣ 更新 Webhook URL：');
    console.log('   新的 URL:', CORRECT_WEBHOOK_URL);
    
    const updateResponse = await axios.put('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      endpoint: CORRECT_WEBHOOK_URL
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   ✅ Webhook URL 更新成功！');
    console.log('');
    
    // 3. 測試 Webhook URL
    console.log('3️⃣ 測試新的 Webhook URL：');
    const testResponse = await axios.post('https://api.line.me/v2/bot/channel/webhook/test', {}, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   測試結果:', testResponse.data.success ? '✅ 成功' : '❌ 失敗');
    if (testResponse.data.detail) {
      console.log('   詳細資訊:', testResponse.data.detail);
    }
    console.log('');
    
    console.log('✅ 完成！現在可以在 LINE 中傳送「任務」來測試 Flex Message');
    
  } catch (error) {
    console.error('❌ 更新失敗:', error.message);
    if (error.response) {
      console.error('   錯誤詳情:', error.response.data);
    }
    
    console.log('\n📝 手動設定步驟：');
    console.log('1. 前往 LINE Developers Console');
    console.log('2. 選擇您的 Channel');
    console.log('3. 到 Messaging API 頁籤');
    console.log('4. 在 Webhook Settings 區塊：');
    console.log('   - Webhook URL: ' + CORRECT_WEBHOOK_URL);
    console.log('   - Use webhook: 啟用');
    console.log('   - Webhook redelivery: 啟用');
    console.log('5. 點擊 Update 儲存設定');
  }
}

// 執行更新
updateWebhookUrl();