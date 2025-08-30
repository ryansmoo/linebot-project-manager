require('dotenv').config();
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const WEBHOOK_URL = 'https://6fbf206f20b3.ngrok-free.app/webhook';

async function updateWebhook() {
  console.log('🔧 更新 LINE Bot Webhook 設定');
  console.log('新的 Webhook URL:', WEBHOOK_URL);
  
  try {
    // 更新 Webhook URL
    await axios.put('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      endpoint: WEBHOOK_URL
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Webhook URL 更新成功！');
    console.log('📱 現在可以在 LINE 中測試任務堆疊 Flex Message 功能');
    
  } catch (error) {
    console.error('❌ 設定失敗:', error.message);
  }
}

updateWebhook();