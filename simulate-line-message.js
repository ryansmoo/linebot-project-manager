const axios = require('axios');

// 模擬 LINE 發送的 Webhook 請求
async function simulateLineMessage() {
  const webhookUrl = 'https://honest-breads-accept.loca.lt/webhook';
  
  // 模擬用戶發送「任務」訊息
  const webhookData = {
    destination: 'U2ed53d01ec486d7c1372adbbe755760c', // Bot 的 User ID
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          id: Date.now().toString(),
          text: '任務'
        },
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: 'Utest' + Date.now() // 模擬的用戶 ID
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
  
  console.log('📤 模擬 LINE 用戶發送「任務」訊息...');
  console.log('🔗 目標 URL:', webhookUrl);
  console.log('');
  
  try {
    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': 'test-signature', // 在實際環境中這需要正確的簽名
        'User-Agent': 'LineBotWebhook/2.0'
      }
    });
    
    console.log('✅ Webhook 請求成功發送！');
    console.log('📊 回應狀態:', response.status);
    console.log('📋 回應內容:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('🔍 請檢查伺服器 console 輸出來確認：');
    console.log('   1. 是否收到 Webhook 請求');
    console.log('   2. 是否觸發 Flex Message 處理');
    console.log('   3. 是否成功回傳訊息');
    console.log('');
    console.log('⚠️  注意：由於使用測試 replyToken，實際的訊息發送會失敗');
    console.log('   但可以確認 Bot 的處理邏輯是否正常');
    
  } catch (error) {
    console.error('❌ Webhook 請求失敗:');
    if (error.response) {
      console.error('   狀態碼:', error.response.status);
      console.error('   回應內容:', error.response.data);
    } else {
      console.error('   錯誤:', error.message);
    }
  }
}

console.log('🧪 開始模擬 LINE 訊息測試\n');
simulateLineMessage();