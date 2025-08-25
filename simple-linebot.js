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

// Express 中間件設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.post('/webhook', (req, res) => {
  console.log('📨 收到 Webhook 請求:', new Date().toLocaleTimeString());
  console.log('📋 請求內容:', JSON.stringify(req.body, null, 2));
  
  // 暫時跳過 LINE SDK middleware 進行調試
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

// API 端點：取得任務資料
app.get('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  console.log('🔍 查詢任務:', taskId);
  
  // 查找任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        return res.json({ success: true, task });
      }
    }
  }
  
  res.status(404).json({ success: false, error: '任務不存在' });
});

// API 端點：更新任務
app.put('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { text, notes, taskTime, category, customCategory, reminderEnabled, reminderTime } = req.body;
  
  console.log('📝 更新任務:', taskId, { text, notes, taskTime, category, customCategory, reminderEnabled, reminderTime });
  
  // 查找並更新任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const oldTask = { ...tasks[taskIndex] };
        
        tasks[taskIndex].text = text || tasks[taskIndex].text;
        tasks[taskIndex].notes = notes || tasks[taskIndex].notes;
        tasks[taskIndex].taskTime = taskTime || tasks[taskIndex].taskTime;
        tasks[taskIndex].category = category || tasks[taskIndex].category;
        tasks[taskIndex].customCategory = customCategory || tasks[taskIndex].customCategory;
        tasks[taskIndex].reminderEnabled = reminderEnabled !== undefined ? reminderEnabled : tasks[taskIndex].reminderEnabled;
        tasks[taskIndex].reminderTime = reminderTime || tasks[taskIndex].reminderTime;
        tasks[taskIndex].updatedAt = new Date().toISOString();
        
        // 如果提醒設定有變化，重新安排提醒
        console.log('📝 檢查提醒設定變化...');
        console.log('提醒啟用:', tasks[taskIndex].reminderEnabled);
        console.log('任務時間:', tasks[taskIndex].taskTime);
        
        if (tasks[taskIndex].reminderEnabled && tasks[taskIndex].taskTime) {
          console.log('🔔 重新安排提醒...');
          scheduleReminder(tasks[taskIndex]);
        } else if (oldTask.reminderEnabled && !tasks[taskIndex].reminderEnabled) {
          console.log('❌ 取消提醒...');
          cancelReminder(taskId);
        }
        
        return res.json({ success: true, task: tasks[taskIndex] });
      }
    }
  }
  
  res.status(404).json({ success: false, error: '任務不存在' });
});

// API 端點：刪除任務
app.delete('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  console.log('🗑️ 刪除任務:', taskId);
  
  // 查找並刪除任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
        return res.json({ success: true, message: '任務已刪除' });
      }
    }
  }
  
  res.status(404).json({ success: false, error: '任務不存在' });
});

// API 端點：取得用戶今天的所有任務
app.get('/api/tasks/:userId', (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  const todayTasks = userTasks.get(userId)?.get(today) || [];
  
  res.json({ 
    success: true, 
    tasks: todayTasks,
    date: today,
    count: todayTasks.length 
  });
});

// API 端點：檢查提醒狀態 (測試用)
app.get('/api/reminders/status', (req, res) => {
  const activeReminders = [];
  const allTasks = [];
  
  // 收集所有任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      for (const task of tasks) {
        allTasks.push({
          taskId: task.id,
          userId: userId,
          date: date,
          taskText: task.text,
          taskTime: task.taskTime,
          reminderEnabled: task.reminderEnabled,
          reminderTime: task.reminderTime,
          hasActiveReminder: reminderTimeouts.has(task.id)
        });
      }
    }
  }
  
  // 收集活躍提醒
  for (const [taskId, timeoutId] of reminderTimeouts) {
    const task = allTasks.find(t => t.taskId === taskId);
    if (task) {
      let taskTime, reminderTime;
      
      if (task.taskTime) {
        if (task.taskTime.includes('T')) {
          taskTime = new Date(task.taskTime);
        } else {
          taskTime = new Date(task.taskTime.replace('T', ' '));
        }
        reminderTime = new Date(taskTime.getTime() - task.reminderTime * 60000);
        
        activeReminders.push({
          taskId: task.taskId,
          taskText: task.taskText,
          originalTaskTime: task.taskTime,
          parsedTaskTime: taskTime.toISOString(),
          reminderTime: reminderTime.toISOString(),
          reminderMinutes: task.reminderTime,
          timeoutId: timeoutId ? 'active' : 'inactive',
          delayFromNow: reminderTime.getTime() - new Date().getTime()
        });
      }
    }
  }
  
  res.json({
    success: true,
    currentTime: new Date().toISOString(),
    totalTasks: allTasks.length,
    tasksWithReminders: allTasks.filter(t => t.reminderEnabled).length,
    totalActiveReminders: reminderTimeouts.size,
    allTasks: allTasks,
    activeReminders: activeReminders
  });
});

// API 端點：測試立即發送提醒
app.post('/api/test-reminder/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  // 查找任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        console.log('🧪 測試發送提醒:', task.text);
        try {
          await sendTaskReminder(task);
          return res.json({ success: true, message: '測試提醒已發送' });
        } catch (error) {
          console.error('❌ 測試提醒發送失敗:', error);
          return res.json({ success: false, error: error.message });
        }
      }
    }
  }
  
  res.status(404).json({ success: false, error: '任務不存在' });
});

// 任務儲存（記憶體，按用戶ID和日期分組）
const userTasks = new Map(); // userId -> { date -> [tasks] }

// 提醒任務管理
const reminderTimeouts = new Map(); // taskId -> timeoutId

// 安排任務提醒
function scheduleReminder(task) {
  if (!task.reminderEnabled || !task.taskTime) {
    console.log('⚠️ 提醒未啟用或無任務時間:', task.text, {
      reminderEnabled: task.reminderEnabled,
      taskTime: task.taskTime
    });
    return;
  }
  
  // 處理 datetime-local 格式（無時區資訊）
  let taskTime;
  if (task.taskTime.includes('T')) {
    // 如果是 ISO 格式，直接使用
    taskTime = new Date(task.taskTime);
  } else {
    // 如果是 datetime-local 格式，需要當作本地時間處理
    taskTime = new Date(task.taskTime.replace('T', ' '));
  }
  
  const reminderTime = new Date(taskTime.getTime() - task.reminderTime * 60000);
  const now = new Date();
  
  console.log(`📅 任務名稱: ${task.text}`);
  console.log(`📅 原始任務時間: ${task.taskTime}`);
  console.log(`📅 解析任務時間: ${taskTime.toISOString()}`);
  console.log(`🔔 提醒時間: ${reminderTime.toISOString()}`);
  console.log(`⏰ 現在時間: ${now.toISOString()}`);
  console.log(`⏱️ 提醒分鐘數: ${task.reminderTime}`);
  
  const delay = reminderTime.getTime() - now.getTime();
  console.log(`⏱️ 計算延遲: ${delay}ms (${Math.floor(delay / 1000)} 秒)`);
  
  // 如果提醒時間已經過了，立即發送提醒
  if (reminderTime <= now) {
    console.log('⏰ 任務提醒時間已過，立即發送提醒:', task.text);
    sendTaskReminder(task);
    return;
  }
  
  // 如果延遲時間太長（超過24小時），不安排提醒
  if (delay > 24 * 60 * 60 * 1000) {
    console.log('⚠️ 提醒時間超過24小時，不安排提醒:', task.text);
    return;
  }
  
  // 取消舊的提醒
  cancelReminder(task.id);
  
  console.log(`⏰ 安排任務提醒: ${task.text}`);
  console.log(`📤 將在 ${Math.floor(delay / 60000)} 分鐘後提醒`);
  
  const timeoutId = setTimeout(() => {
    console.log(`🚀 執行提醒任務: ${task.text}`);
    sendTaskReminder(task);
  }, delay);
  
  reminderTimeouts.set(task.id, timeoutId);
  console.log(`✅ 提醒已排程，任務ID: ${task.id}，Timeout ID: ${timeoutId}`);
  console.log(`📊 目前活躍提醒數量: ${reminderTimeouts.size}`);
}

// 取消任務提醒
function cancelReminder(taskId) {
  const timeoutId = reminderTimeouts.get(taskId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    reminderTimeouts.delete(taskId);
    console.log('❌ 已取消任務提醒:', taskId);
  }
}

// 發送任務提醒
async function sendTaskReminder(task) {
  try {
    const taskTime = new Date(task.taskTime);
    const reminderMessage = {
      type: 'flex',
      altText: `提醒：${task.text} 即將開始`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🔔 任務提醒",
              weight: "bold",
              size: "lg",
              color: "#ffffff"
            }
          ],
          backgroundColor: "#FF9800",
          paddingAll: "20px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: task.text,
              size: "lg",
              weight: "bold",
              color: "#333333",
              wrap: true
            },
            {
              type: "separator",
              margin: "md"
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "開始時間:",
                  size: "sm",
                  color: "#666666",
                  flex: 0
                },
                {
                  type: "text", 
                  text: taskTime.toLocaleString('zh-TW'),
                  size: "sm",
                  color: "#333333",
                  flex: 0
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "剩餘時間:",
                  size: "sm",
                  color: "#666666",
                  flex: 0
                },
                {
                  type: "text", 
                  text: `${task.reminderTime} 分鐘`,
                  size: "sm",
                  color: "#FF9800",
                  weight: "bold",
                  flex: 0
                }
              ],
              margin: "sm"
            }
          ],
          spacing: "sm"
        }
      }
    };
    
    // 使用 Push API 發送提醒（需要用戶的 LINE ID）
    console.log('📤 發送任務提醒給用戶:', task.userId);
    await client.pushMessage(task.userId, reminderMessage);
    console.log('✅ 任務提醒發送成功');
    
    // 從提醒列表中移除
    reminderTimeouts.delete(task.id);
  } catch (error) {
    console.error('❌ 發送任務提醒失敗:', error);
  }
}

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

    // 檢查是否為完成/刪除任務的指令
    const isCompleteCommand = /已完成|完成了|刪掉|刪除|完成(\d+)/.test(messageText);
    
    if (isCompleteCommand) {
      return handleCompleteTask(event, userId, messageText);
    }

    // 一般任務新增
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const taskId = Date.now().toString();
    
    // 確保用戶的任務結構存在
    if (!userTasks.has(userId)) {
      userTasks.set(userId, new Map());
    }
    if (!userTasks.get(userId).has(today)) {
      userTasks.get(userId).set(today, []);
    }
    
    // 添加新任務
    const newTask = {
      id: taskId,
      text: messageText,
      createdAt: new Date().toISOString(),
      date: today,
      userId: userId,
      taskTime: null,
      category: 'work',
      customCategory: '',
      notes: '',
      reminderEnabled: false,
      reminderTime: 30
    };
    
    userTasks.get(userId).get(today).push(newTask);
    
    console.log('📝 任務已儲存:', newTask);

    // 取得今天所有任務來顯示
    const todayTasks = userTasks.get(userId).get(today);
    
    // 建立任務清單內容
    const taskListItems = todayTasks.map((task, index) => ({
      type: "box",
      layout: "baseline",
      contents: [
        {
          type: "text",
          text: `${index + 1}.`,
          size: "sm",
          color: "#00B900",
          weight: "bold",
          flex: 0
        },
        {
          type: "text",
          text: task.text,
          size: "sm",
          color: "#333333",
          wrap: true,
          flex: 1
        }
      ],
      spacing: "sm",
      margin: index === 0 ? "none" : "md"
    }));

    // 建立兩則 FLEX MESSAGE
    const replyMessages = [
      // 第一則：當前任務記錄
      {
        type: 'flex',
        altText: `已記錄任務: ${messageText}`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "✅ 任務已記錄",
                weight: "bold",
                size: "md",
                color: "#ffffff"
              }
            ],
            backgroundColor: "#00B900",
            paddingAll: "15px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: messageText,
                size: "lg",
                weight: "bold",
                color: "#333333",
                wrap: true
              }
            ],
            spacing: "sm"
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
                  label: "✏️ 編輯",
                  uri: `${BASE_URL}/liff/edit-task.html?taskId=${taskId}&userId=${encodeURIComponent(userId)}`
                },
                color: "#00B900"
              }
            ]
          }
        }
      },
      // 第二則：今天所有任務清單
      {
        type: 'flex',
        altText: `今天的任務清單`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "📋 今天的任務",
                weight: "bold",
                size: "lg",
                color: "#ffffff"
              },
              {
                type: "text",
                text: `今天任務 ${todayTasks.length} 項`,
                size: "sm",
                color: "#ffffff"
              }
            ],
            backgroundColor: "#0084FF",
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: taskListItems,
            spacing: "sm",
            paddingAll: "15px"
          }
        }
      }
    ];

    // 建立 Quick Reply 按鈕
    const quickReply = {
      items: [
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '📅 今天',
            uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
          }
        },
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '📋 全部',
            uri: `${BASE_URL}/liff/all-tasks.html?userId=${encodeURIComponent(userId)}`
          }
        },
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '👤 帳戶',
            uri: `${BASE_URL}/liff/profile.html?userId=${encodeURIComponent(userId)}`
          }
        }
      ]
    };

    // 將 Quick Reply 添加到第二則訊息
    replyMessages[1].quickReply = quickReply;

    console.log('📤 發送 2 則 FLEX 訊息 + Quick Reply...');
    const result = await client.replyMessage(event.replyToken, replyMessages);
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

// 處理完成/刪除任務
async function handleCompleteTask(event, userId, messageText) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 確保用戶的任務結構存在
    if (!userTasks.has(userId) || !userTasks.get(userId).has(today)) {
      // 沒有今天的任務
      const replyMessage = {
        type: 'text',
        text: '📋 今天還沒有任務可以完成呢！'
      };
      
      return await client.replyMessage(event.replyToken, replyMessage);
    }
    
    const todayTasks = userTasks.get(userId).get(today);
    
    // 解析要完成的任務編號
    const numberMatch = messageText.match(/(\d+)/);
    let taskToRemove = null;
    
    if (numberMatch) {
      // 指定編號的任務 (例如: "完成2", "刪掉1")
      const taskNumber = parseInt(numberMatch[1]);
      if (taskNumber > 0 && taskNumber <= todayTasks.length) {
        taskToRemove = todayTasks.splice(taskNumber - 1, 1)[0];
      }
    } else if (todayTasks.length > 0) {
      // 沒有指定編號，完成最新的任務
      taskToRemove = todayTasks.pop();
    }
    
    if (!taskToRemove) {
      const replyMessage = {
        type: 'text',
        text: '❓ 找不到要完成的任務'
      };
      
      return await client.replyMessage(event.replyToken, replyMessage);
    }
    
    console.log('✅ 已完成任務:', taskToRemove.text);
    
    // 重新生成任務清單
    const taskListItems = todayTasks.map((task, index) => ({
      type: "box",
      layout: "baseline",
      contents: [
        {
          type: "text",
          text: `${index + 1}.`,
          size: "sm",
          color: "#00B900",
          weight: "bold",
          flex: 0
        },
        {
          type: "text",
          text: task.text,
          size: "sm",
          color: "#333333",
          wrap: true,
          flex: 1
        }
      ],
      spacing: "sm",
      margin: index === 0 ? "none" : "md"
    }));
    
    // 建立完成任務後的 FLEX MESSAGE
    const replyMessage = {
      type: 'flex',
      altText: `任務已完成: ${taskToRemove.text}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✅ 任務已完成",
              weight: "bold",
              size: "lg",
              color: "#ffffff"
            },
            {
              type: "text",
              text: `完成：${taskToRemove.text}`,
              size: "sm",
              color: "#ffffff"
            }
          ],
          backgroundColor: "#28a745",
          paddingAll: "20px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: todayTasks.length > 0 ? [
            {
              type: "text",
              text: `剩餘任務 ${todayTasks.length} 項`,
              size: "md",
              weight: "bold",
              color: "#333333",
              margin: "md"
            },
            ...taskListItems
          ] : [
            {
              type: "text",
              text: "🎉 今天所有任務都完成了！",
              size: "md",
              color: "#28a745",
              align: "center",
              weight: "bold"
            }
          ],
          spacing: "sm",
          paddingAll: "15px"
        }
      }
    };
    
    // 建立 Quick Reply 按鈕
    const quickReply = {
      items: [
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '📅 今天',
            uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
          }
        },
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '📋 全部',
            uri: `${BASE_URL}/liff/all-tasks.html?userId=${encodeURIComponent(userId)}`
          }
        },
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '👤 帳戶',
            uri: `${BASE_URL}/liff/profile.html?userId=${encodeURIComponent(userId)}`
          }
        }
      ]
    };
    
    replyMessage.quickReply = quickReply;
    
    console.log('📤 發送完成任務 FLEX 訊息...');
    const result = await client.replyMessage(event.replyToken, replyMessage);
    console.log('✅ 訊息發送成功');
    
    return result;
  } catch (error) {
    console.error('❌ 完成任務處理錯誤:', error);
    throw error;
  }
}

// 建立當前任務記錄 FLEX Message
function createCurrentTaskFlex(task) {
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅ 任務已記錄",
          weight: "bold",
          size: "md",
          color: "#ffffff"
        }
      ],
      backgroundColor: "#00B900",
      paddingAll: "15px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: task.text,
          size: "lg",
          weight: "bold",
          color: "#333333",
          wrap: true
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "baseline",
          contents: [
            {
              type: "text",
              text: "記錄時間:",
              size: "sm",
              color: "#666666",
              flex: 0
            },
            {
              type: "text", 
              text: new Date(task.createdAt).toLocaleString('zh-TW'),
              size: "sm",
              color: "#666666",
              flex: 0
            }
          ],
          margin: "md"
        }
      ],
      spacing: "sm"
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
            label: "✏️ 編輯任務",
            uri: `${BASE_URL}/liff/edit-task.html?taskId=${task.id}&userId=${encodeURIComponent(task.userId || '')}`
          },
          color: "#00B900"
        }
      ]
    }
  };
}

// 建立今天所有任務清單 FLEX Message
function createTodayTasksFlex(userId, date) {
  const todayTasks = userTasks.get(userId)?.get(date) || [];
  
  const taskItems = todayTasks.map((task, index) => ({
    type: "box",
    layout: "baseline", 
    contents: [
      {
        type: "text",
        text: `${index + 1}.`,
        size: "sm",
        color: "#00B900",
        flex: 0,
        weight: "bold"
      },
      {
        type: "text",
        text: task.text,
        size: "sm",
        color: "#333333",
        flex: 1,
        wrap: true
      }
    ],
    spacing: "sm",
    margin: "md"
  }));

  return {
    type: "bubble",
    header: {
      type: "box", 
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📋 今天的任務",
          weight: "bold",
          size: "lg",
          color: "#ffffff"
        },
        {
          type: "text",
          text: `共 ${todayTasks.length} 項任務`,
          size: "sm",
          color: "#ffffff",
          opacity: 0.9
        }
      ],
      backgroundColor: "#0084FF",
      paddingAll: "20px"
    },
    body: {
      type: "box",
      layout: "vertical", 
      contents: todayTasks.length > 0 ? [
        {
          type: "text",
          text: "任務清單:",
          size: "md",
          weight: "bold",
          color: "#333333"
        },
        ...taskItems
      ] : [
        {
          type: "text",
          text: "🎯 今天還沒有任務",
          size: "md",
          color: "#666666",
          align: "center"
        },
        {
          type: "text", 
          text: "發送訊息來新增第一個任務！",
          size: "sm",
          color: "#999999",
          align: "center",
          margin: "sm"
        }
      ],
      spacing: "sm",
      paddingAll: "15px"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "secondary",
          action: {
            type: "uri", 
            label: "📱 查看完整清單",
            uri: `${BASE_URL}/liff/tasks.html`
          }
        }
      ]
    }
  };
}

// 建立任務管理 FLEX Message（保留原有功能）
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