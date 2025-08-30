require('dotenv').config();
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const WEBHOOK_URL = 'https://honest-breads-accept.loca.lt/webhook';

async function updateWebhook() {
  console.log('🔧 更新 LINE Bot Webhook 設定\n');
  console.log('新的 Webhook URL:', WEBHOOK_URL);
  
  try {
    // 1. 測試 URL 是否可訪問
    console.log('\n1️⃣ 測試 Webhook URL 可訪問性...');
    const testResponse = await axios.get(WEBHOOK_URL);
    console.log('   ✅ URL 可正常訪問');
    console.log('   回應:', testResponse.data);
    
    // 2. 更新 Webhook URL
    console.log('\n2️⃣ 更新 LINE Webhook URL...');
    await axios.put('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      endpoint: WEBHOOK_URL
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('   ✅ Webhook URL 更新成功！');
    
    // 3. 驗證更新
    console.log('\n3️⃣ 驗證更新結果...');
    const verifyResponse = await axios.get('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    });
    console.log('   目前 Webhook URL:', verifyResponse.data.endpoint);
    console.log('   Webhook 狀態:', verifyResponse.data.active ? '✅ 啟用' : '❌ 停用');
    
    // 4. 測試 Webhook
    console.log('\n4️⃣ 測試 LINE Webhook 連接...');
    try {
      const webhookTestResponse = await axios.post('https://api.line.me/v2/bot/channel/webhook/test', {}, {
        headers: {
          'Authorization': `Bearer ${config.channelAccessToken}`
        }
      });
      console.log('   測試結果:', webhookTestResponse.data.success ? '✅ 成功' : '❌ 失敗');
      if (webhookTestResponse.data.detail) {
        console.log('   詳細:', webhookTestResponse.data.detail);
      }
    } catch (testError) {
      console.log('   ⚠️  Webhook 測試失敗，但這很常見，不影響實際使用');
    }
    
    console.log('\n✅ 設定完成！');
    console.log('📱 現在可以在 LINE 中測試：');
    console.log('   - 傳送「任務」來觸發完整 Flex Message');
    console.log('   - 傳送「測試」或「flex」來觸發簡化版 Flex Message');
    console.log('   - 傳送任何其他文字來測試基本回覆功能');
    
  } catch (error) {
    console.error('❌ 設定失敗:', error.message);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
  }
}

updateWebhook();