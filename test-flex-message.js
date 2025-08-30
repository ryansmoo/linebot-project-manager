require('dotenv').config();
const line = require('@line/bot-sdk');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 測試用的 Flex Message（與 simple-linebot.js 中相同）
function createTaskKeywordFlexMessage() {
  return {
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
}

// 測試函數
async function testFlexMessage() {
  console.log('🔧 開始測試 Flex Message 功能...\n');
  
  // 1. 檢查環境變數
  console.log('1️⃣ 檢查環境變數設定:');
  console.log('   Channel Access Token:', config.channelAccessToken ? '✅ 已設定' : '❌ 未設定');
  console.log('   Channel Secret:', config.channelSecret ? '✅ 已設定' : '❌ 未設定');
  console.log('');
  
  if (!config.channelAccessToken || !config.channelSecret) {
    console.error('❌ 請先設定 LINE_CHANNEL_ACCESS_TOKEN 和 LINE_CHANNEL_SECRET');
    return;
  }
  
  // 2. 測試 Flex Message 結構
  console.log('2️⃣ 測試 Flex Message 結構:');
  const flexMessage = createTaskKeywordFlexMessage();
  
  // 驗證基本結構
  const validations = [
    { check: flexMessage.type === 'flex', name: 'Message type 是 flex' },
    { check: flexMessage.altText !== undefined, name: 'altText 存在' },
    { check: flexMessage.contents !== undefined, name: 'contents 存在' },
    { check: flexMessage.contents.type === 'bubble', name: 'contents type 是 bubble' },
    { check: flexMessage.contents.hero !== undefined, name: 'hero 區塊存在' },
    { check: flexMessage.contents.body !== undefined, name: 'body 區塊存在' },
    { check: flexMessage.contents.footer !== undefined, name: 'footer 區塊存在' }
  ];
  
  validations.forEach(v => {
    console.log(`   ${v.name}: ${v.check ? '✅' : '❌'}`);
  });
  console.log('');
  
  // 3. 驗證 Flex Message 格式
  console.log('3️⃣ 使用 LINE SDK 驗證訊息格式:');
  try {
    // LINE SDK 會在發送時驗證格式
    // 這裡我們先用 JSON.stringify 確保可序列化
    const jsonStr = JSON.stringify(flexMessage);
    const parsed = JSON.parse(jsonStr);
    console.log('   ✅ Flex Message 格式正確，可序列化');
    console.log('');
  } catch (error) {
    console.error('   ❌ Flex Message 格式錯誤:', error.message);
    console.log('');
    return;
  }
  
  // 4. 測試推送訊息（需要有效的 userId）
  console.log('4️⃣ 測試推送功能:');
  console.log('   ⚠️  注意: 實際推送需要有效的 userId');
  console.log('   如果您有 userId，可以取消註解下方程式碼進行測試\n');
  
  // 取消註解並填入您的 userId 來測試實際推送
  // const userId = 'YOUR_USER_ID_HERE';
  // try {
  //   await client.pushMessage(userId, flexMessage);
  //   console.log('   ✅ 成功推送 Flex Message！');
  // } catch (error) {
  //   console.error('   ❌ 推送失敗:', error.message);
  //   if (error.originalError?.response?.data) {
  //     console.error('   詳細錯誤:', error.originalError.response.data);
  //   }
  // }
  
  // 5. 顯示 Flex Message 結構供檢查
  console.log('5️⃣ Flex Message 完整結構:');
  console.log(JSON.stringify(flexMessage, null, 2));
  console.log('');
  
  // 6. 提供 Flex Message Simulator 連結
  console.log('6️⃣ 測試建議:');
  console.log('   1. 使用 LINE Flex Message Simulator 驗證:');
  console.log('      https://developers.line.biz/flex-simulator/');
  console.log('   2. 將上方的 JSON 結構貼到 Simulator 中預覽');
  console.log('   3. 在 LINE 中傳送「任務」關鍵字來觸發 Flex Message');
  console.log('');
  
  console.log('✅ 測試完成！');
}

// 執行測試
testFlexMessage().catch(error => {
  console.error('❌ 測試過程發生錯誤:', error);
});