const axios = require('axios');

// 模擬 LINE Webhook 請求
async function simulateLineWebhook() {
  const webhookUrl = 'http://localhost:3016/webhook';
  
  // 模擬用戶發送「任務」關鍵字的事件
  const webhookData = {
    destination: 'U1234567890abcdef1234567890abcdef',
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          id: '123456789',
          text: '任務'
        },
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: 'Utest123456789'
        },
        replyToken: 'test-reply-token-' + Date.now(),
        mode: 'active',
        webhookEventId: 'test-webhook-event-id',
        deliveryContext: {
          isRedelivery: false
        }
      }
    ]
  };
  
  console.log('📤 發送模擬 Webhook 請求...');
  console.log('   請求內容:', JSON.stringify(webhookData, null, 2));
  console.log('');
  
  try {
    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': 'mock-signature' // 實際環境中需要正確的簽名
      }
    });
    
    console.log('✅ Webhook 請求成功！');
    console.log('   回應狀態:', response.status);
    console.log('   回應內容:', response.data);
    console.log('');
    console.log('📝 注意事項:');
    console.log('   1. 此測試僅驗證 webhook 端點可接收請求');
    console.log('   2. 實際的 Flex Message 會透過 replyToken 發送給用戶');
    console.log('   3. 請查看 simple-linebot.js 的 console 輸出確認處理狀況');
    console.log('   4. 在真實環境中，需要在 LINE 中傳送「任務」來觸發');
    
  } catch (error) {
    console.error('❌ Webhook 請求失敗:');
    if (error.response) {
      console.error('   狀態碼:', error.response.status);
      console.error('   錯誤訊息:', error.response.data);
    } else {
      console.error('   錯誤:', error.message);
    }
  }
}

// 執行測試
console.log('🔧 開始測試 LINE Bot Flex Message 回傳功能\n');
simulateLineWebhook();