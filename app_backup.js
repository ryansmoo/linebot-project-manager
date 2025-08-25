require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');
const OpenAI = require('openai');

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

// 會員系統資料結構
const members = new Map(); // memberId -> memberData
const lineBindings = new Map(); // lineUserId -> memberId
const memberSessions = new Map(); // sessionId -> memberData

// 會員資料結構
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

// 任務管理功能
function addTask(userId, taskText) {
  if (!userTasks.has(userId)) {
    userTasks.set(userId, []);
  }
  
  const task = {
    id: Date.now(),
    text: taskText,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('zh-TW')
  };
  
  userTasks.get(userId).push(task);
  console.log(`Added task for user ${userId}: ${taskText}`);
  return task;
}

function getTodayTasks(userId) {
  if (!userTasks.has(userId)) {
    return [];
  }
  
  const today = new Date().toLocaleDateString('zh-TW');
  return userTasks.get(userId).filter(task => task.date === today);
}

function getAllTasks(userId) {
  return userTasks.get(userId) || [];
}

const app = express();

app.get('/', (req, res) => {
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

// 任務記錄確認 Flex Message  
function createTaskRecordFlexMessage(taskText, userId, taskId, baseUrl) {
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
              }
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
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '編輯',
              uri: `${baseUrl}/edit-task/${userId}/${taskId}`
            }
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
                text: '✅ 任務已加入今日待辦清單',
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
                  text: task.text,
                  size: 'sm',
                  color: '#333333',
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

async function getChatGPTResponse(userMessage) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return '抱歉，AI功能尚未設定。請聯繫管理員設定OpenAI API金鑰。';
    }

    // 添加超時控制，避免webhook超時
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenAI_TIMEOUT')), 20000)
    );

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一個友善的LINE聊天機器人助手。請用繁體中文回答，保持回覆簡潔有用，通常在100字以內。'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      }),
      timeoutPromise
    ]);

    return completion.choices[0].message.content.trim();
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

async function handleEvent(event, baseUrl) {
  console.log('Received event:', event);
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  const userMessage = event.message.text;
  const userId = event.source.userId || 'default-user';
  let replyMessage = '';

  try {
    if (userMessage.toLowerCase() === 'hello') {
      replyMessage = 'Hello! 你好！我是您的專屬記事機器人，可以幫您記錄和管理今日待辦事項！📝\n\n請直接輸入您的任務，例如：「17:00小美約會」';
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
      
    } else if (userMessage.includes('今天我的任務有哪些') || userMessage.includes('今日任務') || userMessage.includes('待辦事項') || userMessage === '任務清單') {
      console.log(`Getting tasks for user: ${userId}`);
      
      const todayTasks = getTodayTasks(userId);
      const taskCount = todayTasks.length;
      
      if (taskCount === 0) {
        replyMessage = '🎉 今天還沒有任何待辦事項！\n您可以直接輸入任務，例如：「17:00小美約會」來新增任務。';
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage
        });
      }
      
      const flexMessage = createTaskListFlexMessage(taskCount, todayTasks, userId, baseUrl);
      flexMessage.quickReply = {
        items: [
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '今天',
              uri: `${baseUrl}/today-tasks/${userId}`
            }
          },
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '全部',
              uri: `${baseUrl}/all-tasks/${userId}`
            }
          },
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '個人',
              uri: `${baseUrl}/profile/${userId}`
            }
          }
        ]
      };
      
      return client.replyMessage(event.replyToken, flexMessage);
      
    } else if (userMessage.toLowerCase().includes('/help') || userMessage === '幫助') {
      replyMessage = `📝 記事機器人功能說明：

🔸 **新增任務**：直接輸入您的任務
   例如：「17:00小美約會」

🔸 **查看任務**：詢問今日任務
   例如：「今天我的任務有哪些？」

🔸 **AI問答**：其他問題會由ChatGPT回答

🔸 **特殊指令**：
   - 「hello」: 歡迎訊息
   - 「幫助」: 查看此說明

開始輸入您的第一個任務吧！✨`;

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
        console.log(`Adding task for user ${userId}: ${userMessage}`);
        
        const task = addTask(userId, userMessage);
        
        const flexMessage = createTaskRecordFlexMessage(userMessage, userId, task.id, baseUrl);
        flexMessage.quickReply = {
          items: [
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '今天',
                uri: `${baseUrl}/today-tasks/${userId}`
              }
            },
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '全部',
                uri: `${baseUrl}/all-tasks/${userId}`
              }
            },
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '個人',
                uri: `${baseUrl}/profile/${userId}`
              }
            }
          ]
        };
        
        return client.replyMessage(event.replyToken, flexMessage);
        
      } else {
        // 其他訊息使用ChatGPT回覆
        console.log(`Sending message to ChatGPT: ${userMessage}`);
        replyMessage = await getChatGPTResponse(userMessage);
        console.log(`ChatGPT response: ${replyMessage}`);
        
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage
        });
      }
    }
  } catch (error) {
    console.error('Error in handleEvent:', error);
    replyMessage = '抱歉，處理您的訊息時發生錯誤，請稍後再試。';
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMessage
    });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});
