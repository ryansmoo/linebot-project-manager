const express = require('express');
const { Client } = require('@line/bot-sdk');
const path = require('path');
const os = require('os');

// LINE Bot 設定
const config = {
  channelAccessToken: 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'a0b2e6b0ad5b4e3adf13e11b68c82ad4'
};

const client = new Client(config);
const app = express();
const PORT = 3016;

// 獲取本機IP地址
function getLocalIP() {
  const networks = os.networkInterfaces();
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

// 內存數據庫
const userTasks = new Map();

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務
app.get('/tasks.html', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>任務記錄</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #DDA267, #D4935D);
            color: white;
            padding: 24px;
            text-align: center;
        }
        .header h1 { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
        .header .summary { opacity: 0.9; font-size: 16px; }
        .task-item {
            padding: 20px 24px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: flex-start;
        }
        .task-number {
            background: #DDA267;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 20px;
            flex-shrink: 0;
        }
        .task-text { flex: 1; font-size: 16px; color: #333; line-height: 1.5; }
        .task-status { font-size: 28px; margin-left: 16px; }
        .empty-state {
            text-align: center;
            padding: 80px 20px;
            color: #6c757d;
        }
        .footer {
            padding: 20px 24px;
            background: #f8f9fa;
            text-align: center;
        }
        .refresh-btn {
            background: #DDA267;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 任務記錄</h1>
            <div id="summary">載入中...</div>
        </div>
        <div id="taskList"></div>
        <div class="footer">
            <button class="refresh-btn" onclick="loadTasks()">🔄 重新載入</button>
        </div>
    </div>

    <script>
        const userId = new URLSearchParams(window.location.search).get('userId');
        
        async function loadTasks() {
            const summary = document.getElementById('summary');
            const taskList = document.getElementById('taskList');
            
            try {
                const response = await fetch('/api/tasks/' + userId);
                const data = await response.json();
                
                if (data.success && data.tasks.length > 0) {
                    const completed = data.tasks.filter(t => t.completed).length;
                    summary.textContent = \`共 \${data.tasks.length} 個任務 (已完成 \${completed} 個)\`;
                    
                    let html = '';
                    data.tasks.forEach((task, index) => {
                        const status = task.completed ? '✅' : '⭕';
                        html += \`
                            <div class="task-item">
                                <div class="task-number">\${index + 1}</div>
                                <div class="task-text">\${task.text}</div>
                                <div class="task-status">\${status}</div>
                            </div>
                        \`;
                    });
                    taskList.innerHTML = html;
                } else {
                    summary.textContent = '共 0 個任務';
                    taskList.innerHTML = '<div class="empty-state"><h3>目前沒有任務</h3><p>開始在LINE中發送訊息建立任務！</p></div>';
                }
            } catch (error) {
                console.error('載入失敗:', error);
                taskList.innerHTML = '<div class="empty-state"><h3>載入失敗</h3><p>請稍後重試</p></div>';
            }
        }
        
        loadTasks();
    </script>
</body>
</html>
  `);
});

// API 端點
app.get('/api/tasks/:userId', (req, res) => {
  const { userId } = req.params;
  const userTaskMap = userTasks.get(userId);
  
  if (!userTaskMap) {
    return res.json({ success: true, tasks: [] });
  }
  
  const allTasks = [];
  for (const [date, tasks] of userTaskMap) {
    allTasks.push(...tasks);
  }
  
  res.json({ success: true, tasks: allTasks });
});

// LINE Webhook
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const messageText = event.message.text.trim();
        
        // 儲存任務
        const today = new Date().toISOString().split('T')[0];
        if (!userTasks.has(userId)) {
          userTasks.set(userId, new Map());
        }
        const userTaskMap = userTasks.get(userId);
        if (!userTaskMap.has(today)) {
          userTaskMap.set(today, []);
        }
        
        const task = {
          id: Date.now().toString(),
          text: messageText,
          completed: false,
          createdAt: new Date().toISOString(),
          date: today,
          userId: userId
        };
        
        userTaskMap.get(today).push(task);
        
        // 回覆訊息
        const todayTasks = userTaskMap.get(today) || [];
        const replyMessage = {
          type: "flex",
          altText: "今天的任務清單",
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#DDA267",
              paddingAll: "16px",
              contents: [{
                type: "text",
                text: `今天 ${todayTasks.length} 件事要做`,
                weight: "bold",
                size: "lg",
                color: "#FFFFFF",
                align: "center"
              }]
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: todayTasks.map((task, index) => ({
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: `${index + 1}. ${task.text}`,
                    size: "md",
                    wrap: true,
                    color: "#333333",
                    flex: 8,
                    gravity: "center"
                  },
                  {
                    type: "text",
                    text: task.completed ? "✅" : "⭕",
                    size: "lg",
                    color: "#333333",
                    flex: 2,
                    align: "center",
                    gravity: "center"
                  }
                ],
                spacing: "sm",
                margin: "xs"
              })),
              spacing: "sm",
              paddingAll: "20px"
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `已完成 0 件、待完成 ${todayTasks.length} 件`,
                  weight: "regular",
                  size: "sm",
                  color: "#666666",
                  align: "center",
                  margin: "xs"
                },
                {
                  type: "separator",
                  margin: "md"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  spacing: "sm",
                  margin: "md",
                  contents: [
                    {
                      type: "button",
                      style: "link",
                      height: "sm",
                      action: {
                        type: "uri",
                        label: "全部紀錄",
                        uri: `${BASE_URL}/tasks.html?userId=${encodeURIComponent(userId)}`
                      },
                      flex: 1
                    },
                    {
                      type: "button",
                      style: "link",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "個人帳號",
                        text: "個人帳號"
                      },
                      flex: 1
                    }
                  ]
                }
              ],
              paddingAll: "20px"
            }
          }
        };
        
        await client.replyMessage(event.replyToken, replyMessage);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook錯誤:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 啟動服務器
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 穩定版 LINE Bot 啟動成功！');
  console.log(`📡 服務運行於: ${BASE_URL}`);
  console.log(`🔗 Webhook URL: ${BASE_URL}/webhook`);
  console.log(`🌐 任務頁面: ${BASE_URL}/tasks.html`);
  console.log(`💻 本機IP: ${LOCAL_IP}`);
  console.log('📝 請將 Webhook URL 設定到 LINE Developer Console');
  console.log('⚡ 準備接收 LINE 訊息...');
});