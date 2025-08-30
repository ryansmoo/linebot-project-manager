const axios = require('axios');

// 模擬用戶新增任務的 Webhook 請求
async function simulateTaskAddition() {
  const webhookUrl = 'https://6fbf206f20b3.ngrok-free.app/webhook';
  
  // 模擬用戶發送新增任務訊息
  const webhookData = {
    destination: 'U2ed53d01ec486d7c1372adbbe755760c',
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          id: Date.now().toString(),
          text: '完成任務堆疊 Flex Message 功能測試'
        },
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: 'U25661314f262e7a1587a05eca486a36a' // 使用實際的用戶 ID
        },
        replyToken: 'real-reply-token-' + Date.now(), // 這個是模擬的
        mode: 'active',
        webhookEventId: 'test-webhook-' + Date.now(),
        deliveryContext: {
          isRedelivery: false
        }
      }
    ]
  };
  
  console.log('🧪 模擬新增任務以測試任務堆疊 Flex Message');
  console.log('📋 任務內容:', webhookData.events[0].message.text);
  console.log('');
  
  try {
    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': 'test-signature',
        'User-Agent': 'LineBotWebhook/2.0'
      }
    });
    
    console.log('✅ 測試請求發送成功！');
    console.log('📊 回應狀態:', response.status);
    console.log('📋 回應內容:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('🔍 請檢查伺服器輸出確認：');
    console.log('   1. 是否收到任務新增請求');
    console.log('   2. 是否建立了兩則 Flex Message');
    console.log('   3. 第一則：任務確認訊息');
    console.log('   4. 第二則：完整任務列表');
    console.log('   5. 是否包含 Quick Reply 選項');
    console.log('');
    console.log('⚠️  注意：由於使用模擬 replyToken，實際發送會失敗');
    console.log('   但可確認 Flex Message 建立邏輯是否正常');
    
  } catch (error) {
    console.error('❌ 測試請求失敗:');
    if (error.response) {
      console.error('   狀態碼:', error.response.status);
      console.error('   回應內容:', error.response.data);
    } else {
      console.error('   錯誤:', error.message);
    }
  }
}

console.log('🎯 任務堆疊 Flex Message 測試');
console.log('================================');
simulateTaskAddition();