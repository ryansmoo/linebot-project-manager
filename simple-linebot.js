require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'eaaf339ed4aa0a351b5893f10d4581c5'
};

// 驗證必要的環境變數
if (!config.channelAccessToken || config.channelAccessToken === 'your_channel_access_token_here') {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定！');
}

if (!config.channelSecret || config.channelSecret === 'your_channel_secret_here') {
  console.error('❌ LINE_CHANNEL_SECRET 未設定！');
}

const client = new line.Client(config);
const app = express();

// 基本設定
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : `http://localhost:${PORT}`;

// 靜態檔案服務 - 提供 LIFF APP
app.use('/liff', express.static(path.join(__dirname, 'liff-simple')));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Webhook 驗證端點 - 在 middleware 之前
app.get('/webhook', (req, res) => {
  console.log('🔍 Webhook GET 請求 (驗證)');
  res.status(200).send('Webhook endpoint is active');
});

// LINE Bot Webhook - 加強錯誤處理
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('📨 收到 Webhook 請求:', new Date().toLocaleTimeString());
  console.log('📋 事件數量:', req.body.events ? req.body.events.length : 0);
  
  if (!req.body.events || req.body.events.length === 0) {
    console.log('✅ Webhook 驗證請求');
    return res.status(200).json({ status: 'OK' });
  }

  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => {
      console.log('✅ 事件處理完成');
      res.status(200).json({ status: 'OK', result });
    })
    .catch(err => {
      console.error('❌ Webhook 錯誤:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'LINE Bot',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// 主要事件處理
async function handleEvent(event) {
  try {
    console.log('🔄 處理事件:', event.type);
    
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('⏭️ 跳過非文字訊息事件');
      return null;
    }

    const userId = event.source.userId;
    const messageText = event.message.text;

    console.log('💬 收到訊息:', messageText, 'from user:', userId.substring(0, 10) + '...');

    // 建立 FLEX Message + Quick Reply
    const flexMessage = createTaskManagementFlex();
    const quickReply = createQuickReply();

    const replyMessage = {
      type: 'flex',
      altText: '任務管理介面',
      contents: flexMessage,
      quickReply: quickReply
    };

    console.log('📤 發送 FLEX 訊息...');
    const result = await client.replyMessage(event.replyToken, replyMessage);
    console.log('✅ 訊息發送成功');
    
    return result;
  } catch (error) {
    console.error('❌ 事件處理錯誤:', error);
    
    // 發送簡單文字訊息作為備案
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '抱歉，系統暫時出現問題，請稍後再試。'
      });
    } catch (fallbackError) {
      console.error('❌ 備案訊息也失敗:', fallbackError);
    }
    
    throw error;
  }
}

// 建立任務管理 FLEX Message
function createTaskManagementFlex() {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📝 任務管理中心",
          weight: "bold",
          size: "lg",
          color: "#ffffff"
        }
      ],
      backgroundColor: "#00B900",
      paddingAll: "20px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "歡迎使用任務管理系統",
          size: "md",
          color: "#666666"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🎯 點擊下方按鈕開始使用：",
              size: "sm",
              color: "#333333",
              margin: "md"
            }
          ]
        }
      ],
      spacing: "md"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "📱 開啟任務管理",
            uri: `${BASE_URL}/liff/tasks.html`
          },
          color: "#00B900"
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "uri",
            label: "👤 個人資料",
            uri: `${BASE_URL}/liff/profile.html`
          },
          margin: "sm"
        }
      ],
      spacing: "sm"
    }
  };
}

// 建立 Quick Reply
function createQuickReply() {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'uri',
          label: '📝 任務',
          uri: `${BASE_URL}/liff/tasks.html`
        }
      },
      {
        type: 'action',
        action: {
          type: 'uri',
          label: '👤 帳戶',
          uri: `${BASE_URL}/liff/profile.html`
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '❓ 說明',
          text: '說明'
        }
      }
    ]
  };
}

// 啟動服務器
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 精簡版 LINE Bot 啟動成功！');
  console.log(`📡 服務運行於: ${BASE_URL}`);
  console.log(`🔗 Webhook URL: ${BASE_URL}/webhook`);
  console.log(`📱 LIFF 任務頁面: ${BASE_URL}/liff/tasks.html`);
  console.log(`👤 LIFF 個人頁面: ${BASE_URL}/liff/profile.html`);
  console.log('📝 請將 Webhook URL 設定到 LINE Developer Console');
  console.log('⚡ 準備接收 LINE 訊息...');
});