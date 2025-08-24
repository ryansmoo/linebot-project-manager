const line = require('@line/bot-sdk');
const express = require('express');
const axios = require('axios');

const config = {
  channelAccessToken: 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eaaf339ed4aa0a351b5893f10d4581c5'
};

// Google Apps Script Web App URL - 請替換成你的 Google Apps Script 部署 URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJS4Yho7R0UZASLIEEf-xsTzl9OLrT8BUh21Vkc3_zAO5gXTQy3l0uiUL8caw9fTDU/exec';

const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('🔔 Received webhook request:', req.body);
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('Error handling events:', err);
      res.status(500).send('Internal Server Error');
    });
});

async function handleEvent(event) {
  console.log('Received event:', event);
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  const userId = event.source.userId;
  const userMessage = event.message.text.trim();
  
  try {
    // 處理行事曆相關指令
    if (userMessage === '綁定行事曆' || userMessage === '授權行事曆') {
      return handleCalendarAuth(event.replyToken, userId);
    }
    
    if (userMessage.startsWith('新增事件 ') || userMessage.startsWith('加入事件 ')) {
      return handleAddEvent(event.replyToken, userId, userMessage);
    }
    
    if (userMessage === '查看行程' || userMessage === '今日行程') {
      return handleListEvents(event.replyToken, userId);
    }
    
    if (userMessage.startsWith('刪除事件 ')) {
      return handleDeleteEvent(event.replyToken, userId, userMessage);
    }
    
    if (userMessage === '行事曆幫助' || userMessage === 'help') {
      return showCalendarHelp(event.replyToken);
    }
    
    // 預設回音功能
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `收到訊息: ${userMessage}\n\n輸入「行事曆幫助」查看可用指令`
    });
    
  } catch (err) {
    console.error('Error handling event:', err);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '處理訊息時發生錯誤，請稍後再試。'
    });
  }
}

// 處理行事曆授權
async function handleCalendarAuth(replyToken, userId) {
  try {
    const authUrl = `${GOOGLE_SCRIPT_URL}?action=authorize&lineUserId=${userId}`;
    
    const flexMessage = {
      type: 'flex',
      altText: '綁定 Google Calendar',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🗓️ Google Calendar',
              weight: 'bold',
              size: 'xl',
              color: '#4285f4'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '請點擊下方按鈕授權綁定你的 Google Calendar',
              wrap: true,
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
                type: 'uri',
                label: '🔗 綁定 Google Calendar',
                uri: authUrl
              },
              color: '#4285f4'
            }
          ]
        }
      }
    };
    
    return client.replyMessage(replyToken, flexMessage);
    
  } catch (error) {
    console.error('Calendar auth error:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '授權過程發生錯誤，請稍後再試。'
    });
  }
}

// 處理新增事件
async function handleAddEvent(replyToken, userId, message) {
  try {
    // 解析事件資訊 (格式: 新增事件 標題|開始時間|結束時間|描述)
    const eventData = message.replace(/^(新增事件|加入事件)\s/, '').split('|');
    
    if (eventData.length < 3) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '請使用正確格式：\n新增事件 標題|開始時間|結束時間|描述\n\n範例：\n新增事件 會議|2024-01-01 10:00|2024-01-01 11:00|重要會議'
      });
    }
    
    const [title, startTime, endTime, description = ''] = eventData.map(item => item.trim());
    
    // 驗證並轉換時間格式
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '時間格式錯誤，請使用 YYYY-MM-DD HH:MM 格式'
      });
    }
    
    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: 'addEvent',
      lineUserId: userId,
      title: title,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      description: description
    });
    
    if (response.data.success) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: `✅ 事件已成功新增到你的 Google Calendar！\n\n📅 ${title}\n🕐 ${startTime} ~ ${endTime}`
      });
    } else if (response.data.needAuth) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 請先綁定 Google Calendar\n輸入「綁定行事曆」開始授權'
      });
    } else {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 新增事件失敗：' + response.data.error
      });
    }
    
  } catch (error) {
    console.error('Add event error:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '新增事件時發生錯誤，請稍後再試。'
    });
  }
}

// 處理查看事件
async function handleListEvents(replyToken, userId) {
  try {
    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: 'listEvents',
      lineUserId: userId,
      timeMin: new Date().toISOString(),
      maxResults: 10
    });
    
    if (response.data.success) {
      const events = response.data.events;
      
      if (events.length === 0) {
        return client.replyMessage(replyToken, {
          type: 'text',
          text: '📅 目前沒有即將到來的行程'
        });
      }
      
      let eventsList = '📅 你的近期行程：\n\n';
      events.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);
        
        eventsList += `${index + 1}. ${event.summary}\n`;
        eventsList += `🕐 ${startTime.toLocaleString('zh-TW')}\n`;
        eventsList += `   ~ ${endTime.toLocaleString('zh-TW')}\n`;
        if (event.description) {
          eventsList += `📝 ${event.description}\n`;
        }
        eventsList += `🆔 ${event.id.substring(0, 8)}...\n`;
        eventsList += '\n';
      });
      
      return client.replyMessage(replyToken, {
        type: 'text',
        text: eventsList
      });
      
    } else if (response.data.needAuth) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 請先綁定 Google Calendar\n輸入「綁定行事曆」開始授權'
      });
    } else {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 取得行程失敗：' + response.data.error
      });
    }
    
  } catch (error) {
    console.error('List events error:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '查看行程時發生錯誤，請稍後再試。'
    });
  }
}

// 顯示幫助資訊
async function showCalendarHelp(replyToken) {
  const helpText = `🗓️ Google Calendar 行事曆機器人

📋 可用指令：
• 綁定行事曆 - 授權綁定你的 Google Calendar
• 新增事件 標題|開始時間|結束時間|描述
• 查看行程 - 顯示近期行程
• 刪除事件 [事件ID] - 刪除指定事件
• 行事曆幫助 - 顯示此說明

💡 使用範例：
新增事件 開會|2024-12-25 14:00|2024-12-25 15:00|與客戶討論專案
刪除事件 abc12345

⚠️ 注意事項：
• 時間格式：YYYY-MM-DD HH:MM
• 使用前請先綁定 Google Calendar
• 分隔符號使用「|」(直線符號)
• 事件ID可從「查看行程」中取得`;

  return client.replyMessage(replyToken, {
    type: 'text',
    text: helpText
  });
}

// 處理刪除事件
async function handleDeleteEvent(replyToken, userId, message) {
  try {
    // 解析事件ID (格式: 刪除事件 事件ID)
    const eventId = message.replace(/^刪除事件\s/, '').trim();
    
    if (!eventId) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '請提供要刪除的事件ID\n格式：刪除事件 [事件ID]\n\n先使用「查看行程」取得事件ID'
      });
    }
    
    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action: 'deleteEvent',
      lineUserId: userId,
      eventId: eventId
    });
    
    if (response.data.success) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '✅ 事件已成功刪除！'
      });
    } else if (response.data.needAuth) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 請先綁定 Google Calendar\n輸入「綁定行事曆」開始授權'
      });
    } else {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '❌ 刪除事件失敗：' + response.data.error
      });
    }
    
  } catch (error) {
    console.error('Delete event error:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '刪除事件時發生錯誤，請稍後再試。'
    });
  }
}

const PORT = process.env.PORT || 3015;
app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});