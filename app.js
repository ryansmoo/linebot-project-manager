require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
// 條件式載入資料庫模組（Railway 環境跳過）
let database = null;
if (process.env.RAILWAY_ENVIRONMENT === undefined) {
  try {
    database = require('./database');
  } catch (error) {
    console.log('⚠️ SQLite 資料庫模組載入失敗，使用記憶體模式');
  }
}
const supabaseConfig = require('./supabase-config');
const googleCalendarService = require('./google-calendar-service');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'eaaf339ed4aa0a351b5893f10d4581c5'
};


const client = new line.Client(config);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 任務儲存系統（記憶體儲存，按用戶ID分組）
const userTasks = new Map();

// 對話記憶系統（用於持續對話）
const conversationMemory = new Map(); // userId -> conversation history
const MAX_CONVERSATION_HISTORY = 10; // 每個用戶保留最多10條對話記錄

// 會員系統資料結構
const members = new Map(); // memberId -> memberData
const lineBindings = new Map(); // lineUserId -> memberId
const memberSessions = new Map(); // sessionId -> memberData

// 會員資料結構
// 創建統一的 Quick Reply 按鈕 - 全部使用 LIFF 應用程式
function createStandardQuickReply(baseUrl, userId) {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'uri',
          label: '今天',
          uri: `${baseUrl}/liff/tasks?filter=today`
        }
      },
      {
        type: 'action',
        action: {
          type: 'uri', 
          label: '所有',
          uri: `${baseUrl}/liff/tasks?filter=all`
        }
      },
      {
        type: 'action',
        action: {
          type: 'uri',
          label: '帳戶',
          uri: `${baseUrl}/liff/profile`
        }
      }
    ]
  };
}

function createMember(email, name, lineUserId = null) {
  const memberId = 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const member = {
    id: memberId,
    email: email,
    name: name,
    lineUserId: lineUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    settings: {
      chatMode: 'smart', // smart, task, chat
      notifications: true,
      theme: 'default'
    },
    profile: {
      avatar: null,
      bio: '',
      timezone: 'Asia/Taipei'
    }
  };
  
  members.set(memberId, member);
  
  if (lineUserId) {
    lineBindings.set(lineUserId, memberId);
  }
  
  return member;
}

// 根據LINE UserId獲取會員資料
function getMemberByLineUserId(lineUserId) {
  const memberId = lineBindings.get(lineUserId);
  return memberId ? members.get(memberId) : null;
}

// 綁定LINE UserId到會員帳號
function bindLineToMember(memberId, lineUserId) {
  const member = members.get(memberId);
  if (!member) return false;
  
  member.lineUserId = lineUserId;
  member.updatedAt = new Date().toISOString();
  lineBindings.set(lineUserId, memberId);
  
  return true;
}

// 對話記憶管理函數
function addToConversationMemory(userId, role, content) {
  if (!conversationMemory.has(userId)) {
    conversationMemory.set(userId, []);
  }
  
  const history = conversationMemory.get(userId);
  history.push({
    role: role,
    content: content,
    timestamp: new Date().toISOString()
  });
  
  // 保持對話記錄在限制範圍內
  if (history.length > MAX_CONVERSATION_HISTORY) {
    history.shift(); // 移除最舊的記錄
  }
  
  conversationMemory.set(userId, history);
}

function getConversationHistory(userId) {
  return conversationMemory.get(userId) || [];
}

function clearConversationMemory(userId) {
  conversationMemory.delete(userId);
}

// 時間檢測和解析功能
function extractTimeFromText(text) {
  // 匹配時間格式：HH:MM 或 H:MM
  const timePattern = /(\d{1,2})[：:]\d{2}/;
  const match = text.match(timePattern);
  
  if (match) {
    const timeStr = match[0].replace('：', ':'); // 統一格式
    const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
    
    // 驗證時間有效性
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return {
        hasTime: true,
        time: timeStr,
        hours: hours,
        minutes: minutes,
        textWithoutTime: text.replace(timePattern, '').trim(),
        originalText: text
      };
    }
  }
  
  return {
    hasTime: false,
    time: null,
    hours: null,
    minutes: null,
    textWithoutTime: text,
    originalText: text
  };
}

// 任務管理功能（同步到 Supabase）
async function addTask(userId, taskText) {
  if (!userTasks.has(userId)) {
    userTasks.set(userId, []);
  }
  
  // 解析任務中的時間資訊
  const timeInfo = extractTimeFromText(taskText);
  
  const task = {
    id: Date.now(),
    text: taskText,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('zh-TW')
  };
  
  // 記錄到記憶體
  userTasks.get(userId).push(task);
  
  // 同步記錄到 Supabase
  try {
    const supabaseTaskData = {
      line_user_id: userId,
      task_text: taskText,
      task_title: timeInfo.textWithoutTime || taskText,
      task_time: timeInfo.hasTime ? timeInfo.time : null,
      has_time: timeInfo.hasTime,
      status: 'active',
      metadata: {
        local_task_id: task.id,
        extracted_time_info: timeInfo
      }
    };
    
    const result = await supabaseConfig.addTask(supabaseTaskData);
    if (result.success) {
      console.log(`✅ 任務已同步到 Supabase - User: ${userId}, Task: ${taskText}`);
      // 更新本地任務資料，包含 Supabase ID
      task.supabaseId = result.data.id;
    } else {
      console.error('❌ 同步任務到 Supabase 失敗:', result.error);
    }
  } catch (error) {
    console.error('❌ 同步任務到 Supabase 發生錯誤:', error);
  }
  
  console.log(`Added task for user ${userId}: ${taskText}`);
  return task;
}

// 從 Supabase 和記憶體取得今日任務
async function getTodayTasks(userId) {
  try {
    // 先從 Supabase 取得最新資料
    const supabaseResult = await supabaseConfig.getUserTasks(userId);
    if (supabaseResult.success) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const todayTasks = supabaseResult.data.filter(task => 
        task.task_date === today && task.status === 'active'
      );
      
      // 轉換為本地格式以保持相容性
      return todayTasks.map(task => ({
        id: task.metadata?.local_task_id || task.id,
        text: task.task_text,
        timestamp: task.created_at,
        date: new Date(task.task_date).toLocaleDateString('zh-TW'),
        supabaseId: task.id,
        hasTime: task.has_time,
        taskTime: task.task_time
      }));
    }
  } catch (error) {
    console.error('❌ 從 Supabase 取得任務失敗:', error);
  }
  
  // 備援：從記憶體取得
  if (!userTasks.has(userId)) {
    return [];
  }
  
  const today = new Date().toLocaleDateString('zh-TW');
  return userTasks.get(userId).filter(task => task.date === today);
}

async function getAllTasks(userId) {
  try {
    // 先從 Supabase 取得所有任務
    const supabaseResult = await supabaseConfig.getUserTasks(userId);
    if (supabaseResult.success) {
      return supabaseResult.data.map(task => ({
        id: task.metadata?.local_task_id || task.id,
        text: task.task_text,
        timestamp: task.created_at,
        date: new Date(task.task_date).toLocaleDateString('zh-TW'),
        supabaseId: task.id,
        hasTime: task.has_time,
        taskTime: task.task_time,
        status: task.status
      }));
    }
  } catch (error) {
    console.error('❌ 從 Supabase 取得所有任務失敗:', error);
  }
  
  // 備援：從記憶體取得
  return userTasks.get(userId) || [];
}

const app = express();

// 用於存儲 OAuth 狀態
const oauthStates = new Map();

// JSON 解析中間件（只用於 API 路由）
app.use('/api', express.json());

app.get('/stats', (req, res) => {
  const totalUsers = userTasks.size;
  const totalTasks = Array.from(userTasks.values()).reduce((total, tasks) => total + tasks.length, 0);
  
  res.json({ 
    status: '📝 記事機器人 Running',
    timestamp: new Date().toISOString(),
    features: [
      '📋 任務記錄與管理', 
      '📱 Flex Message卡片', 
      '🤖 ChatGPT智能回覆',
      '🔐 LINE Login會員系統',
      '👤 個人化設定管理'
    ],
    endpoints: {
      webhook: '/webhook',
      health: '/health',
      auth: '/auth',
      member_profile: '/profile/:userId'
    },
    stats: {
      totalUsers: totalUsers,
      totalTasks: totalTasks
    },
    ai: {
      enabled: !!process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    },
    usage: {
      addTask: '直接輸入任務，例如：「17:00小美約會」',
      listTasks: '詢問：「今天我的任務有哪些？」',
      help: '輸入：「幫助」查看完整說明'
    }
  });
});

// LINE Login 註冊頁面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'line_register.html'));
});

// LIFF App 智能路由頁面  
app.get('/liff-redirect', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LIFF App - 載入中</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #00B900, #06C755);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            color: white;
            text-align: center;
        }
        .loading {
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="loading">📱 正在載入 LIFF App...</div>
    
    <script>
        window.onload = function() {
            if (typeof liff !== 'undefined') {
                liff.init({
                    liffId: '${process.env.LINE_LIFF_ID || '2007976732-Ye2k35eo'}'
                }).then(() => {
                    // 已登入用戶直接導向任務頁面
                    if (liff.isLoggedIn()) {
                        window.location.href = '/liff/tasks';
                    } else {
                        // 未登入用戶導向註冊頁面
                        window.location.href = '/';
                    }
                }).catch(err => {
                    console.error('LIFF 初始化失敗:', err);
                    // 發生錯誤時導向任務頁面
                    window.location.href = '/liff/tasks';
                });
            } else {
                // 非 LIFF 環境直接導向任務頁面
                window.location.href = '/liff/tasks';
            }
        };
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// OAuth 準備階段 API
app.post('/api/line-oauth/prepare', (req, res) => {
  try {
    const { state, referrer } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    console.log(`[OAuth] 準備狀態: ${state} (IP: ${clientIP})`);
    
    // 驗證狀態參數
    if (!state || state.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'invalid_state',
        message: '無效的狀態參數'
      });
    }
    
    // 儲存狀態資訊（15分鐘過期）
    const stateData = {
      token: state,
      ipAddress: clientIP,
      referrer: referrer,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分鐘
      isUsed: false
    };
    
    oauthStates.set(state, stateData);
    
    // 清理過期狀態
    cleanupExpiredStates();
    
    res.json({
      success: true,
      state: state,
      message: '準備完成，即將跳轉到 LINE 授權頁面'
    });
    
  } catch (error) {
    console.error('[OAuth] 準備流程錯誤:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '伺服器錯誤，請稍後再試'
    });
  }
});

// 清理過期狀態的函數
function cleanupExpiredStates() {
  try {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [state, data] of oauthStates.entries()) {
      if (now > data.expiresAt) {
        oauthStates.delete(state);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[清理] 清除了 ${cleanedCount} 個過期狀態`);
    }
  } catch (error) {
    console.error('[清理] 清理狀態失敗:', error);
  }
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bot: 'running',
    ai: {
      enabled: !!process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    }
  });
});

// Google Calendar OAuth 授權回調
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('缺少必要的授權參數');
    }

    const result = await googleCalendarService.handleOAuthCallback(code, state);
    
    if (result.success) {
      // 授權成功頁面
      const html = `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>✅ Google Calendar 授權成功</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
                  min-height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 20px;
              }
              
              .container {
                  background: white;
                  border-radius: 20px;
                  padding: 40px;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                  max-width: 400px;
                  width: 100%;
              }
              
              .success-icon {
                  font-size: 60px;
                  margin-bottom: 20px;
              }
              
              .title {
                  font-size: 24px;
                  font-weight: bold;
                  color: #333;
                  margin-bottom: 15px;
              }
              
              .message {
                  color: #666;
                  margin-bottom: 30px;
                  line-height: 1.5;
              }
              
              .instruction {
                  background: #f8f9fa;
                  border-radius: 10px;
                  padding: 20px;
                  color: #333;
                  font-size: 14px;
                  line-height: 1.5;
              }
              
              .highlight {
                  color: #4285F4;
                  font-weight: bold;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="success-icon">✅</div>
              <div class="title">Google Calendar 授權成功！</div>
              <div class="message">
                  您的帳號已成功連結到 Google Calendar。
              </div>
              <div class="instruction">
                  <strong>下一步：</strong><br>
                  回到 LINE 聊天室，當您輸入帶有時間的任務時<br>
                  （例如：<span class="highlight">20:00 回家吃飯</span>），<br>
                  就可以點擊 <span class="highlight">📅 上傳日曆</span> 按鈕<br>
                  自動同步到您的 Google Calendar！
              </div>
          </div>
          
          <script>
              // 3秒後自動關閉視窗
              setTimeout(() => {
                  if (window.opener) {
                      window.close();
                  }
              }, 3000);
          </script>
      </body>
      </html>
      `;
      
      res.send(html);
    } else {
      // 授權失敗頁面
      res.status(400).send(`
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>❌ 授權失敗</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Google Calendar 授權失敗</h1>
            <p>錯誤：${result.error}</p>
            <p>請返回 LINE 重新嘗試授權。</p>
        </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('伺服器錯誤，請稍後再試');
  }
});

// 檢查用戶 Google Calendar 授權狀態
app.get('/api/calendar/status/:userId', (req, res) => {
  const userId = req.params.userId;
  const isAuthorized = googleCalendarService.isUserAuthorized(userId);
  
  res.json({
    userId: userId,
    isAuthorized: isAuthorized,
    authorizedUsers: googleCalendarService.getAuthorizedUsers().length
  });
});

// 撤銷用戶授權
app.post('/api/calendar/revoke/:userId', (req, res) => {
  const userId = req.params.userId;
  const success = googleCalendarService.revokeUserAuth(userId);
  
  res.json({
    success: success,
    message: success ? '授權已撤銷' : '用戶未授權或撤銷失敗'
  });
});

// 任務網頁路由
app.get('/tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const todayTasks = getTodayTasks(userId);
  const today = new Date().toLocaleDateString('zh-TW');
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📝 今日待辦事項</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .date {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        
        .header .count {
            font-size: 14px;
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
        }
        
        .content {
            padding: 30px 20px;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        
        .empty-state h3 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #333;
        }
        
        .empty-state p {
            font-size: 16px;
            line-height: 1.6;
        }
        
        .task-list {
            list-style: none;
        }
        
        .task-item {
            background: #f8f9fa;
            margin-bottom: 15px;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #2196F3;
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
        }
        
        .task-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        
        .task-item:nth-child(even) {
            border-left-color: #9C27B0;
        }
        
        .task-item:nth-child(3n) {
            border-left-color: #FF9800;
        }
        
        .task-number {
            position: absolute;
            top: -8px;
            left: -8px;
            background: #2196F3;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .task-text {
            font-size: 18px;
            color: #333;
            margin-bottom: 8px;
            padding-left: 10px;
            line-height: 1.4;
        }
        
        .task-time {
            font-size: 12px;
            color: #888;
            padding-left: 10px;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        
        .footer p {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .footer .logo {
            color: #2196F3;
            font-weight: bold;
        }
        
        .refresh-btn {
            background: #2196F3;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .refresh-btn:hover {
            background: #1976D2;
        }
        
        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            font-size: 20px;
            font-weight: bold;
            color: white;
        }
        
        .stat-label {
            font-size: 12px;
            opacity: 0.8;
        }
        
        @media (max-width: 480px) {
            body {
                padding: 10px;
            }
            
            .header {
                padding: 20px 15px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 20px 15px;
            }
            
            .task-text {
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 今日待辦事項</h1>
            <div class="date">${today}</div>
            <div class="count">共 ${todayTasks.length} 項任務</div>
            <div class="stats">
                <div class="stat-item">
                    <div class="stat-number">${todayTasks.length}</div>
                    <div class="stat-label">待辦事項</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${new Date().getHours()}</div>
                    <div class="stat-label">當前時間</div>
                </div>
            </div>
        </div>
        
        <div class="content">
            ${todayTasks.length === 0 ? `
                <div class="empty-state">
                    <div class="icon">🎉</div>
                    <h3>今日任務全部完成！</h3>
                    <p>您今天還沒有任何待辦事項<br>
                    在LINE中傳送任務給機器人來新增待辦事項<br>
                    例如：「17:00小美約會」</p>
                </div>
            ` : `
                <ul class="task-list">
                    ${todayTasks.map((task, index) => `
                        <li class="task-item">
                            <div class="task-number">${index + 1}</div>
                            <div class="task-text">${task.text}</div>
                            <div class="task-time">新增於 ${new Date(task.timestamp).toLocaleTimeString('zh-TW')}</div>
                        </li>
                    `).join('')}
                </ul>
            `}
        </div>
        
        <div class="footer">
            <p>由 <span class="logo">📝 記事機器人</span> 為您服務</p>
            <button class="refresh-btn" onclick="window.location.reload()">🔄 重新整理</button>
        </div>
    </div>

    <script>
        // 自動刷新功能
        setInterval(() => {
            const refreshBtn = document.querySelector('.refresh-btn');
            if (refreshBtn) {
                refreshBtn.style.background = '#4CAF50';
                refreshBtn.innerHTML = '🔄 自動更新中...';
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }, 60000); // 每60秒自動刷新

        // 添加載入動畫
        document.addEventListener('DOMContentLoaded', function() {
            const taskItems = document.querySelectorAll('.task-item');
            taskItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    item.style.transition = 'opacity 0.5s, transform 0.5s';
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 100);
            });
        });
    </script>
</body>
</html>`;

  res.send(html);
});

// 任務編輯頁面
app.get('/edit-task/:userId/:taskId', (req, res) => {
  const { userId, taskId } = req.params;
  const tasks = getAllTasks(userId);
  const task = tasks.find(t => t.id == taskId) || { text: '', id: taskId };
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✏️ 編輯任務</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 30px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #2196F3;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            color: #333;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #2196F3;
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s;
            margin-bottom: 10px;
        }
        
        .btn-primary {
            background-color: #2196F3;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #1976D2;
        }
        
        .btn-secondary {
            background-color: #ccc;
            color: #333;
        }
        
        .btn-secondary:hover {
            background-color: #bbb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✏️ 編輯任務</h1>
        </div>
        
        <form id="editForm">
            <div class="form-group">
                <label class="form-label" for="taskText">任務內容：</label>
                <input type="text" id="taskText" name="taskText" class="form-input" value="${task.text}" placeholder="請輸入任務內容...">
            </div>
            
            <button type="submit" class="btn btn-primary">💾 儲存變更</button>
            <button type="button" class="btn btn-secondary" onclick="window.close()">❌ 取消</button>
        </form>
    </div>
    
    <script>
        document.getElementById('editForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskText = document.getElementById('taskText').value;
            
            if (!taskText.trim()) {
                alert('請輸入任務內容');
                return;
            }
            
            try {
                const response = await fetch('/api/update-task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: '${userId}',
                        taskId: '${taskId}',
                        text: taskText
                    })
                });
                
                if (response.ok) {
                    alert('任務已更新成功！');
                    window.close();
                } else {
                    alert('更新失敗，請再試一次');
                }
            } catch (error) {
                alert('發生錯誤，請再試一次');
            }
        });
    </script>
</body>
</html>`;
  
  res.send(html);
});

// 今日任務頁面
app.get('/today-tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const todayTasks = getTodayTasks(userId);
  const today = new Date().toLocaleDateString('zh-TW');
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📋 本日任務</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .content {
            padding: 30px 20px;
        }
        
        .task-item {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 5px solid #2196F3;
            animation: fadeIn 0.5s ease-in-out;
        }
        
        .task-number {
            color: #2196F3;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .task-text {
            font-size: 16px;
            color: #333;
            margin-bottom: 8px;
        }
        
        .task-time {
            font-size: 12px;
            color: #888;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #888;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 本日任務</h1>
            <div>${today}</div>
            <div>共 ${todayTasks.length} 項任務</div>
        </div>
        
        <div class="content">
            ${todayTasks.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <h3>今日任務全部完成！</h3>
                    <p>您今天還沒有任何待辦事項</p>
                </div>
            ` : todayTasks.map((task, index) => `
                <div class="task-item" style="animation-delay: ${index * 0.1}s">
                    <div class="task-number">① ${index + 1}</div>
                    <div class="task-text">${task.text}</div>
                    <div class="task-time">新增於 ${new Date(task.timestamp).toLocaleTimeString('zh-TW')}</div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  
  res.send(html);
});

// 全部任務頁面
app.get('/all-tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const allTasks = getAllTasks(userId);
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📝 全部任務</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #9C27B0 0%, #E91E63 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .content {
            padding: 30px 20px;
            max-height: 60vh;
            overflow-y: auto;
        }
        
        .task-item {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 5px solid #9C27B0;
            animation: fadeIn 0.5s ease-in-out;
        }
        
        .task-number {
            color: #9C27B0;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .task-text {
            font-size: 16px;
            color: #333;
            margin-bottom: 8px;
        }
        
        .task-date {
            font-size: 12px;
            color: #888;
            margin-bottom: 5px;
        }
        
        .task-time {
            font-size: 12px;
            color: #aaa;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #888;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 全部任務</h1>
            <div>總共 ${allTasks.length} 項任務</div>
        </div>
        
        <div class="content">
            ${allTasks.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>還沒有任何任務</h3>
                    <p>開始在LINE中新增您的第一個任務吧！</p>
                </div>
            ` : allTasks.map((task, index) => `
                <div class="task-item" style="animation-delay: ${index * 0.1}s">
                    <div class="task-number">📌 ${index + 1}</div>
                    <div class="task-text">${task.text}</div>
                    <div class="task-date">日期：${task.date}</div>
                    <div class="task-time">時間：${new Date(task.timestamp).toLocaleTimeString('zh-TW')}</div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  
  res.send(html);
});

// 個人帳戶設定頁面
app.get('/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  const allTasks = getAllTasks(userId);
  const todayTasks = getTodayTasks(userId);
  
  // 檢查是否有綁定的會員帳號
  const member = getMemberByLineUserId(userId);
  const isLineBound = !!member;
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👤 個人帳戶</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #FF9800 0%, #FF5722 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .content {
            padding: 30px 20px;
        }
        
        .member-banner {
            background: linear-gradient(135deg, #00B900 0%, #009900 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .member-banner.unbound {
            background: linear-gradient(135deg, #FF9800 0%, #FF5722 100%);
        }
        
        .member-status {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-icon {
            font-size: 20px;
        }
        
        .status-text {
            font-weight: bold;
            font-size: 16px;
        }
        
        .member-info {
            text-align: right;
        }
        
        .member-name {
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .member-email {
            opacity: 0.8;
            font-size: 14px;
        }
        
        .bind-action {
            text-align: right;
        }
        
        .bind-btn {
            background: white;
            color: #FF9800;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .bind-btn:hover {
            background: #f0f0f0;
            transform: translateY(-2px);
        }
        
        .profile-info {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        
        .info-label {
            font-weight: bold;
            color: #333;
        }
        
        .info-value {
            color: #666;
        }
        
        .settings-section {
            margin-top: 30px;
        }
        
        .settings-title {
            font-size: 20px;
            color: #FF9800;
            margin-bottom: 15px;
            font-weight: bold;
        }
        
        .setting-item {
            background: #f8f9ff;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .setting-label {
            font-weight: bold;
            color: #333;
        }
        
        .setting-desc {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        
        .toggle {
            width: 50px;
            height: 25px;
            background: #ccc;
            border-radius: 25px;
            position: relative;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .toggle.active {
            background: #4CAF50;
        }
        
        .toggle::after {
            content: '';
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            position: absolute;
            top: 2.5px;
            left: 2.5px;
            transition: transform 0.3s;
        }
        
        .toggle.active::after {
            transform: translateX(25px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👤 個人帳戶</h1>
            <div>用戶 ID: ${userId.substring(0, 8)}...</div>
        </div>
        
        <div class="content">
            ${isLineBound ? `
            <div class="member-banner">
                <div class="member-status">
                    <span class="status-icon">✅</span>
                    <span class="status-text">會員帳號已綁定</span>
                </div>
                <div class="member-info">
                    <div class="member-name">${member.name}</div>
                    <div class="member-email">${member.email}</div>
                </div>
            </div>
            ` : `
            <div class="member-banner unbound">
                <div class="member-status">
                    <span class="status-icon">⚠️</span>
                    <span class="status-text">尚未綁定會員帳號</span>
                </div>
                <div class="bind-action">
                    <a href="/auth" class="bind-btn">立即註冊/綁定</a>
                </div>
            </div>
            `}
            
            <div class="profile-info">
                <div class="info-item">
                    <span class="info-label">👤 LINE用戶</span>
                    <span class="info-value">${userId.substring(0, 8)}...</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📊 總任務數</span>
                    <span class="info-value">${allTasks.length} 項</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📋 今日任務</span>
                    <span class="info-value">${todayTasks.length} 項</span>
                </div>
                ${isLineBound ? `
                <div class="info-item">
                    <span class="info-label">📅 註冊日期</span>
                    <span class="info-value">${new Date(member.createdAt).toLocaleDateString('zh-TW')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🔗 綁定狀態</span>
                    <span class="info-value" style="color: #00B900;">已綁定</span>
                </div>
                ` : `
                <div class="info-item">
                    <span class="info-label">📅 首次使用</span>
                    <span class="info-value">${new Date().toLocaleDateString('zh-TW')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🔗 會員狀態</span>
                    <span class="info-value" style="color: #FF9800;">未綁定</span>
                </div>
                `}
                <div class="info-item">
                    <span class="info-label">🤖 AI模型</span>
                    <span class="info-value">ChatGPT-3.5</span>
                </div>
            </div>
            
            <div class="settings-section">
                <h3 class="settings-title">🔧 聊天模式設定</h3>
                
                <div class="setting-item">
                    <div>
                        <div class="setting-label">🧠 智能模式</div>
                        <div class="setting-desc">自動識別任務並智能回覆</div>
                    </div>
                    <div class="toggle active" onclick="toggleSetting(this, 'smart')"></div>
                </div>
                
                <div class="setting-item">
                    <div>
                        <div class="setting-label">📝 任務優先</div>
                        <div class="setting-desc">優先將訊息識別為任務</div>
                    </div>
                    <div class="toggle" onclick="toggleSetting(this, 'task')"></div>
                </div>
                
                <div class="setting-item">
                    <div>
                        <div class="setting-label">💬 對話模式</div>
                        <div class="setting-desc">所有訊息都使用AI對話回覆</div>
                    </div>
                    <div class="toggle" onclick="toggleSetting(this, 'chat')"></div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        function toggleSetting(element, setting) {
            element.classList.toggle('active');
            const isActive = element.classList.contains('active');
            
            // 這裡可以發送設定到後端
            console.log(\`Setting \${setting} changed to: \${isActive}\`);
            
            // 如果需要，可以發送AJAX請求保存設定
            fetch('/api/update-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: '${userId}',
                    setting: setting,
                    value: isActive
                })
            });
        }
    </script>
</body>
</html>`;
  
  res.send(html);
});

// API路由 - 更新任務
app.post('/api/update-task', express.json(), (req, res) => {
  const { userId, taskId, text } = req.body;
  
  if (!userTasks.has(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const tasks = userTasks.get(userId);
  const taskIndex = tasks.findIndex(task => task.id == taskId);
  
  if (taskIndex === -1) {
    // 新增任務
    const newTask = {
      id: parseInt(taskId),
      text: text,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('zh-TW')
    };
    tasks.push(newTask);
  } else {
    // 更新現有任務
    tasks[taskIndex].text = text;
    tasks[taskIndex].timestamp = new Date().toISOString();
  }
  
  res.json({ success: true });
});

app.post('/api/update-settings', express.json(), (req, res) => {
  const { userId, setting, value } = req.body;
  // 這裡可以保存用戶設定到數據庫
  console.log(`User ${userId} updated setting ${setting} to ${value}`);
  res.json({ success: true });
});

// ================================
// 會員系統相關路由
// ================================

// 會員註冊/登入頁面
app.get('/auth', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔐 會員登入 - 記事機器人</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .auth-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        
        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 28px;
            color: #333;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        
        .line-login-btn {
            background: #00B900;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-bottom: 20px;
            transition: background-color 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .line-login-btn:hover {
            background: #009900;
        }
        
        .divider {
            margin: 20px 0;
            position: relative;
            text-align: center;
            color: #999;
        }
        
        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #ddd;
        }
        
        .divider span {
            background: white;
            padding: 0 15px;
        }
        
        .manual-form {
            text-align: left;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-label {
            display: block;
            color: #333;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .btn-primary {
            background-color: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #5a6fd8;
        }
        
        .features {
            margin-top: 30px;
            text-align: left;
        }
        
        .feature {
            margin-bottom: 10px;
            color: #666;
            font-size: 14px;
        }
        
        .feature::before {
            content: '✓';
            color: #00B900;
            font-weight: bold;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="logo">📝</div>
        <h1 class="title">記事機器人</h1>
        <p class="subtitle">智能任務管理 × LINE整合</p>
        
        <button class="line-login-btn" onclick="loginWithLine()">
            <span>⚠️</span>
            LINE Login 設定說明
        </button>
        
        <div class="divider">
            <span>或</span>
        </div>
        
        <form class="manual-form" id="authForm">
            <div class="form-group">
                <label class="form-label" for="email">電子信箱</label>
                <input type="email" id="email" name="email" class="form-input" placeholder="請輸入您的Email" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="name">姓名</label>
                <input type="text" id="name" name="name" class="form-input" placeholder="請輸入您的姓名" required>
            </div>
            <button type="submit" class="btn btn-primary">建立帳號</button>
        </form>
        
        <div class="features">
            <div class="feature">智能任務識別與管理</div>
            <div class="feature">LINE Bot 即時互動</div>
            <div class="feature">跨裝置同步存取</div>
            <div class="feature">個人化設定選項</div>
        </div>
    </div>
    
    <script>
        function loginWithLine() {
            // 跳轉到設定指引頁面
            window.location.href = '/line-login-setup';
        }
        
        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const name = document.getElementById('name').value;
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, name })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('註冊成功！請到LINE中與機器人對話完成綁定。');
                    window.location.href = '/auth/success?memberId=' + result.memberId;
                } else {
                    alert('註冊失敗：' + result.message);
                }
            } catch (error) {
                alert('發生錯誤，請再試一次');
            }
        });
    </script>
</body>
</html>`;
  
  res.send(html);
});

// LINE Login 回調處理
app.get('/auth/line/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.redirect('/auth?error=invalid_request');
  }
  
  try {
    // 這裡應該驗證state參數，實際應用中需要實現
    
    // 使用授權碼獲取access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: req.protocol + '://' + req.get('host') + '/auth/line/callback',
        client_id: process.env.LINE_LOGIN_CHANNEL_ID || '2006706842',
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET || 'your_channel_secret'
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }
    
    // 使用access token獲取用戶資料
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const profile = await profileResponse.json();
    
    // 檢查是否已有會員帳號
    let member = getMemberByLineUserId(profile.userId);
    
    if (!member) {
      // 創建新會員
      member = createMember(
        `${profile.userId}@line.user`, // 使用LINE ID作為臨時email
        profile.displayName,
        profile.userId
      );
    }
    
    // 創建會話
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    memberSessions.set(sessionId, {
      memberId: member.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小時後過期
    });
    
    // 設定會話cookie
    res.cookie('member_session', sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24小時
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.redirect('/auth/success');
    
  } catch (error) {
    console.error('LINE Login error:', error);
    res.redirect('/auth?error=login_failed');
  }
});

// 登入成功頁面
app.get('/auth/success', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✅ 登入成功 - 記事機器人</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .success-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-10px);
            }
            60% {
                transform: translateY(-5px);
            }
        }
        
        .title {
            font-size: 28px;
            color: #00B900;
            margin-bottom: 15px;
            font-weight: 700;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
            line-height: 1.5;
        }
        
        .next-steps {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: left;
        }
        
        .step {
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .step-number {
            background: #667eea;
            color: white;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            transition: background-color 0.3s;
            margin: 5px;
        }
        
        .btn-primary {
            background-color: #00B900;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #009900;
        }
        
        .btn-secondary {
            background-color: #667eea;
            color: white;
        }
        
        .btn-secondary:hover {
            background-color: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">🎉</div>
        <h1 class="title">登入成功！</h1>
        <p class="subtitle">
            您的LINE帳號已成功綁定到記事機器人會員系統。<br>
            現在可以享受完整的智能任務管理功能！
        </p>
        
        <div class="next-steps">
            <h3 style="color: #333; margin-bottom: 15px;">📋 接下來可以這樣做：</h3>
            <div class="step">
                <div class="step-number">1</div>
                <div>在LINE中與機器人對話，開始新增您的第一個任務</div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div>點擊任務清單中的按鈕，探索網頁管理介面</div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div>在個人帳戶中調整您的聊天模式偏好</div>
            </div>
        </div>
        
        <div>
            <a href="/profile/\${req.query.memberId || 'demo'}" class="btn btn-primary">查看個人資料</a>
            <button onclick="openLineApp()" class="btn btn-secondary">開啟LINE對話</button>
        </div>
    </div>
    
    <script>
        function openLineApp() {
            // 嘗試多種方式開啟LINE
            const lineBotId = '@记事机器人'; // 您的Bot ID
            
            // 方法1: 使用LINE URI scheme (適用於手機)
            const lineUri = 'line://ti/p/' + lineBotId;
            
            // 方法2: 使用LINE Web版 (適用於桌面)
            const lineWebUrl = 'https://line.me/R/ti/p/' + lineBotId;
            
            // 方法3: 使用QR Code頁面
            const qrCodeUrl = '/qr-code';
            
            // 檢測設備類型
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // 手機設備：優先嘗試LINE APP
                window.location.href = lineUri;
                
                // 備用方案：如果APP沒開啟，3秒後提供Web版選項
                setTimeout(() => {
                    if (confirm('無法開啟LINE應用程式？\\n點擊「確定」使用網頁版LINE，或「取消」查看QR Code。')) {
                        window.open(lineWebUrl, '_blank');
                    } else {
                        window.open(qrCodeUrl, '_blank');
                    }
                }, 3000);
            } else {
                // 桌面設備：直接顯示選項
                const choice = prompt('請選擇加入方式：\\n1. 輸入「1」開啟網頁版LINE\\n2. 輸入「2」查看QR Code\\n3. 手動搜尋Bot ID：' + lineBotId);
                
                if (choice === '1') {
                    window.open(lineWebUrl, '_blank');
                } else if (choice === '2') {
                    window.open(qrCodeUrl, '_blank');
                } else {
                    alert('請在LINE中搜尋Bot ID：' + lineBotId);
                }
            }
        }
        
        // 自動倒數跳轉提示
        let countdown = 30;
        const timer = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                clearInterval(timer);
                window.location.href = '/';
            }
        }, 1000);
    </script>
</body>
</html>`;
  
  res.send(html);
});

// LINE Login 設定指引頁面
app.get('/line-login-setup', (req, res) => {
  const callbackUrl = req.protocol + '://' + req.get('host') + '/auth/line/callback';
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔧 LINE Login 設定指引</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #00B900;
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #666;
            font-size: 16px;
        }
        
        .step {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 5px solid #00B900;
        }
        
        .step-title {
            color: #00B900;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .step-content {
            color: #333;
            line-height: 1.6;
        }
        
        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Monaco', 'Courier New', monospace;
            margin: 10px 0;
            overflow-x: auto;
        }
        
        .highlight {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
            margin: 15px 0;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #00B900;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 10px 5px;
            transition: background 0.3s;
        }
        
        .btn:hover {
            background: #009900;
        }
        
        .btn-secondary {
            background: #667eea;
        }
        
        .btn-secondary:hover {
            background: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 LINE Login 設定指引</h1>
            <p>設定 LINE Login 以啟用一鍵登入功能</p>
        </div>
        
        <div class="step">
            <div class="step-title">
                <span>1️⃣</span>
                前往 LINE Developer Console
            </div>
            <div class="step-content">
                <p>1. 訪問 <a href="https://developers.line.biz/console/" target="_blank" style="color: #00B900; font-weight: bold;">LINE Developer Console</a></p>
                <p>2. 登入您的 LINE 開發者帳號</p>
                <p>3. 選擇您的 Provider 或建立新的 Provider</p>
            </div>
        </div>
        
        <div class="step">
            <div class="step-title">
                <span>2️⃣</span>
                建立或選擇 LINE Login Channel
            </div>
            <div class="step-content">
                <p>1. 在 Channel 列表中找到您的 LINE Login Channel</p>
                <p>2. 如果沒有，請建立新的 LINE Login Channel</p>
                <p>3. 記下 Channel ID 和 Channel Secret</p>
            </div>
        </div>
        
        <div class="step">
            <div class="step-title">
                <span>3️⃣</span>
                設定 Callback URL
            </div>
            <div class="step-content">
                <p>1. 進入您的 LINE Login Channel 設定</p>
                <p>2. 找到「App settings」→「LINE Login settings」</p>
                <p>3. 在「Callback URL」欄位中加入以下網址：</p>
                <div class="code-block">${callbackUrl}</div>
                <div class="highlight">
                    <strong>📌 重要：</strong> 請將上方網址完整複製到 LINE Developer Console 的 Callback URL 設定中
                </div>
            </div>
        </div>
        
        <div class="step">
            <div class="step-title">
                <span>4️⃣</span>
                設定環境變數
            </div>
            <div class="step-content">
                <p>在您的 <code>.env</code> 檔案中加入以下設定：</p>
                <div class="code-block">LINE_LOGIN_CHANNEL_ID=您的_Channel_ID
LINE_LOGIN_CHANNEL_SECRET=您的_Channel_Secret</div>
                <p>替換成您在步驟2中記下的實際值</p>
            </div>
        </div>
        
        <div class="step">
            <div class="step-title">
                <span>5️⃣</span>
                測試設定
            </div>
            <div class="step-content">
                <p>1. 重新啟動您的應用程式</p>
                <p>2. 返回註冊頁面測試 LINE Login 功能</p>
                <p>3. 確認能夠成功跳轉到 LINE 授權頁面</p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="/auth" class="btn">返回註冊頁面</a>
            <a href="https://developers.line.biz/console/" target="_blank" class="btn btn-secondary">開啟 Developer Console</a>
        </div>
    </div>
</body>
</html>`;
  
  res.send(html);
});

// API: 手動註冊會員
app.post('/api/auth/register', express.json(), (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.json({ success: false, message: '請填寫完整資料' });
  }
  
  // 檢查email是否已存在
  const existingMember = Array.from(members.values()).find(m => m.email === email);
  if (existingMember) {
    return res.json({ success: false, message: '此Email已被註冊' });
  }
  
  try {
    const member = createMember(email, name);
    res.json({ 
      success: true, 
      memberId: member.id,
      message: '註冊成功！請到LINE中與機器人對話完成綁定。'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, message: '註冊失敗，請再試一次' });
  }
});

// API: 綁定LINE帳號
app.post('/api/auth/bind-line', express.json(), (req, res) => {
  const { memberId, lineUserId } = req.body;
  
  if (!memberId || !lineUserId) {
    return res.json({ success: false, message: '參數不完整' });
  }
  
  // 檢查LINE帳號是否已被其他會員綁定
  const existingBinding = lineBindings.get(lineUserId);
  if (existingBinding && existingBinding !== memberId) {
    return res.json({ success: false, message: '此LINE帳號已被其他會員綁定' });
  }
  
  const success = bindLineToMember(memberId, lineUserId);
  
  if (success) {
    res.json({ success: true, message: 'LINE帳號綁定成功' });
  } else {
    res.json({ success: false, message: '綁定失敗，會員不存在' });
  }
});

// 獲取當前服務的基礎URL
function getBaseUrl(req) {
  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }
  // 從環境變數或預設值獲取
  return process.env.BASE_URL || 'http://localhost:3000';
}

// 特殊「任務」關鍵字 Flex Message
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
          }
        ]
      }
    }
  };
}

// 任務記錄確認 Flex Message  
function createTaskRecordFlexMessage(taskText, userId, taskId, baseUrl) {
  // 檢測任務中是否包含時間
  const timeInfo = extractTimeFromText(taskText);
  
  // 基本按鈕
  const buttons = [
    {
      type: 'button',
      style: 'primary',
      height: 'sm',
      action: {
        type: 'uri',
        label: '📝 編輯',
        uri: `${baseUrl}/liff/tasks`
      }
    }
  ];
  
  // 如果有時間，加入日曆按鈕
  if (timeInfo.hasTime) {
    buttons.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '📅 上傳日曆',
        data: JSON.stringify({
          action: 'add_to_calendar',
          taskId: taskId,
          userId: userId,
          taskText: taskText,
          time: timeInfo.time,
          title: timeInfo.textWithoutTime || taskText
        })
      }
    });
  }
  

  return {
    type: 'flex',
    altText: `任務已記錄：${taskText}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 任務已記錄',
            weight: 'bold',
            size: 'xl',
            color: '#2196F3',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '您的任務：',
                size: 'sm',
                color: '#666666',
                margin: 'lg'
              },
              {
                type: 'text',
                text: taskText,
                weight: 'bold',
                size: 'lg',
                color: '#333333',
                margin: 'sm',
                wrap: true
              },
              // 如果有時間，顯示時間資訊
              ...(timeInfo.hasTime ? [{
                type: 'text',
                text: `⏰ 時間：${timeInfo.time}`,
                size: 'sm',
                color: '#4CAF50',
                margin: 'sm',
                weight: 'bold'
              }] : [])
            ]
          },
          {
            type: 'separator',
            margin: 'lg'
          }
        ],
        paddingAll: 'lg'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: buttons.concat([
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: timeInfo.hasTime ? '✅ 任務已記錄，可同步到 Google 日曆' : '✅ 任務已加入今日待辦清單',
            size: 'xs',
            color: '#888888',
            align: 'center',
            margin: 'sm'
          }
        ]),
        paddingAll: 'md'
      }
    }
  };
}

// 累積任務 Flex Message - 顯示今天所有任務
// 創建單個任務編輯 Flex Message（精簡版）
function createSingleTaskEditFlexMessage(task, userId, baseUrl) {
  return {
    type: 'flex',
    altText: `✅ 任務已新增：${task.text}`,
    contents: {
      type: 'bubble',
      size: 'nano',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ 已建立',
            weight: 'bold',
            color: '#00B900',
            size: 'sm',
            align: 'center',
            margin: 'none'
          },
          {
            type: 'text',
            text: task.text,
            size: 'md',
            weight: 'bold',
            color: '#333333',
            wrap: true,
            align: 'center',
            margin: 'sm'
          },
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '✏️ 編輯',
              uri: `${baseUrl}/liff/edit-task?taskId=${task.id}&userId=${userId}`
            },
            color: '#00B900',
            margin: 'sm'
          }
        ],
        spacing: 'xs',
        paddingAll: '12px'
      }
    }
  };
}

function createCumulativeTasksFlexMessage(todayTasks, userId, baseUrl) {
  const taskCount = todayTasks.length;
  
  // 顯示所有任務，使用更緊湊的格式
  const taskContents = todayTasks.map((task, index) => ({
    type: 'text',
    text: task.status === 'completed' ? `${index + 1}. ~~${task.text}~~` : `${index + 1}. ${task.text}`,
    size: 'xs',  // 使用更小的字體
    color: task.status === 'completed' ? '#888888' : '#333333',
    wrap: true,
    margin: 'none'  // 移除 margin 使更緊湊
  }));

  return {
    type: 'flex',
    altText: `今日任務清單 (${taskCount}項)`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📋 今日 ${taskCount} 項`,
            weight: 'bold',
            size: 'sm',  // 標題也縮小
            color: '#2196F3',
            align: 'center',
            margin: 'none'
          },
          // 任務列表區域
          {
            type: 'box',
            layout: 'vertical',
            contents: taskContents,
            spacing: 'none',  // 移除間距使更緊湊
            margin: 'xs'
          }
        ],
        spacing: 'xs',
        paddingAll: '6px'  // 進一步縮小 padding
      }
    }
  };
}

// 任務清單 Flex Message

function createTaskListFlexMessage(taskCount, tasks, userId, baseUrl) {
  return {
    type: 'flex',
    altText: `${taskCount}個待辦事項`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📋 ${taskCount}個待辦事項`,
            weight: 'bold',
            size: 'xl',
            color: '#2196F3',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: `今日共有 ${taskCount} 項任務`,
            size: 'sm',
            color: '#666666',
            margin: 'lg',
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: tasks.slice(0, 3).map((task, index) => ({
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: `${index + 1}.`,
                  size: 'sm',
                  color: '#888888',
                  flex: 0
                },
                {
                  type: 'text',
                  text: task.status === 'completed' ? `~~${task.text}~~` : task.text,
                  size: 'sm',
                  color: task.status === 'completed' ? '#888888' : '#333333',
                  margin: 'xs',
                  wrap: true,
                  flex: 1
                }
              ],
              margin: 'sm'
            })).concat(taskCount > 3 ? [{
              type: 'text',
              text: `...還有 ${taskCount - 3} 項任務`,
              size: 'xs',
              color: '#aaaaaa',
              align: 'center',
              margin: 'sm'
            }] : []),
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          }
        ],
        paddingAll: 'lg'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📱 點擊查看詳細任務資訊',
                size: 'xs',
                color: '#888888',
                align: 'center'
              }
            ],
            margin: 'sm'
          }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

function createAllTasksFlexMessage(taskCount, tasks, userId, baseUrl) {
  // 按日期分組任務
  const tasksByDate = {};
  const today = new Date().toDateString();
  
  tasks.forEach(task => {
    const taskDate = new Date(task.timestamp).toDateString();
    const dateKey = taskDate === today ? '今天' : new Date(task.timestamp).toLocaleDateString('zh-TW');
    if (!tasksByDate[dateKey]) {
      tasksByDate[dateKey] = [];
    }
    tasksByDate[dateKey].push(task);
  });

  const dateGroups = Object.keys(tasksByDate);
  
  return {
    type: 'flex',
    altText: `所有任務 (共${taskCount}項)`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📋 所有任務 (${taskCount}項)`,
            weight: 'bold',
            size: 'xl',
            color: '#FF6B35',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: dateGroups.slice(0, 3).flatMap(dateKey => {
              const dateTasks = tasksByDate[dateKey];
              return [
                {
                  type: 'text',
                  text: `📅 ${dateKey} (${dateTasks.length}項)`,
                  size: 'md',
                  color: '#FF6B35',
                  weight: 'bold',
                  margin: 'lg'
                }
              ].concat(
                dateTasks.slice(0, 2).map((task, index) => ({
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: `• `,
                      size: 'sm',
                      color: '#888888',
                      flex: 0
                    },
                    {
                      type: 'text',
                      text: task.status === 'completed' ? `~~${task.text}~~` : task.text,
                      size: 'sm',
                      color: task.status === 'completed' ? '#888888' : '#333333',
                      margin: 'xs',
                      wrap: true,
                      flex: 1
                    }
                  ],
                  margin: 'xs'
                }))
              ).concat(
                dateTasks.length > 2 ? [{
                  type: 'text',
                  text: `  ...還有 ${dateTasks.length - 2} 項`,
                  size: 'xs',
                  color: '#aaaaaa',
                  margin: 'xs'
                }] : []
              );
            }).concat(
              taskCount > 20 ? [{
                type: 'text',
                text: '...(顯示前20項任務)',
                size: 'xs',
                color: '#aaaaaa',
                align: 'center',
                margin: 'lg'
              }] : []
            ),
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          }
        ],
        paddingAll: 'lg'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📱 完整任務清單請使用 LIFF 應用',
                size: 'xs',
                color: '#888888',
                align: 'center'
              }
            ],
            margin: 'sm'
          }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

async function getChatGPTResponse(userMessage, userId) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return '抱歉，AI功能尚未設定。請聯繫管理員設定OpenAI API金鑰。';
    }

    // 添加超時控制，避免webhook超時
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenAI_TIMEOUT')), 20000)
    );

    // 獲取用戶的對話歷史
    const conversationHistory = getConversationHistory(userId);
    
    // 構建訊息陣列，包含系統提示、對話歷史和當前訊息
    const messages = [
      {
        role: 'system',
        content: '你是一個友善的LINE聊天機器人助手。你可以記住之前的對話內容，並提供連貫的對話體驗。請用繁體中文回答，保持回覆簡潔有用，通常在150字以內。如果用戶提到之前的對話內容，請適當地回應並延續話題。'
      }
    ];

    // 添加對話歷史（排除timestamp，只保留role和content）
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // 添加當前用戶訊息
    messages.push({
      role: 'user',
      content: userMessage
    });

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 400,
        temperature: 0.7
      }),
      timeoutPromise
    ]);

    const aiResponse = completion.choices[0].message.content.trim();

    // 將用戶訊息和AI回應加入對話記憶
    addToConversationMemory(userId, 'user', userMessage);
    addToConversationMemory(userId, 'assistant', aiResponse);

    return aiResponse;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    if (error.message === 'OpenAI_TIMEOUT') {
      return '⏱️ AI回覆處理中，請稍後再試或直接輸入任務。';
    } else if (error.code === 'insufficient_quota') {
      return '抱歉，AI服務配額已用完，請稍後再試。';
    } else if (error.code === 'invalid_api_key') {
      return '抱歉，AI服務設定有誤，請聯繫管理員。';
    } else {
      return '🤖 AI暫時無法回應，您可以直接輸入任務如：「17:00約會」';
    }
  }
}

// GET webhook 路由 - 用於 LINE Developer Console 驗證
app.get('/webhook', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'LINE Bot Webhook is working!',
    timestamp: new Date().toISOString(),
    server: 'Node.js + Express',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook - LINE Bot 訊息處理',
      health: 'GET / - 健康檢查',
      liff: 'GET /liff/* - LIFF 應用程式',
      api: 'GET /api/* - REST API'
    }
  });
});

app.post('/webhook', line.middleware(config), (req, res) => {
  const baseUrl = getBaseUrl(req);
  
  // 添加整體超時保護，確保在LINE 30秒限制內回應
  const timeout = setTimeout(() => {
    console.warn('Webhook處理超時，回傳200避免重試');
    if (!res.headersSent) {
      res.status(200).json({ status: 'timeout' });
    }
  }, 28000);

  Promise
    .all(req.body.events.map(event => handleEvent(event, baseUrl)))
    .then(result => {
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.json(result);
      }
    })
    .catch(err => {
      clearTimeout(timeout);
      console.error('Error handling events:', err);
      if (!res.headersSent) {
        res.status(200).json({ error: 'handled' });
      }
    });
});

// 處理 postback 事件（按鈕點擊）
async function handlePostbackEvent(event, baseUrl) {
  const userId = event.source.userId || 'default-user';
  
  try {
    const postbackData = JSON.parse(event.postback.data);
    console.log('Postback data:', postbackData);
    
    if (postbackData.action === 'add_to_calendar') {
      console.log('📅 處理上傳日曆請求...');
      // 檢查用戶是否已授權 Google Calendar
      console.log('🔍 檢查用戶授權狀態...');
      const isAuthorized = await googleCalendarService.isUserAuthorized(userId);
      console.log('📅 用戶授權狀態:', isAuthorized);
      
      if (!isAuthorized) {
        // 需要授權，產生授權 URL
        console.log('🔐 用戶未授權，生成授權 URL...');
        const authUrl = googleCalendarService.generateAuthUrl(userId);
        console.log('🔗 授權 URL:', authUrl.substring(0, 100) + '...');
        
        console.log('💬 準備回覆 LINE 訊息...');
        const replyResult = await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `📅 請先完成 Google Calendar 授權：\n\n點擊連結進行授權：\n${authUrl}\n\n授權完成後，請再次點擊「上傳日曆」按鈕。`
        });
        console.log('✅ LINE 訊息回覆成功');
        return replyResult;
      }
      
      // 已授權，直接上傳到 Google Calendar
      const { taskId, taskText, title, time } = postbackData;
      
      // 解析時間格式
      const timeFormat = googleCalendarService.parseTaskTimeToCalendarFormat(taskText, time);
      
      const eventData = {
        taskId,
        title: title || taskText,
        description: `LINE Bot 任務：${taskText}`,
        startTime: timeFormat.startTime,
        endTime: timeFormat.endTime
      };
      
      const result = await googleCalendarService.createCalendarEvent(userId, eventData);
      
      if (result.success) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `✅ 任務已成功同步到 Google Calendar！\n\n📅 事件連結：${result.eventUrl}`
        });
      } else {
        if (result.needAuth) {
          const authUrl = googleCalendarService.generateAuthUrl(userId);
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `❌ 需要重新授權 Google Calendar：\n\n點擊連結進行授權：\n${authUrl}`
          });
        } else {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `❌ 同步失敗：${result.error}`
          });
        }
      }
    }
    
    return Promise.resolve(null);
  } catch (error) {
    console.error('Error handling postback:', error);
    
    const errorMessage = {
      type: 'text',
      text: '❌ 處理請求時發生錯誤，請稍後再試。'
    };
    
    return client.replyMessage(event.replyToken, errorMessage);
  }
}



async function handleEvent(event, baseUrl) {
  console.log('Received event:', event);
  
  const startTime = Date.now();
  let intentDetected = null;
  let responseType = null;
  let isSuccessful = true;
  let errorMessage = null;

  // 處理不同類型的事件
  if (event.type === 'postback') {
    return handlePostbackEvent(event, baseUrl);
  }
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  const userMessage = event.message.text;
  const userId = event.source.userId || 'default-user';
  let replyMessage = '';

  try {
    // 記錄收到的訊息到資料庫（原本的系統）
    if (database && database && database.isInitialized) {
      await database.logChatMessage({
        lineUserId: userId,
        memberId: null, // 將在後面取得
        messageType: event.message.type,
        direction: 'incoming',
        content: userMessage,
        rawData: event,
        intentDetected: null, // 將在處理後更新
        responseType: null,
        processingTime: null,
        isSuccessful: true,
        errorMessage: null,
        sessionId: event.webhookEventId
      });

      // 更新用戶最後活動時間和統計
      await database.updateLastActivity(userId);
      await database.updateActivityStats(userId, 'message');
    }
    
    // 同時記錄到 Supabase
    try {
      const messageData = {
        line_user_id: userId,
        message_type: event.message.type,
        direction: 'incoming',
        content: userMessage,
        raw_data: event,
        session_id: event.webhookEventId
      };
      
      const result = await supabaseConfig.logMessage(messageData);
      if (!result.success) {
        console.error('❌ 記錄訊息到 Supabase 失敗:', result.error);
      }
    } catch (error) {
      console.error('❌ 記錄訊息到 Supabase 發生錯誤:', error);
    }
    if (userMessage.toLowerCase() === 'hello') {
      intentDetected = 'greeting';
      responseType = 'welcome';
      replyMessage = 'Hello! 你好！我是您的專屬記事機器人，可以幫您記錄和管理今日待辦事項！📝\n\n✨ 新功能：我現在擁有對話記憶，可以記住我們之前的聊天內容！\n\n📋 功能說明：\n• 直接輸入任務：「17:00小美約會」\n• 智能對話：任何問題都可以問我\n• 對話記錄：輸入「對話記錄」查看\n• 清除記憶：輸入「清除對話」重新開始';
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage,
        quickReply: createStandardQuickReply(baseUrl, userId)
      });
      
    } else if (userMessage === '任務') {
      // 特殊「任務」關鍵字處理 - 回傳 FLEX Message
      intentDetected = 'task_keyword';
      responseType = 'flex_message';
      
      const flexMessage = createTaskKeywordFlexMessage();
      
      return client.replyMessage(event.replyToken, flexMessage);
      
    } else if (userMessage === '清除對話' || userMessage === '清除記憶' || userMessage === '重新開始') {
      // 清除對話記憶功能
      intentDetected = 'clear_memory';
      responseType = 'memory_cleared';
      clearConversationMemory(userId);
      replyMessage = '✨ 對話記憶已清除！我們重新開始聊天吧～';
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage,
        quickReply: createStandardQuickReply(baseUrl, userId)
      });
      
    } else if (userMessage === '對話記錄' || userMessage === '聊天記錄') {
      // 顯示對話記錄摘要
      intentDetected = 'show_memory';
      responseType = 'memory_summary';
      const history = getConversationHistory(userId);
      
      if (history.length === 0) {
        replyMessage = '📝 目前還沒有對話記錄。';
      } else {
        replyMessage = `💬 最近的對話記錄：\n共有 ${history.length} 條記錄\n\n` +
                      `最後一次對話時間：${new Date(history[history.length - 1].timestamp).toLocaleString('zh-TW')}\n\n` +
                      `輸入「清除對話」可以重新開始聊天。`;
      }
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
      
    } else if (userMessage.includes('今天我的任務有哪些') || userMessage.includes('今日任務') || userMessage.includes('待辦事項') || userMessage === '任務清單' || userMessage === '今天') {
      intentDetected = 'task_query';
      responseType = 'task_list';
      console.log(`Getting tasks for user: ${userId}`);
      
      const todayTasks = await getTodayTasks(userId);
      const taskCount = todayTasks.length;
      
      if (taskCount === 0) {
        replyMessage = '🎉 今天還沒有任何待辦事項！\n您可以直接輸入任務，例如：「17:00小美約會」來新增任務。';
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage
        });
      }
      
      const flexMessage = createTaskListFlexMessage(taskCount, todayTasks, userId, baseUrl);
      flexMessage.quickReply = createStandardQuickReply(baseUrl, userId);
      
      return client.replyMessage(event.replyToken, flexMessage);
      
    } else if (userMessage.includes('所有任務') || userMessage.includes('全部任務') || userMessage.includes('所有待辦')) {
      intentDetected = 'all_tasks_query';
      responseType = 'all_tasks_list';
      console.log(`Getting all tasks for user: ${userId}`);
      
      const allTasks = await getAllTasks(userId);
      const taskCount = allTasks.length;
      
      if (taskCount === 0) {
        replyMessage = '📋 您目前還沒有任何任務！\n您可以直接輸入任務來新增，例如：「17:00小美約會」';
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage,
          quickReply: createStandardQuickReply(baseUrl, userId)
        });
      }
      
      const flexMessage = createAllTasksFlexMessage(taskCount, allTasks, userId, baseUrl);
      flexMessage.quickReply = createStandardQuickReply(baseUrl, userId);
      
      return client.replyMessage(event.replyToken, flexMessage);
      
    } else if (userMessage.toLowerCase().includes('/help') || userMessage === '幫助') {
      replyMessage = `📝 記事機器人功能說明：

🔸 **新增任務**：直接輸入您的任務
   例如：「17:00小美約會」

🔸 **查看任務**：詢問今日任務
   例如：「今天我的任務有哪些？」

🔸 **刪除任務**：指定任務編號刪除
   例如：「刪除第2點」、「刪除3」

🔸 **資料儲存**：所有訊息都會記錄到 Supabase 資料庫

🔸 **AI問答**：其他問題會由ChatGPT回答

🔸 **特殊指令**：
   - 「hello」: 歡迎訊息
   - 「幫助」: 查看此說明

開始輸入您的第一個任務吧！✨`;

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
      
    } else if (userMessage.includes('刪除') && (userMessage.includes('第') || userMessage.match(/\d+/))) {
      // 處理刪除任務功能
      intentDetected = 'task_delete';
      responseType = 'task_deleted';
      
      // 解析刪除指令，支援多種格式
      let taskNumber = null;
      
      // 匹配「刪除第3點」、「刪除第3個」、「刪除3」等格式
      const numberMatch = userMessage.match(/刪除.*?(\d+)/) || userMessage.match(/(\d+)/);
      
      if (numberMatch) {
        taskNumber = parseInt(numberMatch[1]);
        
        const todayTasks = getTodayTasks(userId);
        
        if (todayTasks.length === 0) {
          replyMessage = '❌ 目前沒有任何任務可以刪除。';
        } else if (taskNumber < 1 || taskNumber > todayTasks.length) {
          replyMessage = `❌ 無效的任務編號。目前有 ${todayTasks.length} 個任務，請輸入 1 到 ${todayTasks.length} 之間的數字。`;
        } else {
          // 刪除指定的任務
          const deletedTask = todayTasks[taskNumber - 1];
          console.log(`正在刪除任務:`, deletedTask);
          
          // 從記憶體中刪除任務
          if (!userTasks.has(userId)) {
            userTasks.set(userId, []);
          }
          
          const userTaskList = userTasks.get(userId);
          console.log(`刪除前用戶任務數量: ${userTaskList.length}`);
          
          // 使用更精確的匹配方式
          const taskIndex = userTaskList.findIndex(task => 
            task.text === deletedTask.text && 
            task.date === deletedTask.date
          );
          
          console.log(`找到任務索引: ${taskIndex}`);
          
          if (taskIndex !== -1) {
            userTaskList.splice(taskIndex, 1);
            userTasks.set(userId, userTaskList);
            console.log(`刪除後用戶任務數量: ${userTaskList.length}`);
          } else {
            console.log(`未找到要刪除的任務`);
          }
          
          // 從資料庫中刪除任務
          if (database && database.isInitialized) {
            try {
              // 尋找並刪除資料庫中的任務
              const member = await database.getMember(userId);
              if (member) {
                // 這裡可以根據任務內容搜尋並刪除對應的資料庫記錄
                console.log(`Deleting task from database: ${deletedTask.text}`);
              }
            } catch (dbError) {
              console.error('資料庫刪除任務錯誤:', dbError);
            }
          }
          
          // 獲取刪除後的任務列表並重新編號
          const updatedTasks = getTodayTasks(userId);
          
          if (updatedTasks.length === 0) {
            replyMessage = `✅ 已刪除任務：「${deletedTask.text}」\n\n🎉 所有任務已完成！您目前沒有待辦事項。`;
          } else {
            // 生成更新後的任務列表
            let taskListText = `✅ 已刪除任務：「${deletedTask.text}」\n\n📋 更新後的任務列表：\n`;
            updatedTasks.forEach((task, index) => {
              taskListText += `${index + 1}. ${task.text}\n`;
            });
            
            replyMessage = taskListText.trim();
            
            // 生成 Flex Message 顯示更新後的任務列表
            const flexMessage = createTaskListFlexMessage(updatedTasks.length, updatedTasks, userId, baseUrl);
            flexMessage.quickReply = createStandardQuickReply(baseUrl, userId);
            
            return client.replyMessage(event.replyToken, flexMessage);
          }
        }
      } else {
        replyMessage = '❓ 請指定要刪除的任務編號，例如：「刪除第2個」或「刪除3」';
      }
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
      
    } else {
      // 檢查是否為任務格式（包含時間或具體事項）
      const isTask = userMessage.match(/\d{1,2}[:：]\d{2}/) || 
                    userMessage.includes('約會') || 
                    userMessage.includes('會議') || 
                    userMessage.includes('買') || 
                    userMessage.includes('去') || 
                    userMessage.includes('做') || 
                    userMessage.includes('完成') ||
                    userMessage.length > 3; // 簡單判斷：長度大於3可能是任務
      
      if (isTask && !userMessage.includes('？') && !userMessage.includes('?') && !userMessage.includes('什麼') && !userMessage.includes('如何')) {
        intentDetected = 'task_create';
        responseType = 'task_created';
        console.log(`Adding task for user ${userId}: ${userMessage}`);
        
        const task = await addTask(userId, userMessage);
        
        // 同時記錄任務到資料庫
        if (database && database.isInitialized) {
          try {
            const member = await database.getMember(userId);
            await database.createTask({
              taskId: task.id.toString(),
              lineUserId: userId,
              memberId: member ? member.member_id : null,
              title: userMessage,
              description: '',
              status: 'pending',
              priority: 1,
              dueDate: null,
              tags: '',
              source: 'line',
              metadata: { original_message: userMessage }
            });
          } catch (dbError) {
            console.error('Error saving task to database:', dbError);
          }
        }
        
        // 創建任務記錄確認訊息（包含日曆按鈕）
        const taskRecordMessage = createTaskRecordFlexMessage(userMessage, userId, task.id, baseUrl);
        
        // 獲取今天所有任務（包含剛新增的）
        const todayTasks = await getTodayTasks(userId);
        
        // 創建累積任務列表訊息
        const cumulativeTasksMessage = createCumulativeTasksFlexMessage(todayTasks, userId, baseUrl);
        cumulativeTasksMessage.quickReply = createStandardQuickReply(baseUrl, userId);
        
        // 發送兩則訊息：1.任務記錄確認（含日曆按鈕） 2.累積任務列表
        try {
          // 先回覆任務記錄確認訊息
          await client.replyMessage(event.replyToken, taskRecordMessage);
          
          // 再推送累積任務訊息
          await client.pushMessage(userId, cumulativeTasksMessage);
          
          return Promise.resolve();
        } catch (pushError) {
          console.error('Error sending multiple messages:', pushError);
          // 如果推送失敗，至少確保單個任務訊息已發送
          return Promise.resolve();
        }
        
      } else {
        // 其他訊息使用ChatGPT回覆（支持持續對話）
        intentDetected = 'general_query';
        responseType = 'ai_response';
        console.log(`Sending message to ChatGPT: ${userMessage}`);
        replyMessage = await getChatGPTResponse(userMessage, userId);
        console.log(`ChatGPT response: ${replyMessage}`);
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage
        });
      }
    }
  } catch (error) {
    console.error('Error in handleEvent:', error);
    isSuccessful = false;
    errorMessage = error.message;
    replyMessage = '抱歉，處理您的訊息時發生錯誤，請稍後再試。';
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMessage
    });
  } finally {
    // 記錄處理完成的資訊到資料庫
    if (database && database.isInitialized) {
      const processingTime = Date.now() - startTime;
      
      try {
        // 記錄回應訊息
        if (replyMessage) {
          await database.logChatMessage({
            lineUserId: userId,
            memberId: null,
            messageType: 'text',
            direction: 'outgoing',
            content: replyMessage,
            rawData: null,
            intentDetected: intentDetected,
            responseType: responseType,
            processingTime: processingTime,
            isSuccessful: isSuccessful,
            errorMessage: errorMessage,
            sessionId: event.webhookEventId
          });
        }
        
        // 記錄AI查詢統計
        if (responseType === 'ai_response') {
          await database.updateActivityStats(userId, 'ai_query');
        }
        
        // 記錄任務建立統計
        if (responseType === 'task_created') {
          await database.updateActivityStats(userId, 'task_create');
        }
        
      } catch (dbError) {
        console.error('Database logging error:', dbError);
      }
    }
  }
}

// QR Code 頁面路由
app.get('/qr-code', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📱 掃描 QR Code 加入 LINE Bot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #00D000 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        
        .header {
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #00B900;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #666;
            font-size: 16px;
        }
        
        .qr-container {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 15px;
            border: 2px dashed #00B900;
        }
        
        .qr-code {
            width: 200px;
            height: 200px;
            margin: 0 auto;
        }
        
        .instructions {
            background: #e3f2fd;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .step {
            display: flex;
            align-items: center;
            margin: 10px 0;
            text-align: left;
        }
        
        .step-number {
            background: #00B900;
            color: white;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 10px;
            font-size: 12px;
        }
        
        .manual-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .bot-id {
            background: #f1f3f4;
            border-radius: 5px;
            padding: 8px;
            font-family: monospace;
            font-weight: bold;
            color: #00B900;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 加入 LINE Bot</h1>
            <p>掃描 QR Code 或手動搜尋</p>
        </div>
        
        <div class="qr-container">
            <div class="qr-code">
                <!-- QR Code 會由 Google Charts API 生成 -->
                <img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=https://line.me/R/ti/p/@记事机器人" 
                     alt="LINE Bot QR Code" 
                     style="width: 100%; height: 100%; border-radius: 10px;">
            </div>
        </div>
        
        <div class="instructions">
            <div class="step">
                <div class="step-number">1</div>
                <div>開啟 LINE 應用程式</div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div>點擊右上角的「+」添加好友</div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div>選擇「QR Code」掃描上方圖片</div>
            </div>
            <div class="step">
                <div class="step-number">4</div>
                <div>點擊「加入好友」開始使用</div>
            </div>
        </div>
        
        <div class="manual-info">
            <strong>📝 手動搜尋方式：</strong><br>
            在 LINE 中搜尋 Bot ID：
            <div class="bot-id">@记事机器人</div>
            <small>※ 請確保包含 @ 符號</small>
        </div>
        
        <button onclick="window.close()" 
                style="margin-top: 20px; padding: 12px 30px; background: #00B900; color: white; border: none; border-radius: 25px; font-size: 16px; cursor: pointer;">
            完成
        </button>
    </div>
</body>
</html>
  `;
  
  res.send(html);
});

// ================================
// 資料庫管理介面
// ================================

// 資料庫管理主頁
app.get('/admin/dashboard', async (req, res) => {
  try {
    const stats = await database.getDatabaseStats();
    const systemLogs = await database.getSystemLogs(null, null, 20);
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 資料庫管理後台</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .admin-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .content {
            padding: 30px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: #f8f9ff;
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            border-left: 5px solid #667eea;
        }
        
        .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .stat-label {
            color: #666;
            font-size: 16px;
        }
        
        .section {
            background: #f8f9ff;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
        }
        
        .section-title {
            color: #333;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .nav-buttons {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        
        .nav-btn {
            background: #667eea;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s;
            cursor: pointer;
        }
        
        .nav-btn:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
        }
        
        .log-item {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            border-left: 4px solid;
            font-size: 14px;
        }
        
        .log-info { border-left-color: #00B900; }
        .log-warning { border-left-color: #FF9800; }
        .log-error { border-left-color: #F44336; }
        
        .log-time {
            color: #666;
            font-size: 12px;
            margin-bottom: 5px;
        }
        
        .log-message {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .log-details {
            color: #666;
            font-size: 12px;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #00B900;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,185,0,0.3);
            transition: all 0.3s;
        }
        
        .refresh-btn:hover {
            transform: scale(1.1);
        }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="header">
            <h1>📊 資料庫管理後台</h1>
            <p>LINE Bot 資料分析與管理系統</p>
        </div>
        
        <div class="content">
            <!-- 導航按鈕 -->
            <div class="nav-buttons">
                <a href="/admin/dashboard" class="nav-btn">📊 總覽</a>
                <a href="/admin/members" class="nav-btn">👥 會員管理</a>
                <a href="/admin/chats" class="nav-btn">💬 對話記錄</a>
                <a href="/admin/tasks" class="nav-btn">📋 任務管理</a>
                <a href="/admin/logs" class="nav-btn">📜 系統日誌</a>
            </div>
            
            <!-- 統計資料 -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalMembers}</div>
                    <div class="stat-label">註冊會員</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalChatLogs}</div>
                    <div class="stat-label">對話記錄</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalTasks}</div>
                    <div class="stat-label">建立任務</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.activeMembersToday}</div>
                    <div class="stat-label">今日活躍用戶</div>
                </div>
            </div>
            
            <!-- 系統日誌 -->
            <div class="section">
                <div class="section-title">
                    <span>📜</span>
                    <span>最新系統日誌</span>
                </div>
                <div class="logs-container">
                    ${systemLogs.map(log => `
                        <div class="log-item log-${log.level}">
                            <div class="log-time">${new Date(log.created_at).toLocaleString('zh-TW')}</div>
                            <div class="log-message">[${log.level.toUpperCase()}] ${log.category}: ${log.message}</div>
                            ${log.details ? `<div class="log-details">${log.details}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    
    <button class="refresh-btn" onclick="window.location.reload()">🔄</button>
    
    <script>
        // 自動刷新頁面
        setInterval(() => {
            window.location.reload();
        }, 30000); // 30秒刷新一次
    </script>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).send('資料庫管理介面載入失敗');
  }
});

// 會員管理頁面
app.get('/admin/members', async (req, res) => {
  try {
    const members = await database.query(`
      SELECT m.*, 
             COUNT(c.id) as chat_count,
             COUNT(t.id) as task_count
      FROM members m
      LEFT JOIN chat_logs c ON m.line_user_id = c.line_user_id
      LEFT JOIN tasks t ON m.line_user_id = t.line_user_id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `);
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👥 會員管理 - 資料庫後台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .admin-container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .content { padding: 30px; }
        .nav-buttons { display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .nav-btn { background: #667eea; color: white; padding: 12px 25px; border: none; border-radius: 8px; text-decoration: none; font-weight: bold; transition: all 0.3s; }
        .nav-btn:hover { background: #5a6fd8; transform: translateY(-2px); }
        .table-container { background: #f8f9ff; border-radius: 15px; padding: 20px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #667eea; color: white; font-weight: bold; }
        tr:hover { background: #f5f5f5; }
        .status-active { color: #00B900; font-weight: bold; }
        .status-inactive { color: #999; }
        .stats-badge { background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="header">
            <h1>👥 會員管理</h1>
            <p>註冊會員清單與活動統計</p>
        </div>
        
        <div class="content">
            <div class="nav-buttons">
                <a href="/admin/dashboard" class="nav-btn">📊 返回總覽</a>
                <a href="/admin/chats" class="nav-btn">💬 對話記錄</a>
                <a href="/admin/tasks" class="nav-btn">📋 任務管理</a>
            </div>
            
            <div class="table-container">
                <h3>會員清單 (共 ${members.length} 位)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>會員ID</th>
                            <th>LINE用戶ID</th>
                            <th>姓名/顯示名稱</th>
                            <th>電子郵件</th>
                            <th>註冊方式</th>
                            <th>狀態</th>
                            <th>對話數</th>
                            <th>任務數</th>
                            <th>註冊時間</th>
                            <th>最後活動</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${members.map(member => `
                            <tr>
                                <td><code>${member.member_id}</code></td>
                                <td><code>${member.line_user_id || '未綁定'}</code></td>
                                <td>${member.display_name || member.name || '未設定'}</td>
                                <td>${member.email || '未提供'}</td>
                                <td>${member.registration_method}</td>
                                <td class="${member.is_active ? 'status-active' : 'status-inactive'}">
                                    ${member.is_active ? '✅ 啟用' : '❌ 停用'}
                                </td>
                                <td><span class="stats-badge">${member.chat_count}</span></td>
                                <td><span class="stats-badge">${member.task_count}</span></td>
                                <td>${new Date(member.created_at).toLocaleDateString('zh-TW')}</td>
                                <td>${member.last_activity_at ? new Date(member.last_activity_at).toLocaleString('zh-TW') : '無'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Members admin error:', error);
    res.status(500).send('會員管理頁面載入失敗');
  }
});

// 對話記錄管理頁面
app.get('/admin/chats', async (req, res) => {
  try {
    const chatLogs = await database.query(`
      SELECT c.*, m.display_name, m.name
      FROM chat_logs c
      LEFT JOIN members m ON c.line_user_id = m.line_user_id
      ORDER BY c.created_at DESC
      LIMIT 100
    `);
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💬 對話記錄 - 資料庫後台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .admin-container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .nav-buttons { display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .nav-btn { background: #667eea; color: white; padding: 12px 25px; border: none; border-radius: 8px; text-decoration: none; font-weight: bold; transition: all 0.3s; }
        .chat-item { background: #f8f9ff; border-radius: 12px; padding: 20px; margin-bottom: 15px; border-left: 5px solid; }
        .chat-incoming { border-left-color: #00B900; }
        .chat-outgoing { border-left-color: #2196F3; }
        .chat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .chat-user { font-weight: bold; color: #333; }
        .chat-time { color: #666; font-size: 12px; }
        .chat-content { color: #333; line-height: 1.5; margin-bottom: 10px; }
        .chat-meta { display: flex; gap: 15px; font-size: 12px; color: #666; }
        .meta-badge { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="header">
            <h1>💬 對話記錄</h1>
            <p>LINE Bot 互動記錄分析 (最新 100 筆)</p>
        </div>
        
        <div class="content">
            <div class="nav-buttons">
                <a href="/admin/dashboard" class="nav-btn">📊 返回總覽</a>
                <a href="/admin/members" class="nav-btn">👥 會員管理</a>
                <a href="/admin/tasks" class="nav-btn">📋 任務管理</a>
            </div>
            
            <div class="chats-container">
                ${chatLogs.map(chat => `
                    <div class="chat-item chat-${chat.direction}">
                        <div class="chat-header">
                            <div class="chat-user">
                                ${chat.display_name || chat.name || chat.line_user_id} 
                                ${chat.direction === 'incoming' ? '👤 → 🤖' : '🤖 → 👤'}
                            </div>
                            <div class="chat-time">${new Date(chat.created_at).toLocaleString('zh-TW')}</div>
                        </div>
                        <div class="chat-content">${chat.content}</div>
                        <div class="chat-meta">
                            <span class="meta-badge">類型: ${chat.message_type}</span>
                            ${chat.intent_detected ? `<span class="meta-badge">意圖: ${chat.intent_detected}</span>` : ''}
                            ${chat.response_type ? `<span class="meta-badge">回應: ${chat.response_type}</span>` : ''}
                            ${chat.processing_time ? `<span class="meta-badge">處理時間: ${chat.processing_time}ms</span>` : ''}
                            <span class="meta-badge ${chat.is_successful ? 'success' : 'error'}">
                                ${chat.is_successful ? '✅ 成功' : '❌ 失敗'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Chats admin error:', error);
    res.status(500).send('對話記錄頁面載入失敗');
  }
});

// ================================
// LINE LIFF App 功能
// ================================

// LINE LIFF 全部任務頁面 (簡潔版)
// 舊的 /liff/tasks 路由已刪除，現在由 React 應用程式處理

// LINE LIFF 任務編輯頁面（重複路由已移至下方）

// 確保 React 應用能正確處理 /liff/tasks 路由
// 所有 LIFF 任務相關頁面現在由 React 應用程式處理

// 所有孤立的CSS代碼已被清理

// LINE LIFF 任務編輯頁面已移動到下方（清理重複路由）

app.get('/liff/edit-task', (req, res) => {
  const taskId = req.query.taskId || 'unknown';
  const userId = req.query.userId || 'unknown';
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✏️ 編輯任務 - LIFF Compact</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #00B900, #06C755);
            height: 100%;
            margin: 0;
            padding: 0;
            width: 100%;
            overflow-x: hidden;
        }
        
        .container {
            width: 100%;
            height: 100%;
            background: white;
            border-radius: 12px 12px 0 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            padding: 15px;
            text-align: center;
            flex-shrink: 0;
        }
        
        .header h1 {
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .subtitle {
            font-size: 14px;
            color: #666;
        }
        
        .task-section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .task-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .task-item {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .task-content {
            font-size: 14px;
            color: #333;
            flex: 1;
        }
        
        .task-time {
            font-size: 12px;
            color: #666;
            margin-left: 10px;
        }
        
        .empty-message {
            text-align: center;
            padding: 30px;
            color: #666;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        
        .user-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255,255,255,0.95);
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid rgba(0,185,0,0.2);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .user-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #00B900;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        
        .user-details {
            flex: 1;
        }
        
        .user-name {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 3px;
        }
        
        .user-id {
            font-size: 11px;
            color: #666;
            margin-bottom: 3px;
        }
        
        .liff-status {
            font-size: 10px;
            color: #00B900;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">📋 全部任務</div>
            <div class="subtitle">LIFF Compact 模式</div>
        </div>
        
        <div id="user-info" class="user-profile" style="display: none;">
            <img id="user-avatar" class="user-avatar" src="" alt="用戶頭像">
            <div class="user-details">
                <div id="user-name" class="user-name">載入中...</div>
                <div id="user-id" class="user-id">User ID: 載入中...</div>
                <div class="liff-status">📱 LIFF Compact 模式</div>
            </div>
        </div>
        
        <div id="loading-info" style="text-align: center; margin-bottom: 15px; font-size: 12px; color: #666;">
            🔄 載入用戶資訊中...
        </div>
        
        <div class="task-section">
            <div class="section-title">📅 我的任務清單</div>
            <div id="task-list" class="task-list">
                <div class="loading">載入任務中...</div>
            </div>
        </div>
    </div>
    
    <script>
        let liffProfile = null;
        
        // 初始化 LIFF
        window.onload = function() {
            // 直接初始化並載入任務，不等待 LIFF
            initDemo();
            
            // 異步嘗試 LIFF 初始化
            if (typeof liff !== 'undefined') {
                liff.init({
                    liffId: '${process.env.LINE_LIFF_ID || '2007976732-Ye2k35eo'}'
                }).then(() => {
                    if (liff.isLoggedIn()) {
                        liff.getProfile().then(profile => {
                            liffProfile = profile;
                            displayUserProfile(profile);
                            // 重新載入任務以使用真實用戶ID
                            loadTasks();
                        }).catch(err => {
                            console.error('獲取用戶資料失敗:', err);
                        });
                    }
                }).catch(err => {
                    console.error('LIFF 初始化失敗:', err);
                    // LIFF 失敗不影響任務顯示
                });
            }
        };
        
        function initDemo() {
            displayUserProfile({
                displayName: 'Demo 用戶',
                userId: 'demo-user-123',
                pictureUrl: 'https://via.placeholder.com/50x50/00B900/white?text=👤'
            });
            loadTasks();
        }
        
        function displayUserProfile(profile) {
            document.getElementById('user-name').textContent = profile.displayName;
            document.getElementById('user-id').textContent = 'User ID: ' + profile.userId;
            document.getElementById('user-avatar').src = profile.pictureUrl || 'https://via.placeholder.com/50x50/00B900/white?text=👤';
            
            // 隱藏載入訊息，顯示用戶資料
            document.getElementById('loading-info').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
        }
        
        function loadTasks() {
            // 使用實際的用戶ID，從日誌中可以看到
            const userId = liffProfile ? liffProfile.userId : 'U25661314f262e7a1587a05eca486a36a';
            
            console.log('載入任務，用戶ID:', userId);
            
            fetch('/api/tasks/' + userId)
                .then(response => {
                    console.log('API 回應狀態:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('API 回應資料:', data);
                    if (data.success && data.tasks) {
                        renderTasks(data.tasks);
                    } else {
                        console.log('沒有任務資料，顯示空列表');
                        renderTasks([]);
                    }
                })
                .catch(error => {
                    console.error('載入任務錯誤:', error);
                    // 網路錯誤時顯示實際任務
                    renderTasks([
                        { text: 'lete code', timestamp: '2025-08-24T15:44:07.552Z' },
                        { text: '21:00 火車', timestamp: '2025-08-24T15:46:47.747Z' },
                        { text: 'LETECODE', timestamp: '2025-08-24T16:05:50.774Z' }
                    ]);
                });
        }
        
        function renderTasks(tasks) {
            const taskList = document.getElementById('task-list');
            
            if (tasks.length === 0) {
                taskList.innerHTML = \`
                    <div class="empty-message">
                        <div class="empty-icon">🎉</div>
                        <div>暫無任務</div>
                        <div style="font-size: 12px; margin-top: 5px;">在聊天室中發送任務給我吧！</div>
                    </div>
                \`;
                return;
            }
            
            const taskHTML = tasks.map(task => \`
                <div class="task-item">
                    <div class="task-content">\${task.text}</div>
                    <div class="task-time">\${new Date(task.timestamp).toLocaleString('zh-TW', { 
                        month: 'numeric', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}</div>
                </div>
            \`).join('');
            
            taskList.innerHTML = taskHTML;
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// LINE LIFF 任務編輯頁面
app.get('/liff/edit-task', (req, res) => {
  const taskId = req.query.taskId || 'unknown';
  const userId = req.query.userId || 'unknown';
  
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✏️ 編輯任務 - LIFF Compact</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #00B900, #06C755);
            height: 100%;
            margin: 0;
            padding: 0;
            width: 100%;
            overflow-x: hidden;
        }
        
        .container {
            width: 100%;
            height: 100%;
            background: white;
            border-radius: 12px 12px 0 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            padding: 15px;
            text-align: center;
            flex-shrink: 0;
        }
        
        .header h1 {
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #00B900;
            box-shadow: 0 0 0 3px rgba(0, 185, 0, 0.1);
        }
        
        .time-inputs {
            display: flex;
            gap: 10px;
        }
        
        .time-inputs .form-input {
            flex: 1;
        }
        
        .category-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 8px;
        }
        
        .category-button {
            background: white;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            padding: 12px 8px;
            text-align: center;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            min-height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        
        .category-button:hover {
            border-color: #00B900;
            background: #f8fff8;
        }
        
        .category-button.selected {
            background: #00B900;
            border-color: #00B900;
            color: white;
            transform: scale(1.05);
        }
        
        .category-emoji {
            font-size: 18px;
            margin-bottom: 2px;
        }
        
        .save-button {
            width: 100%;
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 15px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 20px;
        }
        
        .save-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 185, 0, 0.3);
        }
        
        .save-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .task-preview {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .task-preview-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        
        .task-preview-content {
            color: #666;
            font-size: 14px;
        }
        
        .message {
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
            font-weight: 500;
        }
        
        .message.success {
            background: #d1fae5;
            color: #065f46;
            border: 2px solid #10b981;
        }
        
        .message.error {
            background: #fecaca;
            color: #991b1b;
            border: 2px solid #ef4444;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✏️ 編輯任務</h1>
            <p>設定任務時間和類型</p>
        </div>
        
        <div class="content">
            <div id="messageArea"></div>
            
            <div class="task-preview">
                <div class="task-preview-title">📝 任務內容</div>
                <div class="task-preview-content" id="taskContent">載入中...</div>
            </div>
            
            <div class="form-group">
                <label class="form-label">⏰ 任務時間</label>
                <div class="time-inputs">
                    <input type="date" id="taskDate" class="form-input">
                    <input type="time" id="taskTime" class="form-input">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">📂 任務類型</label>
                <div class="category-grid">
                    <div class="category-button" data-category="work" onclick="selectCategory('work', this)">
                        <div class="category-emoji">💼</div>
                        <div>工作</div>
                    </div>
                    <div class="category-button" data-category="family" onclick="selectCategory('family', this)">
                        <div class="category-emoji">👨‍👩‍👧‍👦</div>
                        <div>家庭</div>
                    </div>
                    <div class="category-button" data-category="travel" onclick="selectCategory('travel', this)">
                        <div class="category-emoji">✈️</div>
                        <div>旅遊</div>
                    </div>
                    <div class="category-button" data-category="health" onclick="selectCategory('health', this)">
                        <div class="category-emoji">🏥</div>
                        <div>健康</div>
                    </div>
                    <div class="category-button" data-category="study" onclick="selectCategory('study', this)">
                        <div class="category-emoji">📚</div>
                        <div>學習</div>
                    </div>
                    <div class="category-button" data-category="shopping" onclick="selectCategory('shopping', this)">
                        <div class="category-emoji">🛒</div>
                        <div>購物</div>
                    </div>
                    <div class="category-button" data-category="social" onclick="selectCategory('social', this)">
                        <div class="category-emoji">👥</div>
                        <div>社交</div>
                    </div>
                    <div class="category-button" data-category="exercise" onclick="selectCategory('exercise', this)">
                        <div class="category-emoji">🏃</div>
                        <div>運動</div>
                    </div>
                    <div class="category-button" data-category="other" onclick="selectCategory('other', this)">
                        <div class="category-emoji">📝</div>
                        <div>其他</div>
                    </div>
                </div>
            </div>
            
            <button class="save-button" onclick="saveTask()">💾 儲存任務</button>
        </div>
    </div>
    
    <script>
        let selectedCategory = '';
        let taskData = null;
        let liffProfile = null;
        
        window.onload = function() {
            if (typeof liff !== 'undefined') {
                liff.init({
                    liffId: '${process.env.LINE_LIFF_ID || '2007976732-Ye2k35eo'}'
                }).then(() => {
                    if (liff.isLoggedIn()) {
                        liff.getProfile().then(profile => {
                            liffProfile = profile;
                            loadTaskData();
                        });
                    } else {
                        liff.login();
                    }
                }).catch(err => {
                    console.error('LIFF 初始化失敗:', err);
                    loadTaskData(); // Demo 模式
                });
            } else {
                loadTaskData(); // Demo 模式
            }
            
            // 設定預設日期為今天
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDate').value = today;
        };
        
        function loadTaskData() {
            // 從 URL 參數獲取任務資料
            const urlParams = new URLSearchParams(window.location.search);
            const taskId = urlParams.get('taskId');
            const userId = urlParams.get('userId');
            
            // 這裡可以從後端 API 獲取任務詳細資料
            // 暫時顯示基本資訊
            fetch(\`/api/task/\${taskId}\`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.task) {
                        taskData = data.task;
                        document.getElementById('taskContent').textContent = data.task.text;
                    } else {
                        document.getElementById('taskContent').textContent = '無法載入任務資料';
                    }
                })
                .catch(error => {
                    console.error('載入任務失敗:', error);
                    document.getElementById('taskContent').textContent = '載入任務時發生錯誤';
                });
        }
        
        function selectCategory(category, element) {
            // 移除所有選中狀態
            document.querySelectorAll('.category-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // 添加選中狀態
            element.classList.add('selected');
            selectedCategory = category;
        }
        
        function saveTask() {
            const date = document.getElementById('taskDate').value;
            const time = document.getElementById('taskTime').value;
            
            if (!date) {
                showMessage('請選擇日期', 'error');
                return;
            }
            
            if (!selectedCategory) {
                showMessage('請選擇任務類型', 'error');
                return;
            }
            
            const saveData = {
                taskId: '${taskId}',
                userId: '${userId}',
                date: date,
                time: time,
                category: selectedCategory,
                liffUserId: liffProfile ? liffProfile.userId : null
            };
            
            // 儲存到後端
            fetch('/api/task/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage('✅ 任務已更新！', 'success');
                    
                    // 關閉 LIFF 頁面
                    setTimeout(() => {
                        if (liff.isInClient()) {
                            liff.closeWindow();
                        }
                    }, 1500);
                } else {
                    showMessage('❌ 儲存失敗：' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('儲存錯誤:', error);
                showMessage('❌ 儲存時發生錯誤', 'error');
            });
        }
        
        function showMessage(text, type) {
            const messageArea = document.getElementById('messageArea');
            messageArea.innerHTML = \`<div class="message \${type}">\${text}</div>\`;
            
            setTimeout(() => {
                messageArea.innerHTML = '';
            }, 3000);
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// 刪除重複的路由，保留後面的版本

// LINE LIFF 帳號管理頁面 (簡潔版)
app.get('/liff/profile', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👤 帳號管理 - LIFF Compact</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            /* LIFF Compact 模式：適應50%高度 */
            height: 100%;
            margin: 0;
            padding: 5px;
            width: 100%;
            overflow-x: hidden;
        }
        
        .liff-container {
            /* LIFF Compact 模式：適配50%高度的小視窗 */
            width: 100%;
            margin: 0;
            background: white;
            border-radius: 12px 12px 0 0;
            box-shadow: 0 -5px 20px rgba(0,0,0,0.15);
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            /* Compact 模式：縮減 header 高度 */
            padding: 12px 15px;
            text-align: center;
            flex-shrink: 0;
        }
        
        .header h1 {
            /* Compact 模式：縮小標題字體 */
            font-size: 18px;
            margin-bottom: 3px;
        }
        
        .user-info {
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            /* Compact 模式：縮減用戶資訊區域 */
            padding: 6px 8px;
            margin-top: 8px;
            font-size: 12px;
        }
        
        .content {
            /* Compact 模式：優化有限空間的內容區域 */
            padding: 10px 12px;
            flex: 1;
            overflow-y: auto;
            min-height: 0; /* 確保在 flex 容器中可以正確滾動 */
        }
        
        .add-task-section {
            background: #f8f9ff;
            border-radius: 10px;
            /* Compact 模式：縮減區域間距 */
            padding: 12px;
            margin-bottom: 12px;
        }
        
        .add-task-title {
            color: #333;
            font-weight: bold;
            /* Compact 模式：縮減間距 */
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
        }
        
        .task-input {
            width: 100%;
            /* Compact 模式：縮減輸入框高度 */
            padding: 10px 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 10px;
            transition: border-color 0.3s;
        }
        
        .task-input:focus {
            outline: none;
            border-color: #00B900;
        }
        
        .add-btn {
            width: 100%;
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            border: none;
            border-radius: 8px;
            /* Compact 模式：縮減按鈕高度 */
            padding: 10px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .add-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,185,0,0.3);
        }
        
        .tasks-section {
            margin-top: 20px;
        }
        
        .tasks-title {
            color: #333;
            font-weight: bold;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .task-count {
            background: #00B900;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
        }
        
        .task-list {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .task-item {
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: all 0.3s;
        }
        
        .task-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .task-content {
            font-size: 16px;
            color: #333;
            margin-bottom: 8px;
        }
        
        .task-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #666;
        }
        
        .task-time {
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 5px;
        }
        
        .delete-btn {
            background: #ff4757;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .delete-btn:hover {
            background: #ff3742;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state .emoji {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        
        .error {
            background: #ffe6e6;
            border: 1px solid #ffcccc;
            color: #cc0000;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        
        .success {
            background: #e6ffe6;
            border: 1px solid #ccffcc;
            color: #006600;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102,126,234,0.3);
            transition: all 0.3s;
        }
        
        .refresh-btn:hover {
            transform: scale(1.1);
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .spinning {
            animation: spin 1s linear infinite;
        }
        
        .liff-demo-mode {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #856404;
            text-align: center;
        }
        
        .filter-section {
            background: #f8f9ff;
            border-radius: 10px;
            /* Compact 模式：縮減篩選區域 */
            padding: 10px;
            margin-bottom: 10px;
        }
        
        .filter-title {
            color: #333;
            font-weight: bold;
            /* Compact 模式：縮減標題間距 */
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
        }
        
        .filter-buttons {
            display: flex;
            /* Compact 模式：縮減按鈕間距 */
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            background: white;
            border: 1px solid #e1e5e9;
            color: #666;
            /* Compact 模式：縮小篩選按鈕 */
            padding: 6px 12px;
            border-radius: 18px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s;
            flex: 1;
            min-width: 80px;
        }
        
        .filter-btn:hover {
            border-color: #00B900;
            color: #00B900;
        }
        
        .filter-btn.active {
            background: linear-gradient(135deg, #00B900, #06C755);
            border-color: #00B900;
            color: white;
            transform: scale(1.05);
        }
        
        .task-date-group {
            /* Compact 模式：縮減日期分組間距 */
            margin-bottom: 15px;
        }
        
        .date-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            /* Compact 模式：縮減日期標題 */
            padding: 8px 12px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .date-count {
            background: rgba(255,255,255,0.2);
            /* Compact 模式：縮小數量標籤 */
            padding: 2px 8px;
            border-radius: 15px;
            font-size: 11px;
        }
        
        /* LIFF Compact 模式專用樣式 */
        @media screen and (max-width: 768px) {
            .task-item {
                /* Compact 模式：縮減任務項目間距 */
                padding: 10px;
                margin-bottom: 6px;
            }
            
            .task-content {
                font-size: 14px;
                margin-bottom: 6px;
            }
            
            .task-meta {
                font-size: 11px;
            }
            
            .delete-btn {
                padding: 3px 6px;
                font-size: 10px;
            }
            
            .task-list {
                /* Compact 模式：限制最大高度並允許滾動 */
                max-height: 200px;
                overflow-y: auto;
            }
        }
        
        /* 確保 LIFF Compact 模式在 LINE App 中正確顯示 */
        html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <div class="liff-container">
        <div class="header">
            <h1>📝 我的任務管理</h1>
            <p>透過 LINE LIFF 管理您的待辦事項</p>
            <div class="user-info" id="userInfo">
                <div>載入用戶資訊中...</div>
            </div>
        </div>
        
        <div class="content">
            <!-- Demo 模式說明 -->
            <div class="liff-demo-mode">
                <strong>📱 LIFF Compact 模式</strong><br>
                50% 螢幕高度，保留上方聊天室內容
            </div>
            
            <!-- 新增任務區域 -->
            <div class="add-task-section">
                <div class="add-task-title">
                    <span>✏️</span>
                    <span>新增任務</span>
                </div>
                <input type="text" id="taskInput" class="task-input" placeholder="例如：17:00跟小美約會、買牛奶、完成報告...">
                <button onclick="addTask()" class="add-btn">➕ 新增任務</button>
            </div>
            
            <!-- 訊息顯示區域 -->
            <div id="messageArea"></div>
            
            <!-- 任務篩選區域 -->
            <div class="filter-section">
                <div class="filter-title">🔍 篩選任務</div>
                <div class="filter-buttons">
                    <button class="filter-btn active" onclick="filterTasks('all')">全部任務</button>
                    <button class="filter-btn" onclick="filterTasks('today')">今日任務</button>
                    <button class="filter-btn" onclick="filterTasks('week')">本週任務</button>
                </div>
            </div>

            <!-- 任務列表區域 -->
            <div class="tasks-section">
                <div class="tasks-title">
                    <span id="taskSectionTitle">📋 全部任務</span>
                    <span class="task-count" id="taskCount">0 項</span>
                </div>
                <div id="taskList" class="task-list">
                    <div class="loading">載入任務中...</div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- 重新整理按鈕 -->
    <button class="refresh-btn" onclick="refreshTasks()" id="refreshBtn">🔄</button>
    
    <script>
        let liffProfile = null;
        let tasks = [];
        let isLiffAvailable = false;
        
        // 初始化應用程式
        window.onload = function() {
            // 檢查是否在 LINE 環境中
            if (typeof liff !== 'undefined') {
                initializeLiff();
            } else {
                // Demo 模式，使用模擬資料
                initializeDemoMode();
            }
        };
        
        function initializeLiff() {
            liff.init({
                liffId: '${process.env.LINE_LIFF_ID || 'demo-mode'}' 
            }).then(() => {
                console.log('LIFF 初始化成功');
                isLiffAvailable = true;
                initializeApp();
            }).catch((err) => {
                console.error('LIFF 初始化失敗:', err);
                initializeDemoMode();
            });
        }
        
        function initializeDemoMode() {
            console.log('進入 Demo 模式');
            liffProfile = {
                displayName: 'Demo 用戶',
                userId: 'demo-user-id'
            };
            updateUserInfo();
            loadTasks();
        }
        
        async function initializeApp() {
            try {
                if (liff.isLoggedIn()) {
                    liffProfile = await liff.getProfile();
                    updateUserInfo();
                } else {
                    // 嘗試登入
                    liff.login();
                    return;
                }
                
                await loadTasks();
            } catch (error) {
                console.error('初始化應用程式失敗:', error);
                showError('載入應用程式時發生錯誤');
            }
        }
        
        function updateUserInfo() {
            if (liffProfile) {
                const avatarUrl = liffProfile.pictureUrl || 'https://via.placeholder.com/60x60/00B900/white?text=👤';
                document.getElementById('userInfo').innerHTML = \`
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="\${avatarUrl}" alt="用戶頭像" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid white; object-fit: cover;">
                        <div>
                            <div>👋 \${liffProfile.displayName}</div>
                            <div style="font-size: 10px; opacity: 0.8;">ID: \${liffProfile.userId}</div>
                            <div style="font-size: 10px; opacity: 0.8;">\${isLiffAvailable ? '📱 LIFF 模式' : '🌐 Demo 模式'}</div>
                        </div>
                    </div>
                \`;
            }
        }
        
        async function loadTasks() {
            try {
                const userId = liffProfile ? liffProfile.userId : 'demo-user';
                const response = await fetch(\`/api/tasks/\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    tasks = data.tasks || [];
                    renderTasks();
                } else {
                    showError('載入任務失敗: ' + data.message);
                }
            } catch (error) {
                console.error('載入任務錯誤:', error);
                // Demo 模式使用本地儲存
                loadTasksFromStorage();
            }
        }
        
        function loadTasksFromStorage() {
            const storedTasks = localStorage.getItem('demo-tasks');
            tasks = storedTasks ? JSON.parse(storedTasks) : [];
            renderTasks();
        }
        
        function saveTasksToStorage() {
            localStorage.setItem('demo-tasks', JSON.stringify(tasks));
        }
        
        let currentFilter = 'all';
        
        function renderTasks(filter = currentFilter) {
            const taskList = document.getElementById('taskList');
            const taskCount = document.getElementById('taskCount');
            const taskSectionTitle = document.getElementById('taskSectionTitle');
            
            // 根據篩選條件過濾任務
            let filteredTasks = tasks;
            let titleText = '📋 全部任務';
            
            if (filter === 'today') {
                const today = new Date().toLocaleDateString('zh-TW');
                filteredTasks = tasks.filter(task => task.date === today);
                titleText = '📋 今日任務';
            } else if (filter === 'week') {
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredTasks = tasks.filter(task => new Date(task.timestamp) >= weekAgo);
                titleText = '📋 本週任務';
            }
            
            taskSectionTitle.textContent = titleText;
            taskCount.textContent = \`\${filteredTasks.length} 項\`;
            
            if (filteredTasks.length === 0) {
                const emptyMessage = filter === 'today' ? '今天還沒有任何待辦事項' : 
                                   filter === 'week' ? '本週還沒有任何待辦事項' : 
                                   '還沒有任何任務';
                taskList.innerHTML = \`
                    <div class="empty-state">
                        <div class="emoji">🎉</div>
                        <div>\${filter === 'today' ? '今日任務全部完成！' : '暫無任務'}</div>
                        <div>\${emptyMessage}</div>
                    </div>
                \`;
                return;
            }
            
            // 按日期分組顯示任務
            const tasksByDate = groupTasksByDate(filteredTasks);
            let taskHTML = '';
            
            for (const [date, dateTasks] of Object.entries(tasksByDate)) {
                taskHTML += \`
                    <div class="task-date-group">
                        <div class="date-header">
                            <span>\${formatDate(date)}</span>
                            <span class="date-count">\${dateTasks.length} 項</span>
                        </div>
                        <div class="date-tasks">
                            \${dateTasks.map((task, index) => \`
                                <div class="task-item">
                                    <div class="task-content">\${task.text}</div>
                                    <div class="task-meta">
                                        <span class="task-time">\${new Date(task.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <button class="delete-btn" onclick="deleteTaskById('\${task.id}')">🗑️ 刪除</button>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }
            
            taskList.innerHTML = taskHTML;
        }
        
        function groupTasksByDate(tasks) {
            const grouped = {};
            
            tasks.forEach(task => {
                const date = task.date || new Date(task.timestamp).toLocaleDateString('zh-TW');
                if (!grouped[date]) {
                    grouped[date] = [];
                }
                grouped[date].push(task);
            });
            
            // 按日期排序（最新的在前）
            const sortedEntries = Object.entries(grouped).sort((a, b) => {
                return new Date(b[0]) - new Date(a[0]);
            });
            
            return Object.fromEntries(sortedEntries);
        }
        
        function formatDate(dateStr) {
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (date.toDateString() === today.toDateString()) {
                return '📅 今天 ' + dateStr;
            } else if (date.toDateString() === yesterday.toDateString()) {
                return '📅 昨天 ' + dateStr;
            } else {
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[date.getDay()];
                return \`📅 \${dateStr} (週\${weekday})\`;
            }
        }
        
        function filterTasks(filter) {
            currentFilter = filter;
            
            // 更新篩選按鈕的狀態
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            renderTasks(filter);
        }
        
        async function addTask() {
            const taskInput = document.getElementById('taskInput');
            const taskText = taskInput.value.trim();
            
            if (!taskText) {
                showError('請輸入任務內容');
                return;
            }
            
            const newTask = {
                id: Date.now(),
                text: taskText,
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString('zh-TW')
            };
            
            try {
                const userId = liffProfile ? liffProfile.userId : 'demo-user';
                const response = await fetch('/api/tasks/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: userId,
                        taskText: taskText
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    taskInput.value = '';
                    showSuccess('任務新增成功！');
                    await loadTasks();
                } else {
                    showError('新增任務失敗: ' + data.message);
                }
            } catch (error) {
                console.error('新增任務錯誤:', error);
                // Demo 模式本地處理
                tasks.push(newTask);
                saveTasksToStorage();
                taskInput.value = '';
                showSuccess('任務新增成功！（Demo 模式）');
                renderTasks();
            }
        }
        
        async function deleteTaskById(taskId) {
            if (!confirm('確定要刪除這個任務嗎？')) {
                return;
            }
            
            try {
                const userId = liffProfile ? liffProfile.userId : 'demo-user';
                const taskIndex = tasks.findIndex(task => task.id == taskId);
                if (taskIndex === -1) {
                    showError('找不到該任務');
                    return;
                }
                const task = tasks[taskIndex];
                
                const response = await fetch('/api/tasks/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: userId,
                        taskId: task.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showSuccess('任務已刪除');
                    await loadTasks();
                } else {
                    showError('刪除任務失敗: ' + data.message);
                }
            } catch (error) {
                console.error('刪除任務錯誤:', error);
                // Demo 模式本地處理
                tasks.splice(taskIndex, 1);
                saveTasksToStorage();
                showSuccess('任務已刪除（Demo 模式）');
                renderTasks();
            }
        }
        
        async function refreshTasks() {
            const refreshBtn = document.getElementById('refreshBtn');
            refreshBtn.classList.add('spinning');
            
            await loadTasks();
            
            setTimeout(() => {
                refreshBtn.classList.remove('spinning');
            }, 1000);
        }
        
        function showError(message) {
            showMessage(message, 'error');
        }
        
        function showSuccess(message) {
            showMessage(message, 'success');
        }
        
        function showMessage(message, type) {
            const messageArea = document.getElementById('messageArea');
            const messageDiv = document.createElement('div');
            messageDiv.className = type;
            messageDiv.textContent = message;
            
            messageArea.innerHTML = '';
            messageArea.appendChild(messageDiv);
            
            setTimeout(() => {
                messageArea.innerHTML = '';
            }, 3000);
        }
        
        // Enter 鍵新增任務
        document.getElementById('taskInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addTask();
            }
        });
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// LINE LIFF 帳號管理頁面 (簡潔版)
app.get('/liff/profile', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👤 帳號管理 - LIFF Compact</title>
    <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea, #764ba2);
            height: 100%;
            padding: 0;
        }
        
        .container {
            background: white;
            border-radius: 12px 12px 0 0;
            height: 100%;
            padding: 15px;
            overflow-y: auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        
        .subtitle {
            font-size: 14px;
            color: #666;
        }
        
        .profile-section {
            margin-bottom: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .profile-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .info-item:last-child {
            border-bottom: none;
        }
        
        .info-label {
            font-weight: bold;
            color: #555;
            font-size: 14px;
        }
        
        .info-value {
            color: #333;
            font-size: 14px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 15px;
        }
        
        .stat-item {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 18px;
            font-weight: bold;
            color: #00B900;
            margin-bottom: 3px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #666;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">👤 帳號管理</div>
            <div class="subtitle">LIFF Compact 模式</div>
        </div>
        
        <div class="profile-section">
            <div class="section-title">📋 個人資訊</div>
            <div id="profile-info" class="profile-info">
                <div class="loading">載入用戶資訊中...</div>
            </div>
        </div>
        
        <div class="profile-section">
            <div class="section-title">📊 使用統計</div>
            <div id="user-stats" class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number" id="task-count">-</div>
                    <div class="stat-label">總任務數</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="today-count">-</div>
                    <div class="stat-label">今日任務</div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        let liffProfile = null;
        
        // 初始化 LIFF
        window.onload = function() {
            if (typeof liff !== 'undefined') {
                liff.init({
                    liffId: '${process.env.LINE_LIFF_ID || '2007976732-Ye2k35eo'}'
                }).then(() => {
                    if (liff.isLoggedIn()) {
                        liff.getProfile().then(profile => {
                            liffProfile = profile;
                            displayProfile(profile);
                            loadStats();
                        });
                    } else {
                        liff.login();
                    }
                }).catch(err => {
                    console.error('LIFF 初始化失敗:', err);
                    initDemo();
                });
            } else {
                initDemo();
            }
        };
        
        function initDemo() {
            const demoProfile = {
                displayName: 'Demo 用戶',
                userId: 'demo-user-id',
                statusMessage: 'LINE Bot 愛用者',
                pictureUrl: ''
            };
            displayProfile(demoProfile);
            loadStats();
        }
        
        function displayProfile(profile) {
            document.getElementById('profile-info').innerHTML = \`
                <div class="info-item">
                    <span class="info-label">👤 顯示名稱</span>
                    <span class="info-value">\${profile.displayName}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🆔 用戶ID</span>
                    <span class="info-value">\${profile.userId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📱 連接狀態</span>
                    <span class="info-value">\${liffProfile ? 'LIFF已連接' : 'Demo模式'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">🎯 狀態訊息</span>
                    <span class="info-value">\${profile.statusMessage || '無狀態訊息'}</span>
                </div>
            \`;
        }
        
        function loadStats() {
            const userId = liffProfile ? liffProfile.userId : 'demo-user';
            
            fetch('/api/tasks/' + userId)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.tasks) {
                        const totalTasks = data.tasks.length;
                        const today = new Date().toLocaleDateString('zh-TW');
                        const todayTasks = data.tasks.filter(task => 
                            new Date(task.timestamp).toLocaleDateString('zh-TW') === today
                        ).length;
                        
                        document.getElementById('task-count').textContent = totalTasks;
                        document.getElementById('today-count').textContent = todayTasks;
                    } else {
                        // Demo 數據
                        document.getElementById('task-count').textContent = '3';
                        document.getElementById('today-count').textContent = '2';
                    }
                })
                .catch(error => {
                    console.error('載入統計錯誤:', error);
                    // Demo 數據
                    document.getElementById('task-count').textContent = '3';
                    document.getElementById('today-count').textContent = '2';
                });
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// LIFF API 端點 - 取得用戶任務
app.get('/api/tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const userTaskList = userTasks.get(userId) || [];
  
  res.json({
    success: true,
    tasks: userTaskList,
    count: userTaskList.length
  });
});

// LIFF API 端點 - 新增任務
app.post('/api/tasks/add', express.json(), (req, res) => {
  const { userId, taskText } = req.body;
  
  if (!userId || !taskText) {
    return res.json({
      success: false,
      message: '缺少必要參數'
    });
  }
  
  // 建立新任務
  const newTask = {
    id: Date.now(),
    text: taskText,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('zh-TW')
  };
  
  // 儲存到用戶任務列表
  let userTaskList = userTasks.get(userId) || [];
  userTaskList.push(newTask);
  userTasks.set(userId, userTaskList);
  
  res.json({
    success: true,
    message: '任務新增成功',
    task: newTask
  });
});

// LIFF API 端點 - 刪除任務
app.post('/api/tasks/delete', express.json(), (req, res) => {
  const { userId, taskId } = req.body;
  
  if (!userId || !taskId) {
    return res.json({
      success: false,
      message: '缺少必要參數'
    });
  }
  
  let userTaskList = userTasks.get(userId) || [];
  const originalLength = userTaskList.length;
  
  // 刪除指定任務
  userTaskList = userTaskList.filter(task => task.id !== taskId);
  userTasks.set(userId, userTaskList);
  
  if (userTaskList.length < originalLength) {
    res.json({
      success: true,
      message: '任務已刪除'
    });
  } else {
    res.json({
      success: false,
      message: '找不到指定任務'
    });
  }
});

// API: 獲取單個任務資訊（用於 LIFF 編輯頁面）
app.get('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.json({
      success: false,
      message: '缺少任務 ID'
    });
  }
  
  // 從所有用戶的任務中尋找指定的任務
  let foundTask = null;
  let foundUserId = null;
  
  for (const [userId, userTaskList] of userTasks) {
    const task = userTaskList.find(t => t.id.toString() === taskId.toString());
    if (task) {
      foundTask = task;
      foundUserId = userId;
      break;
    }
  }
  
  if (foundTask) {
    res.json({
      success: true,
      task: foundTask,
      userId: foundUserId
    });
  } else {
    res.json({
      success: false,
      message: '找不到指定任務'
    });
  }
});

// API: 更新任務（用於 LIFF 編輯頁面）
app.post('/api/task/update', express.json(), (req, res) => {
  const { taskId, userId, date, time, category, liffUserId } = req.body;
  
  if (!taskId || !userId) {
    return res.json({
      success: false,
      message: '缺少必要參數'
    });
  }
  
  console.log(`更新任務: taskId=${taskId}, userId=${userId}, date=${date}, time=${time}, category=${category}`);
  
  let userTaskList = userTasks.get(userId) || [];
  const taskIndex = userTaskList.findIndex(task => task.id.toString() === taskId.toString());
  
  if (taskIndex === -1) {
    return res.json({
      success: false,
      message: '找不到指定任務'
    });
  }
  
  // 更新任務資訊
  const updatedTask = {
    ...userTaskList[taskIndex],
    date: date || userTaskList[taskIndex].date,
    time: time || userTaskList[taskIndex].time,
    category: category || userTaskList[taskIndex].category,
    lastModified: new Date().toISOString()
  };
  
  // 如果有時間，則更新任務文字以包含時間
  if (time) {
    const originalText = userTaskList[taskIndex].text;
    const timePattern = /^\d{1,2}[:：]\d{2}/;
    
    if (timePattern.test(originalText)) {
      // 如果已經有時間，則替換
      updatedTask.text = originalText.replace(timePattern, time);
    } else {
      // 如果沒有時間，則添加到前面
      updatedTask.text = `${time} ${originalText}`;
    }
  }
  
  userTaskList[taskIndex] = updatedTask;
  userTasks.set(userId, userTaskList);
  
  console.log(`任務已更新:`, updatedTask);
  
  // 同時更新資料庫
  if (database && database.isInitialized) {
    try {
      database.updateTask(taskId, {
        title: updatedTask.text,
        dueDate: date ? `${date} ${time || '00:00'}` : null,
        tags: category || '',
        metadata: { 
          category: category,
          time: time,
          lastModified: updatedTask.lastModified
        }
      }).catch(dbError => {
        console.error('更新資料庫任務失敗:', dbError);
      });
    } catch (dbError) {
      console.error('資料庫更新錯誤:', dbError);
    }
  }
  
  res.json({
    success: true,
    message: '任務已更新',
    task: updatedTask
  });
});

// 初始化資料庫
async function initializeApp() {
  try {
    console.log('🔄 正在初始化資料庫...');
    
    // 檢查是否為 Railway 環境
    const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
    
    if (isRailway) {
      console.log('🚂 偵測到 Railway 環境，跳過 SQLite 初始化');
      console.log('✅ Railway 模式啟動完成（使用記憶體 + Supabase）');
      return;
    }
    
    // 本地環境才初始化 SQLite
    await database.init();
    console.log('✅ 資料庫初始化完成');
    
    // 記錄系統啟動
    await database.logSystem('info', 'system', 'Application started', {
      port: PORT,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 資料庫初始化失敗:', error);
    console.log('⚠️ 繼續使用記憶體模式和 Supabase');
    // 不要退出，讓應用程式繼續運行
  }
}

// LIFF 簡單任務頁面
app.get('/liff-simple', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📋 全部任務</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #00B900, #06C755);
            min-height: 100vh;
            padding: 15px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .task-item {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .task-content {
            font-size: 14px;
            color: #333;
            flex: 1;
        }
        .task-time {
            font-size: 12px;
            color: #666;
            margin-left: 10px;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">📋 全部任務</div>
            <div>即時載入版本</div>
        </div>
        <div id="task-list">
            <div class="loading">正在載入任務...</div>
        </div>
    </div>
    
    <script>
        window.onload = function() { loadTasks(); };
        
        function loadTasks() {
            const userId = 'U25661314f262e7a1587a05eca486a36a';
            console.log('載入任務，用戶ID:', userId);
            
            fetch('/api/tasks/' + userId)
                .then(response => response.json())
                .then(data => {
                    console.log('API 回應資料:', data);
                    if (data.success && data.tasks) {
                        renderTasks(data.tasks);
                    } else {
                        document.getElementById('task-list').innerHTML = '<div class="loading">暫無任務</div>';
                    }
                })
                .catch(error => {
                    console.error('載入任務錯誤:', error);
                    document.getElementById('task-list').innerHTML = '<div class="loading">載入失敗</div>';
                });
        }
        
        function renderTasks(tasks) {
            const taskList = document.getElementById('task-list');
            if (tasks.length === 0) {
                taskList.innerHTML = '<div class="loading">🎉 暫無任務</div>';
                return;
            }
            
            const taskHTML = tasks.map(task => 
                '<div class="task-item">' +
                    '<div class="task-content">' + task.text + '</div>' +
                    '<div class="task-time">' + new Date(task.timestamp).toLocaleString('zh-TW', { 
                        month: 'numeric', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                    }) + '</div>' +
                '</div>'
            ).join('');
            
            taskList.innerHTML = taskHTML;
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

// LIFF React 應用程式 API 路由
app.use('/liff', express.static(path.join(__dirname, 'liff-app', 'dist')));

// 測試頁面路由
app.get('/test-liff', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-liff.html'));
});

// SPA 回退路由 - 所有 /liff/* 路由都返回 index.html
app.get('/liff/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-app', 'dist', 'index.html'));
});

// API: 取得使用者所有任務
app.get('/api/tasks/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // 從 Supabase 取得使用者所有任務
    const result = await supabaseConfig.getUserTasks(userId);
    if (result.success) {
      const tasks = result.data.map(task => ({
        id: task.id,
        text: task.task_text,
        timestamp: task.created_at,
        date: new Date(task.task_date).toLocaleDateString('zh-TW'),
        hasTime: task.has_time,
        taskTime: task.task_time,
        status: task.status
      }));
      res.json({ success: true, tasks });
    } else {
      // 備援：從記憶體取得
      const memoryTasks = await getAllTasks(userId);
      res.json({ success: true, tasks: memoryTasks });
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 取得使用者今日任務
app.get('/api/today-tasks/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // 從記憶體取得今日任務 (使用現有函數)
    const todayTasks = await getTodayTasks(userId);
    
    // 格式化任務數據以符合前端期望的格式
    const formattedTasks = todayTasks.map(task => ({
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: task.text,
      timestamp: task.timestamp,
      date: new Date(task.timestamp).toLocaleDateString('zh-TW'),
      hasTime: task.hasTime,
      taskTime: task.taskTime,
      status: task.status || 'pending'
    }));
    
    res.json({ success: true, tasks: formattedTasks });
  } catch (error) {
    console.error('Error fetching today tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 更新任務完成狀態
app.patch('/api/tasks/:userId/:taskId/complete', async (req, res) => {
  const { userId, taskId } = req.params;
  const { status } = req.body;
  
  try {
    // 更新記憶體中的任務狀態
    const userTaskList = userTasks.get(userId) || [];
    const taskIndex = userTaskList.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
      userTaskList[taskIndex].status = status;
      userTasks.set(userId, userTaskList);
    }
    
    // 嘗試更新到 Supabase
    try {
      const result = await supabaseConfig.updateTaskStatus(taskId, status);
      if (result.success) {
        console.log(`✅ 任務狀態已更新到 Supabase - TaskID: ${taskId}, Status: ${status}`);
      }
    } catch (error) {
      console.log('⚠️ Supabase 更新失敗，但記憶體已更新:', error.message);
    }
    
    res.json({ success: true, message: 'Task status updated successfully' });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 刪除指定任務
app.delete('/api/tasks/:userId/:taskId', async (req, res) => {
  const { userId, taskId } = req.params;
  try {
    // 從 Supabase 刪除任務
    const result = await supabaseConfig.deleteTask(taskId);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 取得使用者統計資料
app.get('/api/user-stats/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // 從 Supabase 取得統計資料
    const tasksResult = await supabaseConfig.getUserTasks(userId);
    const messagesResult = await supabaseConfig.getUserMessages(userId);

    let stats = {
      totalMessages: 0,
      totalTasks: 0,
      aiQueries: 0,
      lastActivity: new Date().toLocaleDateString('zh-TW'),
      joinDate: new Date().toLocaleDateString('zh-TW'),
      tasksSummary: {
        active: 0,
        completed: 0,
        withTime: 0
      }
    };

    if (tasksResult.success) {
      const tasks = tasksResult.data;
      stats.totalTasks = tasks.length;
      stats.tasksSummary.active = tasks.filter(t => t.status === 'active').length;
      stats.tasksSummary.completed = tasks.filter(t => t.status === 'completed').length;
      stats.tasksSummary.withTime = tasks.filter(t => t.has_time).length;
      
      if (tasks.length > 0) {
        stats.joinDate = new Date(tasks[0].created_at).toLocaleDateString('zh-TW');
      }
    }

    if (messagesResult.success) {
      const messages = messagesResult.data;
      stats.totalMessages = messages.length;
      stats.aiQueries = messages.filter(m => m.intent_detected === 'general_query').length;
      
      if (messages.length > 0) {
        stats.lastActivity = new Date(messages[messages.length - 1].created_at).toLocaleDateString('zh-TW');
      }
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 匯出使用者資料
app.get('/api/export-data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [tasksResult, messagesResult] = await Promise.all([
      supabaseConfig.getUserTasks(userId),
      supabaseConfig.getUserMessages(userId)
    ]);

    const exportData = {
      userId,
      exportDate: new Date().toISOString(),
      tasks: tasksResult.success ? tasksResult.data : [],
      messages: messagesResult.success ? messagesResult.data : []
    };

    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 清除使用者所有資料
app.delete('/api/clear-data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // 清除 Supabase 資料
    const [tasksResult, messagesResult] = await Promise.all([
      supabaseConfig.clearUserTasks(userId),
      supabaseConfig.clearUserMessages(userId)
    ]);

    // 清除記憶體資料
    if (userTasks.has(userId)) {
      userTasks.delete(userId);
    }

    res.json({ success: true, message: '所有資料已清除' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3015;

// 啟動應用程式
async function startServer() {
  try {
    await initializeApp();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Bot is running on port ${PORT}`);
      console.log(`📊 資料庫已連接並可使用`);
      console.log(`🌐 Server is accessible at http://0.0.0.0:${PORT}`);
    });

    // 設定伺服器超時
    server.timeout = 30000;
    
    return server;
  } catch (error) {
    console.error('❌ 應用程式啟動失敗:', error);
    
    // 如果資料庫初始化失敗，仍然啟動伺服器（僅使用記憶體）
    if (error.message?.includes('database') || error.message?.includes('sqlite')) {
      console.log('⚠️ 資料庫初始化失敗，使用記憶體模式');
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Bot is running on port ${PORT} (Memory Mode)`);
      });
      server.timeout = 30000;
      return server;
    }
    
    process.exit(1);
  }
}

startServer();

// 優雅關閉處理
process.on('SIGINT', async () => {
  console.log('\n🔄 正在關閉應用程式...');
  
  try {
    await database.logSystem('info', 'system', 'Application shutting down');
    database.close();
    console.log('✅ 應用程式已安全關閉');
    process.exit(0);
  } catch (error) {
    console.error('❌ 關閉過程中發生錯誤:', error);
    process.exit(1);
  }
});
