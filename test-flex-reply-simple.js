require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();
const PORT = process.env.PORT || 3016;

// 簡化版 Flex Message
function createSimpleFlexMessage() {
  return {
    type: 'flex',
    altText: '測試訊息',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ Flex Message 測試成功！',
            weight: 'bold',
            size: 'lg',
            color: '#2196F3'
          },
          {
            type: 'text',
            text: '這是一個簡化的 Flex Message，用來驗證功能是否正常。',
            wrap: true,
            color: '#666666',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'message',
              label: '👍 功能正常',
              text: '功能測試完成'
            }
          }
        ]
      }
    }
  };
}

// 事件處理
async function handleEvent(event) {
  console.log('📨 收到事件:', event.type);
  console.log('📋 事件詳情:', JSON.stringify(event, null, 2));
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('⏭️ 跳過非文字訊息事件');
    return null;
  }
  
  const messageText = event.message.text;
  const userId = event.source.userId;
  
  console.log('💬 收到訊息:', messageText);
  console.log('👤 用戶 ID:', userId);
  console.log('🔑 Reply Token:', event.replyToken);
  
  try {
    let replyMessage;
    
    if (messageText === '任務' || messageText === 'flex' || messageText === '測試') {
      console.log('🎯 觸發 Flex Message');
      replyMessage = createSimpleFlexMessage();
      console.log('📋 Flex Message 結構已建立');
    } else {
      console.log('💬 發送簡單回覆');
      replyMessage = {
        type: 'text',
        text: `收到訊息: ${messageText}\n\n請傳送「任務」、「flex」或「測試」來觸發 Flex Message`
      };
    }
    
    console.log('🔄 準備發送回覆...');
    console.log('📤 回覆內容:', JSON.stringify(replyMessage, null, 2));
    
    const result = await client.replyMessage(event.replyToken, replyMessage);
    
    console.log('✅ 訊息發送成功！');
    console.log('📊 發送結果:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ 訊息發送失敗:', error);
    console.error('🔍 錯誤分析:');
    console.error('   - Message:', error.message);
    console.error('   - Status:', error.status);
    console.error('   - Status Text:', error.statusText);
    
    if (error.response) {
      console.error('   - Response Data:', error.response.data);
      console.error('   - Response Headers:', error.response.headers);
    }
    
    if (error.originalError) {
      console.error('   - Original Error:', error.originalError.message);
    }
    
    // 嘗試發送錯誤回覆
    try {
      console.log('🔄 嘗試發送錯誤通知...');
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '抱歉，系統發生錯誤，請稍後再試。'
      });
      console.log('✅ 錯誤通知發送成功');
    } catch (fallbackError) {
      console.error('❌ 連錯誤通知都無法發送:', fallbackError.message);
    }
    
    throw error;
  }
}

// Express 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 詳細的請求日誌中間件
app.use((req, res, next) => {
  console.log('\n=== 新的 HTTP 請求 ===');
  console.log('🕒 時間:', new Date().toLocaleString('zh-TW'));
  console.log('🌐 方法:', req.method);
  console.log('📍 路徑:', req.path);
  console.log('🔗 完整 URL:', req.originalUrl);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  
  next();
});

// Webhook 端點
app.get('/webhook', (req, res) => {
  console.log('🔍 GET /webhook - 驗證請求');
  res.status(200).send('LINE Bot Webhook is active and ready!');
});

app.post('/webhook', (req, res) => {
  console.log('\n📨 POST /webhook - 收到 LINE 事件');
  
  // 驗證請求
  if (!req.body) {
    console.log('❌ 請求 body 為空');
    return res.status(400).json({ error: 'Empty request body' });
  }
  
  if (!req.body.events) {
    console.log('❌ 沒有 events 欄位');
    return res.status(400).json({ error: 'No events field' });
  }
  
  console.log('📊 事件數量:', req.body.events.length);
  
  if (req.body.events.length === 0) {
    console.log('✅ 空事件陣列 - 驗證請求');
    return res.status(200).json({ status: 'OK', message: 'No events to process' });
  }
  
  // 處理所有事件
  Promise
    .all(req.body.events.map((event, index) => {
      console.log(`\n🔄 處理事件 ${index + 1}/${req.body.events.length}`);
      return handleEvent(event);
    }))
    .then(results => {
      console.log('\n✅ 所有事件處理完成');
      console.log('📊 處理結果:', results);
      
      res.status(200).json({ 
        status: 'OK', 
        message: 'All events processed',
        results: results
      });
    })
    .catch(err => {
      console.error('\n❌ 事件處理失敗:', err);
      
      res.status(200).json({ 
        status: 'ERROR_BUT_OK', 
        message: 'Event processing failed but returning 200 to prevent retry',
        error: err.message
      });
    });
});

// 健康檢查
app.get('/health', (req, res) => {
  console.log('🩺 健康檢查請求');
  res.json({
    status: 'OK',
    service: 'LINE Bot Flex Message Test',
    port: PORT,
    timestamp: new Date().toISOString(),
    config: {
      hasAccessToken: !!config.channelAccessToken,
      hasChannelSecret: !!config.channelSecret,
      tokenLength: config.channelAccessToken ? config.channelAccessToken.length : 0
    }
  });
});

// 啟動伺服器
const server = app.listen(PORT, () => {
  console.log('\n🚀 LINE Bot 測試伺服器啟動完成！');
  console.log('=================================');
  console.log(`📡 本地服務: http://localhost:${PORT}`);
  console.log(`🔗 Webhook 測試: http://localhost:${PORT}/webhook`);
  console.log(`🩺 健康檢查: http://localhost:${PORT}/health`);
  console.log('=================================');
  console.log('📝 設定資訊:');
  console.log('   Channel Access Token:', config.channelAccessToken ? '✓ 已設定' : '❌ 未設定');
  console.log('   Channel Secret:', config.channelSecret ? '✓ 已設定' : '❌ 未設定');
  console.log('=================================');
  console.log('⚡ 準備接收 LINE 訊息...');
  console.log('💡 傳送「任務」、「flex」或「測試」來觸發 Flex Message');
  console.log('=================================\n');
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🛑 收到中斷信號，正在關閉伺服器...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});