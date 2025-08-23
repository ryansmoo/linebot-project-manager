// 測試 Webhook 的腳本
const axios = require('axios');

// 模擬 LINE 平台發送的 webhook 事件
const testTaskMessage = {
  events: [
    {
      type: 'message',
      message: {
        type: 'text',
        text: '任務'
      },
      source: {
        userId: 'test-user-id'
      },
      replyToken: 'test-reply-token'
    }
  ]
};

const webhookUrl = 'https://huge-horses-hang.loca.lt/webhook';

// 注意：這只是測試用的腳本，實際的 LINE webhook 需要正確的簽名驗證
console.log('這是一個測試腳本，用於驗證 Flex Message 功能');
console.log('實際測試請在 LINE 應用程式中傳送 "任務" 訊息');
console.log(`Webhook URL: ${webhookUrl}`);