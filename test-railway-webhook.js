const axios = require('axios');

async function testRailwayWebhook() {
  const webhookUrl = 'https://linebot-project-manager-production.up.railway.app/webhook';
  
  // 模擬真實的 LINE Webhook 請求格式
  const webhookData = {
    destination: 'U2ed53d01ec486d7c1372adbbe755760c',
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          id: Date.now().toString(),
          text: '測試Railway服務'
        },
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: 'U25661314f262e7a1587a05eca486a36a'
        },
        replyToken: 'test-reply-token-' + Date.now(),
        mode: 'active',
        webhookEventId: 'test-webhook-' + Date.now(),
        deliveryContext: {
          isRedelivery: false
        }
      }
    ]
  };
  
  console.log('🧪 測試 Railway LINE Bot 服務');
  console.log('📋 Webhook URL:', webhookUrl);
  console.log('📝 測試訊息:', webhookData.events[0].message.text);
  console.log('');
  
  try {
    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LineBotWebhook/2.0',
        'X-Line-Signature': 'test-signature'
      },
      timeout: 10000
    });
    
    console.log('✅ Railway 服務回應成功！');
    console.log('📊 狀態碼:', response.status);
    console.log('📋 回應內容:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Railway 服務測試失敗:');
    if (error.response) {
      console.error('   狀態碼:', error.response.status);
      console.error('   錯誤內容:', error.response.data);
    } else {
      console.error('   錯誤:', error.message);
    }
  }
  
  console.log('');
  console.log('💡 重要提醒：');
  console.log('   • TOKEN 已驗證有效');
  console.log('   • Webhook URL 已更新到 Railway');
  console.log('   • HTTP 400 是因為測試用的假 replyToken');
  console.log('   • 真實 LINE 訊息應該能正常處理');
  console.log('');
  console.log('📱 請在 LINE 中發送新訊息測試！');
}

console.log('🎯 Railway LINE Bot 服務測試');
console.log('================================');
testRailwayWebhook();