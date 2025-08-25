const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 解析JSON
app.use(express.json());

// 檢查並創建簡單的LIFF頁面
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .nav {
            padding: 20px;
        }
        .nav-button {
            display: block;
            width: 100%;
            padding: 15px;
            margin: 10px 0;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            text-decoration: none;
            color: #333;
            text-align: center;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        .nav-button:hover {
            background: #00B900;
            color: white;
            border-color: #00B900;
        }
        .nav-button:active {
            transform: scale(0.98);
        }
        .status {
            padding: 20px;
            background: #e8f4fd;
            margin: 20px;
            border-radius: 10px;
            text-align: center;
            font-size: 14px;
            color: #1976d2;
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
            <a href="/liff/tasks" class="nav-button">
                📋 查看任務列表
            </a>
            
            <a href="/liff/profile" class="nav-button">
                👤 個人資料
            </a>
            
            <a href="/liff/add-task" class="nav-button">
                ➕ 新增任務
            </a>
        </div>
        
        <div class="status" id="status">
            正在初始化 LIFF...
        </div>
    </div>

    <script>
        window.addEventListener('load', function() {
            document.getElementById('status').textContent = '✅ LIFF 應用程式已載入';
            
            // 初始化LIFF
            liff.init({ liffId: '2007976732-Ye2k35eo' }).then(() => {
                document.getElementById('status').textContent = '✅ LIFF 已成功初始化';
            }).catch((err) => {
                document.getElementById('status').textContent = '⚠️ LIFF 初始化失敗: ' + err.message;
            });
        });
    </script>
</body>
</html>`;

  // 創建任務頁面
  const tasksHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>任務列表 - LIFF App</title>
    <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 20px;
        }
        .back-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            margin-bottom: 10px;
            cursor: pointer;
        }
        .content {
            padding: 20px;
        }
        .task-item {
            padding: 15px;
            margin: 10px 0;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #00B900;
        }
        .task-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .task-desc {
            color: #666;
            font-size: 14px;
        }
        .task-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-top: 8px;
        }
        .status-pending {
            background: #fff3cd;
            color: #856404;
        }
        .status-completed {
            background: #d4edda;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <button class="back-btn" onclick="goBack()">← 返回</button>
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

    <script>
        function goBack() {
            window.location.href = '/liff';
        }
        
        window.addEventListener('load', function() {
            liff.init({ liffId: '2007976732-Ye2k35eo' }).then(() => {
                console.log('LIFF 已初始化');
            }).catch((err) => {
                console.error('LIFF 初始化失敗:', err);
            });
        });
    </script>
</body>
</html>`;

  // 創建個人資料頁面
  const profileHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>個人資料 - LIFF App</title>
    <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .back-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            margin-bottom: 10px;
            cursor: pointer;
        }
        .profile-info {
            padding: 20px;
        }
        .profile-item {
            padding: 15px 0;
            border-bottom: 1px solid #eee;
        }
        .profile-item:last-child {
            border-bottom: none;
        }
        .profile-label {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .profile-value {
            color: #666;
        }
        .avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: block;
            background: #f0f0f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <button class="back-btn" onclick="goBack()">← 返回</button>
            <h1>👤 個人資料</h1>
        </div>
        
        <div class="profile-info">
            <img id="avatar" class="avatar" src="" alt="頭像" style="display: none;">
            
            <div class="profile-item">
                <div class="profile-label">顯示名稱</div>
                <div id="displayName" class="profile-value">載入中...</div>
            </div>
            
            <div class="profile-item">
                <div class="profile-label">狀態訊息</div>
                <div id="statusMessage" class="profile-value">載入中...</div>
            </div>
            
            <div class="profile-item">
                <div class="profile-label">用戶ID</div>
                <div id="userId" class="profile-value">載入中...</div>
            </div>
        </div>
    </div>

    <script>
        function goBack() {
            window.location.href = '/liff';
        }
        
        window.addEventListener('load', function() {
            liff.init({ liffId: '2007976732-Ye2k35eo' }).then(() => {
                if (liff.isLoggedIn()) {
                    liff.getProfile().then((profile) => {
                        document.getElementById('displayName').textContent = profile.displayName || '未設定';
                        document.getElementById('statusMessage').textContent = profile.statusMessage || '未設定';
                        document.getElementById('userId').textContent = profile.userId || '未知';
                        
                        if (profile.pictureUrl) {
                            const avatar = document.getElementById('avatar');
                            avatar.src = profile.pictureUrl;
                            avatar.style.display = 'block';
                        }
                    }).catch((err) => {
                        console.error('無法取得個人資料:', err);
                        document.getElementById('displayName').textContent = '無法載入';
                        document.getElementById('statusMessage').textContent = '無法載入';
                        document.getElementById('userId').textContent = '無法載入';
                    });
                } else {
                    document.getElementById('displayName').textContent = '請先登入';
                    document.getElementById('statusMessage').textContent = '請先登入';
                    document.getElementById('userId').textContent = '請先登入';
                }
            }).catch((err) => {
                console.error('LIFF 初始化失敗:', err);
            });
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(path.join(liffDir, 'index.html'), indexHtml);
  fs.writeFileSync(path.join(liffDir, 'tasks.html'), tasksHtml);
  fs.writeFileSync(path.join(liffDir, 'profile.html'), profileHtml);
};

// 創建LIFF頁面
createLiffPages();

// 提供靜態檔案
app.use('/liff', express.static(path.join(__dirname, 'liff-simple')));

// LIFF 路由處理
app.get('/liff', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-simple', 'index.html'));
});

app.get('/liff/tasks', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-simple', 'tasks.html'));
});

app.get('/liff/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-simple', 'profile.html'));
});

// 主頁面
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 LINE BOT 管理介面</h1>
    <h2>📱 LIFF 應用程式</h2>
    <p><a href="/liff" target="_blank">開啟 LIFF 應用程式</a></p>
    <p><a href="/liff/tasks" target="_blank">任務列表</a></p>
    <p><a href="/liff/profile" target="_blank">個人資料</a></p>
    <hr>
    <p>✅ 服務運行中</p>
    <p>🌐 時間: ${new Date().toLocaleString('zh-TW')}</p>
  `);
});

// Webhook 代理
app.all('/webhook', (req, res) => {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: 3016,
    path: '/webhook',
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });

  req.pipe(proxyReq, { end: true });
});

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`✅ LIFF 服務器運行在端口 ${PORT}`);
  console.log(`🌐 LIFF App: http://localhost:${PORT}/liff`);
  console.log(`📋 任務頁面: http://localhost:${PORT}/liff/tasks`);
  console.log(`👤 個人資料: http://localhost:${PORT}/liff/profile`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
});