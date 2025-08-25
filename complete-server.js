const express = require('express');
const path = require('path');
const fs = require('fs');
const line = require('@line/bot-sdk');

const app = express();

// LINE Bot 配置
const config = {
  channelAccessToken: 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eaaf339ed4aa0a351b5893f10d4581c5'
};

const client = new line.Client(config);

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 解析JSON
app.use(express.json());

// 確保LIFF目錄存在
const createLiffPages = () => {
  const liffDir = path.join(__dirname, 'liff-simple');
  if (!fs.existsSync(liffDir)) {
    fs.mkdirSync(liffDir);
  }

  // 創建主頁面
  const indexHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>任務管理 LIFF App</title>
    <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh; padding: 20px;
        }
        .container {
            max-width: 400px; margin: 0 auto; background: white;
            border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            color: white; padding: 30px 20px; text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .nav { padding: 20px; }
        .nav-button {
            display: block; width: 100%; padding: 15px; margin: 10px 0;
            background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 10px;
            text-decoration: none; color: #333; text-align: center; font-size: 16px;
            transition: all 0.3s ease;
        }
        .nav-button:hover { background: #00B900; color: white; border-color: #00B900; }
        .status {
            padding: 20px; background: #e8f4fd; margin: 20px; border-radius: 10px;
            text-align: center; font-size: 14px; color: #1976d2;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 任務管理</h1>
            <p>LINE Bot LIFF 應用程式</p>
        </div>
        <div class="nav">
            <a href="/liff/tasks" class="nav-button">📋 查看任務列表</a>
            <a href="/liff/profile" class="nav-button">👤 個人資料</a>
        </div>
        <div class="status" id="status">✅ LIFF 應用程式已載入</div>
    </div>
</body>
</html>`;

  const tasksHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>任務列表 - LIFF App</title>
    <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh; padding: 20px;
        }
        .container {
            max-width: 400px; margin: 0 auto; background: white;
            border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            color: white; padding: 20px; text-align: center;
        }
        .back-btn {
            background: rgba(255,255,255,0.2); border: none; color: white;
            padding: 8px 16px; border-radius: 20px; margin-bottom: 10px; cursor: pointer;
        }
        .content { padding: 20px; }
        .task-item {
            padding: 15px; margin: 10px 0; background: #f8f9fa;
            border-radius: 10px; border-left: 4px solid #00B900;
        }
        .task-title { font-weight: bold; color: #333; margin-bottom: 5px; }
        .task-desc { color: #666; font-size: 14px; }
        .task-status {
            display: inline-block; padding: 4px 12px; border-radius: 20px;
            font-size: 12px; margin-top: 8px;
        }
        .status-completed { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <button class="back-btn" onclick="window.location.href='/liff'">← 返回</button>
            <h1>📋 任務列表</h1>
        </div>
        <div class="content">
            <div class="task-item">
                <div class="task-title">完成LINE BOT設定</div>
                <div class="task-desc">設定webhook和基本回應功能</div>
                <span class="task-status status-completed">✅ 已完成</span>
            </div>
            <div class="task-item">
                <div class="task-title">建立LIFF應用程式</div>
                <div class="task-desc">創建LINE前端框架應用</div>
                <span class="task-status status-completed">✅ 已完成</span>
            </div>
            <div class="task-item">
                <div class="task-title">測試所有功能</div>
                <div class="task-desc">確認所有功能正常運作</div>
                <span class="task-status status-pending">⏳ 進行中</span>
            </div>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync(path.join(liffDir, 'index.html'), indexHtml);
  fs.writeFileSync(path.join(liffDir, 'tasks.html'), tasksHtml);
};

createLiffPages();

// 靜態文件服務
app.use('/liff', express.static(path.join(__dirname, 'liff-simple')));

// LIFF 路由
app.get('/liff', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-simple', 'index.html'));
});

app.get('/liff/tasks', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-simple', 'tasks.html'));
});

// 主頁
app.get('/', (req, res) => {
  res.send(\`
    <h1>🚀 LINE BOT 完全運行中</h1>
    <p><a href="/liff/tasks">📋 任務列表</a></p>
    <p>✅ 時間: \${new Date().toLocaleString('zh-TW')}</p>
  \`);
});

// 處理LINE webhook
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 事件處理函數
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 簡單回應邏輯
  const replyText = \`您說了: "\${event.message.text}"\n我是您的任務管理助手！\`;

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

const PORT = 3030;
app.listen(PORT, () => {
  console.log(\`✅ 完整LINE BOT服務器運行在端口 \${PORT}\`);
  console.log(\`🌐 LIFF App: http://localhost:\${PORT}/liff\`);
  console.log(\`📋 任務頁面: http://localhost:\${PORT}/liff/tasks\`);
  console.log(\`🔗 Webhook: http://localhost:\${PORT}/webhook\`);
});