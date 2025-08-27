require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const { OpenAI } = require('openai');

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

// OpenAI 設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 驗證 OpenAI API Key
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.error('❌ OPENAI_API_KEY 未設定！語音識別功能將無法使用');
}

// Express 中間件設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 基本設定
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 
  (process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
    : `http://localhost:${PORT}`);

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
  
  // 先顯示所有任務用於除錯
  console.log('📋 目前記憶體中的所有任務:');
  for (const [userId, userDates] of userTasks) {
    console.log(`  用戶 ${userId.substring(0, 10)}...:`);
    for (const [date, tasks] of userDates) {
      console.log(`    日期 ${date}: ${tasks.length} 個任務`);
      tasks.forEach((task, index) => {
        console.log(`      ${index + 1}. ID: ${task.id}, 內容: ${task.text}`);
      });
    }
  }
  
  // 查找任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        console.log('✅ 找到任務:', task);
        return res.json({ success: true, task });
      }
    }
  }
  
  console.log('❌ 查詢失敗 - 找不到任務 ID:', taskId);
  res.status(404).json({ success: false, error: '任務不存在' });
});

// API 端點：更新任務
app.put('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { text, notes, taskTime, category, customCategory, reminderEnabled, reminderTime } = req.body;
  
  console.log('📝 收到更新任務請求:');
  console.log('  任務ID:', taskId);
  console.log('  請求數據:', { text, notes, taskTime, category, customCategory, reminderEnabled, reminderTime });
  
  // 先顯示所有現有任務用於除錯
  console.log('🔍 目前所有任務:');
  for (const [userId, userDates] of userTasks) {
    console.log(`  用戶 ${userId.substring(0, 10)}...:`);
    for (const [date, tasks] of userDates) {
      console.log(`    日期 ${date}: ${tasks.length} 個任務`);
      tasks.forEach((task, index) => {
        console.log(`      ${index + 1}. ID: ${task.id}, 內容: ${task.text}`);
      });
    }
  }
  
  // 查找並更新任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        console.log('✅ 找到任務，準備更新:', tasks[taskIndex].text);
        
        const oldTask = { ...tasks[taskIndex] };
        
        // 更新任務屬性
        if (text !== undefined) tasks[taskIndex].text = text;
        if (notes !== undefined) tasks[taskIndex].notes = notes;
        if (taskTime !== undefined) tasks[taskIndex].taskTime = taskTime;
        if (category !== undefined) tasks[taskIndex].category = category;
        if (customCategory !== undefined) tasks[taskIndex].customCategory = customCategory;
        if (reminderEnabled !== undefined) tasks[taskIndex].reminderEnabled = reminderEnabled;
        if (reminderTime !== undefined) tasks[taskIndex].reminderTime = reminderTime;
        tasks[taskIndex].updatedAt = new Date().toISOString();
        
        console.log('📝 任務更新後:', tasks[taskIndex]);
        
        // 重置提醒發送狀態
        tasks[taskIndex].reminderSent = false;
        
        // 如果提醒設定有變化，重新安排提醒
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
  
  console.log('❌ 找不到任務 ID:', taskId);
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

// API 端點：更新任務完成狀態
app.patch('/api/tasks/:userId/:taskId/toggle', (req, res) => {
  const { userId, taskId } = req.params;
  const { date } = req.body;
  
  if (!date) {
    return res.status(400).json({ success: false, error: '缺少日期參數' });
  }
  
  const userTaskMap = userTasks.get(userId);
  if (!userTaskMap) {
    return res.status(404).json({ success: false, error: '用戶不存在' });
  }
  
  const dayTasks = userTaskMap.get(date);
  if (!dayTasks) {
    return res.status(404).json({ success: false, error: '該日期無任務' });
  }
  
  const taskIndex = dayTasks.findIndex(task => task.id === taskId);
  if (taskIndex === -1) {
    return res.status(404).json({ success: false, error: '任務不存在' });
  }
  
  // 切換任務完成狀態
  dayTasks[taskIndex].completed = !dayTasks[taskIndex].completed;
  dayTasks[taskIndex].completedAt = dayTasks[taskIndex].completed ? new Date().toISOString() : null;
  
  res.json({
    success: true,
    task: dayTasks[taskIndex],
    message: `任務${dayTasks[taskIndex].completed ? '已完成' : '已取消完成'}`
  });
});

// API 端點：取得用戶今天的所有任務
app.get('/api/tasks/:userId', (req, res) => {
  const { userId } = req.params;
  const { date } = req.query;
  
  if (date) {
    // 獲取特定日期的任務
    const tasks = userTasks.get(userId)?.get(date) || [];
    res.json({ 
      success: true, 
      tasks: tasks,
      date: date,
      count: tasks.length
    });
  } else {
    // 獲取今天的任務
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = userTasks.get(userId)?.get(today) || [];
    
    res.json({ 
      success: true, 
      tasks: todayTasks,
      date: today,
      count: todayTasks.length 
    });
  }
});

// API 端點：取得用戶近3天的所有任務
app.get('/api/tasks/:userId/recent', (req, res) => {
  const { userId } = req.params;
  const today = new Date();
  const result = {};
  
  // 獲取昨天、今天、明天的任務
  for (let i = -1; i <= 1; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const tasks = userTasks.get(userId)?.get(dateStr) || [];
    result[dateStr] = tasks;
  }
  
  res.json({
    success: true,
    tasks: result,
    dates: Object.keys(result)
  });
});

// API 端點：完成任務（從記憶體中刪除）
app.post('/api/task/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  
  console.log('✅ 收到完成任務請求:', taskId);
  
  // 查找並刪除任務
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const completedTask = tasks[taskIndex];
        tasks.splice(taskIndex, 1); // 從記憶體中移除任務
        
        console.log('✅ 任務已完成並移除:', completedTask.text);
        
        return res.json({ 
          success: true, 
          message: '任務已完成',
          completedTask: completedTask
        });
      }
    }
  }
  
  console.log('❌ 找不到要完成的任務:', taskId);
  res.status(404).json({ 
    success: false, 
    error: '任務不存在' 
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

// 格式化任務顯示文字
function formatTaskDisplayText(task) {
  let displayText = task.text;
  let timePrefix = '';
  
  // 如果有設定時間，加上時間前綴
  if (task.taskTime) {
    try {
      // 解析任務時間
      let taskDate;
      if (task.taskTime.includes('T')) {
        taskDate = new Date(task.taskTime);
      } else {
        taskDate = new Date(task.taskTime.replace('T', ' '));
      }
      
      // 格式化為 M/D HH:MM 格式
      const month = taskDate.getMonth() + 1; // getMonth() 返回 0-11
      const day = taskDate.getDate();
      const hours = taskDate.getHours().toString().padStart(2, '0');
      const minutes = taskDate.getMinutes().toString().padStart(2, '0');
      
      timePrefix = `${month}/${day} ${hours}:${minutes} `;
    } catch (error) {
      console.error('解析任務時間錯誤:', error);
      timePrefix = ''; // 解析失敗，不加時間前綴
    }
  }
  
  // 如果有啟用提醒，在文字後加上 ⏰ 圖標
  let reminderSuffix = '';
  if (task.reminderEnabled) {
    reminderSuffix = '⏰';
  }
  
  return `${timePrefix}${displayText}${reminderSuffix}`;
}

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
    console.log('📤 準備發送任務提醒...');
    console.log('任務詳情:', {
      taskId: task.id,
      taskText: task.text,
      userId: task.userId?.substring(0, 10) + '...',
      taskTime: task.taskTime
    });
    
    const taskTime = new Date(task.taskTime);
    
    // 使用簡化版的文字訊息測試
    const reminderMessage = {
      type: 'text',
      text: `🔔 任務提醒\n\n📋 任務：${task.text}\n⏰ 預定時間：${taskTime.toLocaleString('zh-TW')}\n⚡ 即將在 ${task.reminderTime} 分鐘後開始！`
    };
    
    console.log('📤 使用 Push API 發送提醒給用戶:', task.userId?.substring(0, 10) + '...');
    
    // 使用 Push API 發送提醒
    const result = await client.pushMessage(task.userId, reminderMessage);
    
    console.log('✅ Push API 回應:', result);
    console.log('✅ 任務提醒發送成功！');
    
    // 從提醒列表中移除
    if (reminderTimeouts.has(task.id)) {
      reminderTimeouts.delete(task.id);
      console.log('🗑️ 已從提醒列表移除任務:', task.id);
    }
    
    // 標記為已發送
    if (task.id.indexOf('test-') !== 0) {
      task.reminderSent = true;
    }
    
    return result;
  } catch (error) {
    console.error('❌ 發送任務提醒失敗:', error);
    console.error('錯誤詳情:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      data: error.response?.data
    });
    throw error;
  }
}

// 主要事件處理
async function handleEvent(event) {
  try {
    console.log('🔄 處理事件:', event.type);
    
    if (event.type !== 'message') {
      console.log('⏭️ 跳過非訊息事件');
      return null;
    }

    // 處理語音訊息
    if (event.message.type === 'audio') {
      console.log('🎤 收到語音訊息，開始處理...');
      return handleAudioMessage(event);
    }

    // 處理文字訊息
    if (event.message.type !== 'text') {
      console.log('⏭️ 跳過非文字/語音訊息事件');
      return null;
    }

    const userId = event.source.userId;
    const messageText = event.message.text;

    console.log('💬 收到訊息:', messageText, 'from user:', userId.substring(0, 10) + '...');

    // 檢查是否為測試提醒指令
    if (messageText.includes('測試提醒')) {
      return handleTestReminder(event, userId, messageText);
    }

    // 檢查是否為todolist樣式的完成任務指令
    const todoCompleteMatch = messageText.match(/^(完成任務|取消完成)\s+(.+)$/);
    if (todoCompleteMatch) {
      return handleTodoToggle(event, userId, todoCompleteMatch[1], todoCompleteMatch[2]);
    }

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
      completed: false,
      notes: '',
      reminderEnabled: false,
      reminderTime: 30,
      reminderSent: false
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
          text: formatTaskDisplayText(task),
          size: "sm",
          color: "#333333",
          wrap: true,
          flex: 1
        }
      ],
      spacing: "xs",
      margin: index === 0 ? "none" : "xs"
    }));

    // 建立兩則 FLEX MESSAGE
    const replyMessages = [
      // 第一則：當前任務記錄
      {
        type: 'flex',
        altText: `已記錄任務: ${messageText}`,
        contents: {
          type: "bubble",
          size: "nano",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "✅",
                weight: "bold",
                size: "md",
                color: "#000000"
              }
            ],
            backgroundColor: "#FFFFFF",
            paddingAll: "6px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: messageText,
                size: "sm",
                weight: "normal",
                color: "#333333",
                wrap: true
              }
            ],
            spacing: "xs"
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
                  label: "編輯",
                  uri: `${BASE_URL}/liff/edit-task.html?taskId=${taskId}&userId=${encodeURIComponent(userId)}`
                },
                color: "#DDA267",
                height: "sm",
                flex: 0
              }
            ],
            paddingAll: "8px",
            spacing: "none",
            alignItems: "center"
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
                text: "📋 今天任務",
                weight: "bold",
                size: "lg",
                color: "#000000"
              },
              {
                type: "text",
                text: `今天任務 ${todayTasks.length} 項`,
                size: "sm",
                color: "#000000"
              }
            ],
            backgroundColor: "#FFFFFF",
            paddingAll: "6px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: taskListItems,
            spacing: "xs",
            paddingAll: "6px"
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
                  label: "編輯",
                  uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
                },
                color: "#DDA267",
                height: "sm",
                flex: 0
              }
            ],
            paddingAll: "8px",
            spacing: "none",
            alignItems: "center"
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

    // 第一則 FLEX MESSAGE：任務記錄
    const firstMessage = {
      type: 'flex',
      altText: `已記錄任務: ${messageText}`,
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✏️",
              size: "lg",
              color: "#333333",
              align: "start",
              margin: "xs"
            },
            {
              type: "text",
              text: messageText,
              size: "md",
              weight: "regular",
              wrap: true,
              margin: "xs"
            }
          ],
          spacing: "xs",
          paddingAll: "8px"
        },
        footer: {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "message",
                label: "提醒",
                text: "設定提醒"
              }
            },
            {
              type: "button",
              style: "link", 
              height: "sm",
              action: {
                type: "message",
                label: "備註",
                text: "添加備註"
              }
            }
          ]
        },
      }
    };

    // 建立任務列表內容 - todolist樣式
    const completedCount = todayTasks.filter(task => task.completed).length;
    const taskItems = todayTasks.map((task, index) => {
      const textColor = task.completed ? "#999999" : "#333333";
      const buttonLabel = task.completed ? "☑️" : "☐";
      
      return {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: `${index + 1}. ${task.text}`,
            size: "sm",
            wrap: true,
            color: textColor,
            flex: 3,
            gravity: "center"
          },
          {
            type: "button",
            style: "link",
            height: "sm",
            flex: 1,
            action: {
              type: "message",
              label: buttonLabel,
              text: task.completed ? `取消完成 ${task.id}` : `完成任務 ${task.id}`
            }
          }
        ],
        spacing: "sm",
        margin: "xs"
      };
    });

    // 第二則 FLEX MESSAGE：任務堆疊
    const secondMessage = {
      type: 'flex',
      altText: `今天的任務清單`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `📋 今天有 ${todayTasks.length} 項任務`,
              weight: "bold",
              size: "lg",
              color: "#333333"
            },
            {
              type: "text",
              text: `已完成 ${completedCount} 項、待完成 ${todayTasks.length - completedCount} 項`,
              weight: "regular",
              size: "md",
              color: "#666666",
              margin: "xs"
            },
            ...taskItems
          ],
          spacing: "sm",
          paddingAll: "20px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "編輯",
                uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
              }
            }
          ],
          paddingAll: "20px"
        }
      }
    };

    // 一次發送兩則 FLEX MESSAGE
    const result = await client.replyMessage(event.replyToken, [firstMessage, secondMessage]);
    
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

// 處理測試提醒指令
async function handleTestReminder(event, userId, messageText) {
  try {
    console.log('🧪 收到測試提醒指令');
    
    // 立即發送測試提醒
    const testTask = {
      id: 'test-' + Date.now(),
      text: '測試提醒任務',
      userId: userId,
      taskTime: new Date().toISOString(),
      reminderTime: 1
    };
    
    console.log('📤 立即發送測試提醒...');
    await sendTaskReminder(testTask);
    
    // 回覆確認訊息
    const confirmMessage = {
      type: 'text',
      text: '✅ 測試提醒已發送！如果您沒收到推播訊息，請檢查 LINE 通知設定。'
    };
    
    return await client.replyMessage(event.replyToken, confirmMessage);
  } catch (error) {
    console.error('❌ 測試提醒失敗:', error);
    
    const errorMessage = {
      type: 'text',
      text: '❌ 測試提醒發送失敗，請查看日誌了解詳情。'
    };
    
    return await client.replyMessage(event.replyToken, errorMessage);
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
          text: formatTaskDisplayText(task),
          size: "sm",
          color: "#333333",
          wrap: true,
          flex: 1
        }
      ],
      spacing: "xs",
      margin: index === 0 ? "none" : "xs"
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
          paddingAll: "6px"
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
              margin: "xs"
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
          spacing: "xs",
          paddingAll: "6px"
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
    console.log('🔍 完成任務 Quick Reply 結構:', JSON.stringify(quickReply, null, 2));
    console.log('🔍 完成任務訊息結構檢查:', replyMessage.quickReply ? '✅ Quick Reply 已添加' : '❌ Quick Reply 遺失');
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
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅",
          weight: "bold",
          size: "md",
          color: "#000000"
        }
      ],
      backgroundColor: "#FFFFFF",
      paddingAll: "6px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: task.text,
          size: "sm",
          weight: "normal",
          color: "#333333",
          wrap: true
        },
        {
          type: "separator",
          margin: "xs"
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
          margin: "xs"
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
            label: "編輯任務",
            uri: `${BASE_URL}/liff/edit-task.html?taskId=${task.id}&userId=${encodeURIComponent(task.userId || '')}`
          },
          color: "#DDA267",
          height: "sm",
          flex: 0
        }
      ],
      paddingAll: "8px",
      spacing: "none",
      alignItems: "center"
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
        text: formatTaskDisplayText(task),
        size: "sm",
        color: "#333333",
        flex: 1,
        wrap: true
      }
    ],
    spacing: "xs",
    margin: "xs"
  }));

  return {
    type: "bubble",
    header: {
      type: "box", 
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📋",
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
      paddingAll: "12px"
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
      spacing: "xs",
      paddingAll: "6px"
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
      paddingAll: "12px"
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
          margin: "xs"
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
              margin: "xs"
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

// 重新啟動時恢復所有提醒
function restoreReminders() {
  console.log('🔄 檢查並恢復現有的提醒任務...');
  let restoredCount = 0;
  
  for (const [userId, userDates] of userTasks) {
    for (const [date, tasks] of userDates) {
      for (const task of tasks) {
        if (task.reminderEnabled && task.taskTime) {
          const taskTime = new Date(task.taskTime);
          const now = new Date();
          
          // 只恢復未來的提醒
          if (taskTime > now) {
            scheduleReminder(task);
            restoredCount++;
          }
        }
      }
    }
  }
  
  console.log(`✅ 已恢復 ${restoredCount} 個提醒任務`);
}

// 每分鐘檢查一次提醒任務（作為備用機制）
function startReminderChecker() {
  setInterval(() => {
    const now = new Date();
    console.log(`🔍 [${now.toLocaleTimeString('zh-TW')}] 定期檢查提醒任務...`);
    
    let checkedCount = 0;
    let sentCount = 0;
    
    for (const [userId, userDates] of userTasks) {
      for (const [date, tasks] of userDates) {
        for (const task of tasks) {
          if (task.reminderEnabled && task.taskTime) {
            checkedCount++;
            
            // 解析任務時間 - 處理時區問題
            let taskTime;
            if (task.taskTime.includes('T')) {
              // datetime-local 格式需要當作台灣時間處理
              const localTimeStr = task.taskTime;
              // 將本地時間轉換為台灣時區的 Date 對象
              taskTime = new Date(localTimeStr + ':00+08:00'); // 加上台灣時區
            } else {
              taskTime = new Date(task.taskTime.replace('T', ' ') + '+08:00');
            }
            
            const reminderTime = new Date(taskTime.getTime() - task.reminderTime * 60000);
            
            // 取得台灣時間進行比較
            const taiwanNow = new Date(now.getTime() + 8 * 60 * 60 * 1000); // UTC+8
            
            console.log(`  📋 檢查任務: ${task.text}`);
            console.log(`    原始時間: ${task.taskTime}`);
            console.log(`    任務時間: ${taskTime.toISOString()} (${taskTime.toLocaleString('zh-TW')})`);
            console.log(`    提醒時間: ${reminderTime.toISOString()} (${reminderTime.toLocaleString('zh-TW')})`);
            console.log(`    UTC時間: ${now.toISOString()}`);
            console.log(`    台灣時間: ${taiwanNow.toISOString()} (${taiwanNow.toLocaleString('zh-TW')})`);
            console.log(`    是否已發送: ${task.reminderSent}`);
            
            // 使用 UTC 時間進行比較，但確保時區正確
            if (!task.reminderSent && now >= reminderTime && now < taskTime) {
              console.log('🚨 提醒時間到了！立即發送提醒');
              sendTaskReminder(task);
              
              // 標記為已發送，避免重複發送
              task.reminderSent = true;
              sentCount++;
            } else if (task.reminderSent) {
              console.log('⏭️ 提醒已發送過，跳過');
            } else if (now >= taskTime) {
              console.log('⏰ 任務時間已過');
            } else if (now < reminderTime) {
              console.log(`⏳ 還需等待 ${Math.round((reminderTime.getTime() - now.getTime()) / 60000)} 分鐘`);
            }
            // 重新安排未來的提醒
            else if (reminderTime > now && !reminderTimeouts.has(task.id)) {
              console.log('🔧 重新安排未來的提醒');
              scheduleReminder(task);
            }
          }
        }
      }
    }
    
    console.log(`✅ 檢查完成：檢查了 ${checkedCount} 個提醒任務，發送了 ${sentCount} 個提醒`);
  }, 60000); // 每60秒檢查一次
}

// 語音訊息處理函數
async function handleAudioMessage(event) {
  const userId = event.source.userId;
  const audioId = event.message.id;
  
  try {
    console.log('🎵 開始處理語音訊息...');
    console.log('📋 語音 ID:', audioId);
    console.log('👤 用戶 ID:', userId.substring(0, 10) + '...');
    
    // 先發送處理中的回應
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🎤 正在處理您的語音訊息，請稍候...'
    });
    
    // 下載語音檔案
    console.log('📥 下載語音檔案...');
    const audioBuffer = await downloadAudioFile(audioId);
    
    if (!audioBuffer) {
      throw new Error('無法下載語音檔案');
    }
    
    // 轉換語音為文字
    console.log('🔄 轉換語音為文字...');
    const transcribedText = await transcribeAudio(audioBuffer);
    
    if (!transcribedText || transcribedText.trim() === '') {
      // 無法識別語音內容
      await client.pushMessage(userId, {
        type: 'text',
        text: '😅 抱歉，無法識別您的語音內容，請嘗試說得更清楚一點或使用文字輸入。'
      });
      return;
    }
    
    console.log('✅ 語音轉文字成功:', transcribedText);
    
    // 建立虛擬的文字訊息事件，重用現有的文字處理邏輯
    const textEvent = {
      ...event,
      message: {
        type: 'text',
        text: transcribedText
      },
      replyToken: null // 清空 replyToken，避免重複回應
    };
    
    // 建立任務（重用現有邏輯）
    const today = new Date().toISOString().split('T')[0];
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
      text: transcribedText,
      createdAt: new Date().toISOString(),
      date: today,
      userId: userId,
      taskTime: null,
      category: 'work',
      customCategory: '',
      completed: false,
      notes: '📢 透過語音輸入',
      reminderEnabled: false,
      reminderTime: 30,
      reminderSent: false
    };
    
    userTasks.get(userId).get(today).push(newTask);
    console.log('📝 語音任務已儲存:', newTask);
    
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
          text: formatTaskDisplayText(task),
          size: "sm",
          color: "#333333",
          wrap: true,
          flex: 1
        }
      ],
      spacing: "xs",
      margin: index === 0 ? "none" : "xs"
    }));

    // 建立語音識別成功的 FLEX MESSAGE
    const audioResultMessage = {
      type: 'flex',
      altText: `🎤 語音已轉換: ${transcribedText}`,
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "🎤 語音識別成功",
              weight: "bold",
              size: "md",
              color: "#000000"
            }
          ],
          backgroundColor: "#FFFFFF",
          paddingAll: "6px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "識別結果：",
              size: "sm",
              color: "#666666",
              margin: "none"
            },
            {
              type: "text",
              text: transcribedText,
              size: "lg",
              weight: "bold",
              color: "#333333",
              wrap: true,
              margin: "sm"
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
                label: "編輯任務",
                uri: `${BASE_URL}/liff/edit-task.html?taskId=${taskId}&userId=${encodeURIComponent(userId)}`
              },
              color: "#DDA267",
              height: "sm",
              flex: 0
            }
          ],
          paddingAll: "8px",
          spacing: "none",
          alignItems: "center"
        }
      }
    };
    
    // 第二則：今天所有任務清單
    const taskListMessage = {
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
              text: "📋",
              weight: "bold",
              size: "lg",
              color: "#000000"
            },
            {
              type: "text",
              text: `今天任務 ${todayTasks.length} 項`,
              size: "sm",
              color: "#000000"
            }
          ],
          backgroundColor: "#FFFFFF",
          paddingAll: "6px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: taskListItems,
          spacing: "xs",
          paddingAll: "6px"
        },
        footer: {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "button",
              style: "primary",
              action: {
                type: "uri",
                label: "新增",
                uri: `${BASE_URL}/liff/edit-task.html?userId=${encodeURIComponent(userId)}`
              },
              color: "#DDA267",
              height: "sm",
              flex: 1
            },
            {
              type: "button",
              style: "primary",
              action: {
                type: "uri",
                label: "刪除",
                uri: `${BASE_URL}/liff/edit-task.html?userId=${encodeURIComponent(userId)}`
              },
              color: "#DDA267",
              height: "sm",
              flex: 1
            }
          ],
          paddingAll: "8px",
          spacing: "sm",
          alignItems: "center"
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
    taskListMessage.quickReply = quickReply;
    
    // 發送兩則訊息
    await client.pushMessage(userId, [audioResultMessage, taskListMessage]);
    
    console.log('✅ 語音任務處理完成');
    
    return true;
  } catch (error) {
    console.error('❌ 語音訊息處理錯誤:', error);
    
    // 發送錯誤訊息
    try {
      await client.pushMessage(userId, {
        type: 'text',
        text: '😅 語音處理失敗，請稍後再試或使用文字輸入。錯誤：' + error.message
      });
    } catch (pushError) {
      console.error('❌ 發送錯誤訊息失敗:', pushError);
    }
    
    throw error;
  }
}

// 下載語音檔案
async function downloadAudioFile(messageId) {
  try {
    console.log('📥 開始下載語音檔案，ID:', messageId);
    
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('✅ 語音檔案下載完成，大小:', buffer.length, 'bytes');
        resolve(buffer);
      });
      
      stream.on('error', (error) => {
        console.error('❌ 下載語音檔案失敗:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ 下載語音檔案錯誤:', error);
    throw error;
  }
}

// 處理todolist樣式的任務切換
async function handleTodoToggle(event, userId, action, taskId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    if (!userTasks.has(userId) || !userTasks.get(userId).has(today)) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📋 今天還沒有任務呢！'
      });
    }
    
    const todayTasks = userTasks.get(userId).get(today);
    const taskIndex = todayTasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 找不到指定的任務'
      });
    }
    
    const task = todayTasks[taskIndex];
    const isCompleting = action === '完成任務';
    
    // 切換任務狀態
    task.completed = isCompleting;
    task.completedAt = isCompleting ? new Date().toISOString() : null;
    
    console.log(`${isCompleting ? '✅' : '◯'} 任務狀態已更新: ${task.text} - ${isCompleting ? '已完成' : '未完成'}`);
    
    // 重新生成更新後的任務列表
    const completedCount = todayTasks.filter(t => t.completed).length;
    const taskItems = todayTasks.map((t, index) => {
      const textColor = t.completed ? "#999999" : "#333333";
      const buttonLabel = t.completed ? "☑️" : "☐";
      
      return {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: `${index + 1}. ${t.text}`,
            size: "sm",
            wrap: true,
            color: textColor,
            flex: 3,
            gravity: "center"
          },
          {
            type: "button",
            style: "link",
            height: "sm",
            flex: 1,
            action: {
              type: "message",
              label: buttonLabel,
              text: t.completed ? `取消完成 ${t.id}` : `完成任務 ${t.id}`
            }
          }
        ],
        spacing: "sm",
        margin: "xs"
      };
    });

    // 生成更新後的Flex Message
    const updatedMessage = {
      type: 'flex',
      altText: `任務清單已更新`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: completedCount === todayTasks.length ? `🎉 今天有 ${todayTasks.length} 項任務` : `📋 今天有 ${todayTasks.length} 項任務`,
              weight: "bold",
              size: "lg",
              color: "#333333"
            },
            {
              type: "text",
              text: `已完成 ${completedCount} 項、待完成 ${todayTasks.length - completedCount} 項`,
              weight: "regular",
              size: "md",
              color: "#666666",
              margin: "xs"
            },
            ...taskItems
          ],
          spacing: "sm",
          paddingAll: "20px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            completedCount === todayTasks.length ? {
              type: "text",
              text: "🎊 全部任務完成！",
              weight: "bold",
              size: "md",
              color: "#4CAF50",
              align: "center"
            } : {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "編輯",
                uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
              }
            }
          ],
          paddingAll: "20px"
        }
      }
    };
    
    return client.replyMessage(event.replyToken, updatedMessage);
    
  } catch (error) {
    console.error('❌ Todolist切換錯誤:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 操作失敗，請稍後再試'
    });
  }
}

// 使用 OpenAI Whisper API 轉換語音為文字
async function transcribeAudio(audioBuffer) {
  try {
    if (!openai) {
      throw new Error('OpenAI 未初始化，請檢查 API Key 設定');
    }
    
    console.log('🔄 使用 OpenAI Whisper API 轉換語音...');
    
    // 建立臨時檔案
    const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}.m4a`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    try {
      // 使用 OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'zh', // 指定中文
        response_format: 'text'
      });
      
      console.log('✅ Whisper API 轉換成功:', transcription);
      
      return transcription.trim();
    } finally {
      // 清理臨時檔案
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️ 已清理臨時語音檔案');
      }
    }
  } catch (error) {
    console.error('❌ 語音轉文字失敗:', error);
    
    if (error.response) {
      console.error('API 錯誤詳情:', error.response.data);
    }
    
    throw new Error(`語音轉文字失敗: ${error.message}`);
  }
}

// 啟動服務器
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 精簡版 LINE Bot 啟動成功！');
  console.log(`📡 服務運行於: ${BASE_URL}`);
  console.log(`🔗 Webhook URL: ${BASE_URL}/webhook`);
  console.log(`📱 LIFF 任務頁面: ${BASE_URL}/liff/tasks.html`);
  console.log(`👤 LIFF 個人頁面: ${BASE_URL}/liff/profile.html`);
  console.log('📝 請將 Webhook URL 設定到 LINE Developer Console');
  console.log('🎤 語音識別功能已啟用 (使用 OpenAI Whisper)');
  console.log('⚡ 準備接收 LINE 訊息...');
  
  // 啟動後恢復提醒任務
  setTimeout(() => {
    restoreReminders();
    startReminderChecker();
  }, 5000); // 5秒後開始恢復提醒
});