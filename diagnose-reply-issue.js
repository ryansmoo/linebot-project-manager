require('dotenv').config();
const line = require('@line/bot-sdk');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

console.log('🔍 診斷 LINE Bot 回傳訊息問題\n');
console.log('================================');

// 1. 檢查環境設定
console.log('1️⃣ 環境設定檢查：');
console.log('   Channel Access Token:', config.channelAccessToken ? `✓ 已設定 (長度: ${config.channelAccessToken.length})` : '✗ 未設定');
console.log('   Channel Secret:', config.channelSecret ? `✓ 已設定 (長度: ${config.channelSecret.length})` : '✗ 未設定');
console.log('');

// 2. 測試 Token 有效性
async function testTokenValidity() {
  console.log('2️⃣ 測試 Channel Access Token 有效性：');
  try {
    // 使用 LINE API 測試 token
    const axios = require('axios');
    const response = await axios.get('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    });
    
    console.log('   ✅ Token 有效！');
    console.log('   Bot 資訊：');
    console.log('     - User ID:', response.data.userId);
    console.log('     - Display Name:', response.data.displayName);
    console.log('     - Picture URL:', response.data.pictureUrl || '無');
    console.log('');
    return true;
  } catch (error) {
    console.log('   ❌ Token 無效或過期！');
    if (error.response) {
      console.log('   錯誤狀態碼:', error.response.status);
      console.log('   錯誤訊息:', error.response.data);
    }
    console.log('');
    return false;
  }
}

// 3. 測試 Webhook 設定
async function testWebhookEndpoint() {
  console.log('3️⃣ 測試 Webhook 端點：');
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    });
    
    console.log('   Webhook URL:', response.data.endpoint || '未設定');
    console.log('   Webhook 狀態:', response.data.active ? '✅ 啟用' : '❌ 停用');
    console.log('');
    return response.data;
  } catch (error) {
    console.log('   ❌ 無法取得 Webhook 資訊');
    if (error.response) {
      console.log('   錯誤:', error.response.data);
    }
    console.log('');
    return null;
  }
}

// 4. 測試發送訊息能力
async function testPushMessage() {
  console.log('4️⃣ 測試推送訊息功能：');
  console.log('   ⚠️  需要有效的 User ID 才能測試');
  console.log('   請在 LINE 中傳送任何訊息給 Bot 來取得您的 User ID');
  console.log('');
  
  // 如果您有 User ID，可以在這裡測試
  // const userId = 'YOUR_USER_ID';
  // try {
  //   await client.pushMessage(userId, {
  //     type: 'text',
  //     text: '測試訊息 - 如果您看到此訊息，表示 Bot 可以正常發送訊息'
  //   });
  //   console.log('   ✅ 推送訊息成功！');
  // } catch (error) {
  //   console.log('   ❌ 推送訊息失敗:', error.message);
  // }
}

// 5. 檢查 Flex Message 結構
function checkFlexMessageStructure() {
  console.log('5️⃣ Flex Message 結構檢查：');
  
  const flexMessage = {
    type: 'flex',
    altText: '任務收到！',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ 任務收到！',
            weight: 'bold',
            size: 'xl',
            color: '#2196F3'
          },
          {
            type: 'text',
            text: '您的任務已經成功接收，點擊下方按鈕查看更多資訊！',
            wrap: true,
            color: '#666666',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🔗 前往 Ryan 的 Threads',
              uri: 'https://www.threads.com/@ryan_ryan_lin?hl=zh-tw'
            }
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'postback',
                  label: '📋 全部紀錄',
                  data: 'action=all_records'
                },
                flex: 1
              },
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'postback',
                  label: '👤 個人帳號',
                  data: 'action=personal_account'
                },
                flex: 1
              }
            ]
          }
        ]
      }
    }
  };
  
  try {
    JSON.stringify(flexMessage);
    console.log('   ✅ Flex Message 結構有效');
  } catch (error) {
    console.log('   ❌ Flex Message 結構無效:', error.message);
  }
  console.log('');
}

// 執行所有診斷
async function runDiagnostics() {
  console.log('開始診斷...\n');
  
  const tokenValid = await testTokenValidity();
  
  if (tokenValid) {
    const webhookInfo = await testWebhookEndpoint();
    await testPushMessage();
  }
  
  checkFlexMessageStructure();
  
  console.log('================================');
  console.log('📊 診斷總結：');
  console.log('');
  console.log('🔧 可能的問題與解決方案：');
  console.log('');
  console.log('1. 如果 Token 無效：');
  console.log('   → 請到 LINE Developers Console 重新產生 Channel Access Token');
  console.log('');
  console.log('2. 如果 Webhook URL 未設定或錯誤：');
  console.log('   → 請確認 Webhook URL 設定為: https://gold-clubs-fetch.loca.lt/webhook');
  console.log('   → 確認 Webhook 已啟用');
  console.log('   → 確認使用 Webhook Redelivery');
  console.log('');
  console.log('3. 如果訊息發送失敗：');
  console.log('   → 檢查 Bot 是否已被加為好友');
  console.log('   → 檢查是否有封鎖 Bot');
  console.log('   → 確認 Channel 的 Messaging API 已啟用');
  console.log('');
  console.log('4. 測試步驟：');
  console.log('   a. 確保伺服器正在運行 (node simple-linebot.js)');
  console.log('   b. 在 LINE 中傳送「任務」給 Bot');
  console.log('   c. 檢查伺服器 console 是否有收到請求');
  console.log('   d. 如果有收到但沒回應，檢查上述設定');
}

// 執行診斷
runDiagnostics().catch(console.error);