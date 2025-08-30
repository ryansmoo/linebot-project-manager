require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { spawn } = require('child_process');
const axios = require('axios');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();
const PORT = process.env.PORT || 3016;

// Flex Message 函數
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

// 事件處理
async function handleEvent(event) {
  console.log('📨 收到事件:', event.type);
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }
  
  const messageText = event.message.text;
  console.log('💬 收到訊息:', messageText);
  
  // 處理「任務」關鍵字
  if (messageText === '任務') {
    console.log('🎯 觸發任務關鍵字 - 準備發送 Flex Message');
    
    try {
      const flexMessage = createTaskKeywordFlexMessage();
      console.log('📋 Flex Message 已建立');
      console.log('🔄 正在發送回覆...');
      
      const result = await client.replyMessage(event.replyToken, flexMessage);
      console.log('✅ Flex Message 發送成功！', result);
      return result;
      
    } catch (error) {
      console.error('❌ 發送 Flex Message 失敗:', error);
      console.error('錯誤詳情:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        response: error.response?.data
      });
      
      // 發送簡單文字訊息作為備案
      try {
        return await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '收到您的任務！但系統暫時無法顯示完整介面，請稍後再試。'
        });
      } catch (fallbackError) {
        console.error('❌ 備案訊息也發送失敗:', fallbackError);
      }
    }
  }
  
  // 其他訊息的簡單回覆
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `您說：${messageText}\n\n請輸入「任務」來測試 Flex Message 功能。`
  });
}

// Express 設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook 端點
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook GET 驗證請求');
  res.status(200).send('Webhook is active');
});

app.post('/webhook', (req, res) => {
  console.log('📨 收到 Webhook POST 請求');
  console.log('📋 請求內容:', JSON.stringify(req.body, null, 2));
  
  if (!req.body.events || req.body.events.length === 0) {
    console.log('✅ 空白事件或驗證請求');
    return res.status(200).json({ status: 'OK' });
  }
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => {
      console.log('✅ 所有事件處理完成');
      res.status(200).json({ status: 'OK', result });
    })
    .catch(err => {
      console.error('❌ 事件處理錯誤:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'LINE Bot Flex Message Test',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// 啟動伺服器
const server = app.listen(PORT, () => {
  console.log('🚀 LINE Bot 測試伺服器啟動成功！');
  console.log(`📡 本地服務: http://localhost:${PORT}`);
  console.log('🔗 Webhook 端點: /webhook');
  console.log('🩺 健康檢查: /health');
  console.log('');
  console.log('⏳ 準備啟動 ngrok tunnel...');
  
  // 啟動 ngrok
  const ngrok = spawn('ngrok', ['http', PORT.toString()], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let ngrokUrl = '';
  
  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📡 ngrok:', output.trim());
    
    // 提取 ngrok URL
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
    if (urlMatch && !ngrokUrl) {
      ngrokUrl = urlMatch[0];
      console.log('');
      console.log('✅ ngrok tunnel 已建立！');
      console.log('🌐 公開 URL:', ngrokUrl);
      console.log('🔗 Webhook URL:', ngrokUrl + '/webhook');
      console.log('');
      console.log('請將此 Webhook URL 設定到 LINE Developers Console');
      console.log('然後在 LINE 中傳送「任務」來測試 Flex Message');
      
      // 自動更新 Webhook URL
      updateWebhookUrl(ngrokUrl + '/webhook');
    }
  });
  
  ngrok.stderr.on('data', (data) => {
    console.log('⚠️ ngrok error:', data.toString().trim());
  });
  
  ngrok.on('close', (code) => {
    console.log(`📡 ngrok process exited with code ${code}`);
  });
  
  // 優雅關閉
  process.on('SIGINT', () => {
    console.log('\n🛑 正在關閉服務...');
    ngrok.kill();
    server.close(() => {
      console.log('✅ 服務已關閉');
      process.exit(0);
    });
  });
});

// 自動更新 Webhook URL
async function updateWebhookUrl(webhookUrl) {
  try {
    console.log('🔄 自動更新 LINE Webhook URL...');
    await axios.put('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      endpoint: webhookUrl
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Webhook URL 更新成功！');
  } catch (error) {
    console.error('❌ 自動更新 Webhook URL 失敗:', error.message);
    console.log('請手動到 LINE Developers Console 更新 Webhook URL');
  }
}