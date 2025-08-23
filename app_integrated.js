// 完整的 LINE 註冊綁定系統 - 整合版本
// 包含 OAuth 2.0 認證、自動加好友、歡迎訊息等完整功能

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const OpenAI = require('openai');
const path = require('path');
const { LineOAuthSystem, users, lineBindings, userSessions } = require('./line_oauth_system');
const { SecurityManager, rateLimiters } = require('./security_config');

const app = express();

// ================================
// 基本配置
// ================================

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET || 'eaaf339ed4aa0a351b5893f10d4581c5'
};

const client = new line.Client(config);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 任務儲存系統（向後兼容）
const userTasks = new Map();

// ================================
// 中介軟體設定
// ================================

// 安全性中介軟體
app.use(SecurityManager.corsMiddleware);
app.use(SecurityManager.securityHeadersMiddleware);

// 基本中介軟體
app.use(express.static('public'));

// LINE Bot SDK 中介軟體（只用於 webhook）
app.use('/callback', line.middleware(config));

// JSON 解析中介軟體（用於 API 路由）
app.use('/api', express.json());
app.use('/auth', express.urlencoded({ extended: true }));

// ================================
// 路由定義
// ================================

// 1. 首頁 - LINE 註冊入口
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'line_register.html'));
});

// 2. LINE 註冊頁面
app.get('/line-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'line_register.html'));
});

// 3. OAuth 準備階段 API
app.post('/api/line-oauth/prepare', rateLimiters.oauth, async (req, res) => {
    await LineOAuthSystem.prepareOAuth(req, res);
});

// 4. LINE OAuth Callback 處理
app.get('/auth/line/callback', rateLimiters.oauth, async (req, res) => {
    await LineOAuthSystem.handleCallback(req, res);
});

// 5. 註冊成功頁面
app.get('/auth/success', (req, res) => {
    const { token, userId, isNew } = req.query;
    
    if (!token || !userId) {
        return res.redirect('/line-register?error=invalid_access');
    }
    
    // 驗證 token
    const verification = LineOAuthSystem.verifyJWT(token);
    if (!verification.success) {
        return res.redirect('/line-register?error=invalid_token');
    }
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎉 ${isNew === 'true' ? '註冊成功' : '登入成功'}！</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #00B900 0%, #06C755 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .success-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            padding: 50px;
            text-align: center;
            max-width: 500px;
            width: 100%;
            animation: slideUp 0.8s ease-out;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .success-icon {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #00B900, #06C755);
            border-radius: 50%;
            margin: 0 auto 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            animation: bounce 1s ease-in-out;
        }
        
        @keyframes bounce {
            0%, 20%, 60%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            80% { transform: translateY(-5px); }
        }
        
        h1 {
            color: #333;
            font-size: 32px;
            margin-bottom: 15px;
            font-weight: 700;
        }
        
        .subtitle {
            color: #666;
            font-size: 18px;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        
        .feature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .feature-card {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            text-align: left;
        }
        
        .feature-icon {
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .feature-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        
        .feature-desc {
            color: #666;
            font-size: 14px;
        }
        
        .btn-group {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .btn {
            flex: 1;
            padding: 15px 25px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #00B900, #06C755);
            color: white;
            border: none;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 185, 0, 0.3);
        }
        
        .btn-secondary {
            background: #f1f3f4;
            color: #333;
            border: 1px solid #ddd;
        }
        
        .btn-secondary:hover {
            background: #e8eaed;
            transform: translateY(-1px);
        }
        
        .info-box {
            background: #e8f5e8;
            border-left: 4px solid #00B900;
            border-radius: 8px;
            padding: 20px;
            text-align: left;
        }
        
        .countdown {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
        }
        
        @media (max-width: 600px) {
            .success-container {
                padding: 30px 20px;
            }
            
            .feature-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .btn-group {
                flex-direction: column;
            }
            
            h1 {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">🎉</div>
        
        <h1>${isNew === 'true' ? '註冊成功！' : '歡迎回來！'}</h1>
        <p class="subtitle">
            ${isNew === 'true' 
                ? '您已成功註冊並綁定 LINE 帳號！' 
                : '您已成功登入記事機器人系統！'}
        </p>
        
        <div class="feature-grid">
            <div class="feature-card">
                <div class="feature-icon">📝</div>
                <div class="feature-title">智能任務管理</div>
                <div class="feature-desc">輕鬆記錄和查看您的待辦事項</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🤖</div>
                <div class="feature-title">AI 智能助手</div>
                <div class="feature-desc">ChatGPT 幫您解答各種問題</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">💬</div>
                <div class="feature-title">LINE 互動</div>
                <div class="feature-desc">直接在 LINE 中使用所有功能</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <div class="feature-title">安全保護</div>
                <div class="feature-desc">您的資料受到完整保護</div>
            </div>
        </div>
        
        <div class="btn-group">
            <a href="/profile/${userId}" class="btn btn-primary">查看個人資料</a>
            <button onclick="openLineApp()" class="btn btn-secondary">開啟 LINE 對話</button>
        </div>
        
        <div class="info-box">
            <strong>🚀 立即開始使用：</strong><br>
            • 在 LINE 中直接輸入任務，如：「17:00與小美約會」<br>
            • 詢問「今天我的任務有哪些？」查看任務清單<br>
            • 傳送任何問題給 AI 助手回答
        </div>
        
        <div class="countdown" id="countdown">
            30 秒後自動跳轉到個人資料頁面
        </div>
    </div>
    
    <script>
        function openLineApp() {
            const lineBotId = '@记事机器人';
            const lineUri = 'line://ti/p/' + lineBotId;
            const lineWebUrl = 'https://line.me/R/ti/p/' + lineBotId;
            const qrCodeUrl = '/qr-code';
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                window.location.href = lineUri;
                setTimeout(() => {
                    if (confirm('無法開啟LINE應用程式？\n點擊「確定」使用網頁版LINE，或「取消」查看QR Code。')) {
                        window.open(lineWebUrl, '_blank');
                    } else {
                        window.open(qrCodeUrl, '_blank');
                    }
                }, 3000);
            } else {
                const choice = prompt('請選擇加入方式：\n1. 輸入「1」開啟網頁版LINE\n2. 輸入「2」查看QR Code\n3. 手動搜尋Bot ID：' + lineBotId);
                
                if (choice === '1') {
                    window.open(lineWebUrl, '_blank');
                } else if (choice === '2') {
                    window.open(qrCodeUrl, '_blank');
                } else {
                    alert('請在LINE中搜尋Bot ID：' + lineBotId);
                }
            }
        }
        
        // 自動倒數跳轉
        let countdown = 30;
        const timer = setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown + ' 秒後自動跳轉到個人資料頁面';
            
            if (countdown <= 0) {
                clearInterval(timer);
                window.location.href = '/profile/${userId}';
            }
        }, 1000);
    </script>
</body>
</html>
    `;
    
    res.send(html);
});

// 6. 個人資料頁面（整合版本）
app.get('/profile/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = users.get(userId);
    
    if (!user && userId !== 'demo') {
        return res.status(404).send('用戶不存在');
    }
    
    const displayName = user ? user.displayName : 'Demo用戶';
    const avatarUrl = user ? user.avatarUrl : 'https://via.placeholder.com/100';
    const userTasks = getUserTasks(userId);
    
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📋 ${displayName} 的個人資料</title>
    <style>
        /* 這裡使用之前的 CSS 樣式 */
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
        
        .profile-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
        }
        
        .profile-header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-right: 20px;
            border: 3px solid #667eea;
        }
        
        .user-info h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 5px;
        }
        
        .user-info p {
            color: #666;
            font-size: 16px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .actions {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
        }
        
        .btn-secondary {
            background: #00B900;
            color: white;
            border: none;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }
        
        .recent-tasks {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
        }
        
        .recent-tasks h3 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
        }
        
        .task-item {
            background: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .task-text {
            flex: 1;
            color: #333;
        }
        
        .task-time {
            color: #666;
            font-size: 14px;
        }
        
        @media (max-width: 600px) {
            .profile-container {
                padding: 20px;
                margin: 10px;
            }
            
            .profile-header {
                flex-direction: column;
                text-align: center;
            }
            
            .avatar {
                margin-right: 0;
                margin-bottom: 15px;
            }
            
            .actions {
                justify-content: center;
            }
            
            .btn {
                flex: 1;
                min-width: 120px;
            }
        }
    </style>
</head>
<body>
    <div class="profile-container">
        <div class="profile-header">
            <img src="${avatarUrl}" alt="${displayName}" class="avatar">
            <div class="user-info">
                <h1>${displayName}</h1>
                <p>📱 LINE 記事機器人用戶</p>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${userTasks.length}</div>
                <div class="stat-label">總任務數</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${getTodayTasksCount(userId)}</div>
                <div class="stat-label">今日任務</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">100%</div>
                <div class="stat-label">綁定狀態</div>
            </div>
        </div>
        
        <div class="actions">
            <a href="/today-tasks/${userId}" class="btn btn-primary">查看今日任務</a>
            <a href="/all-tasks/${userId}" class="btn btn-primary">所有任務</a>
            <button onclick="openLineApp()" class="btn btn-secondary">開啟 LINE 對話</button>
        </div>
        
        <div class="recent-tasks">
            <h3>📝 最近任務</h3>
            ${userTasks.slice(-3).reverse().map(task => `
                <div class="task-item">
                    <div class="task-text">${task.text}</div>
                    <div class="task-time">${new Date(task.timestamp).toLocaleDateString('zh-TW')}</div>
                </div>
            `).join('') || '<p style="color: #666; text-align: center;">暫無任務記錄</p>'}
        </div>
    </div>
    
    <script>
        function openLineApp() {
            const lineBotId = '@记事机器人';
            const lineUri = 'line://ti/p/' + lineBotId;
            const lineWebUrl = 'https://line.me/R/ti/p/' + lineBotId;
            const qrCodeUrl = '/qr-code';
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                window.location.href = lineUri;
                setTimeout(() => {
                    if (confirm('無法開啟LINE應用程式？\n點擊「確定」使用網頁版LINE，或「取消」查看QR Code。')) {
                        window.open(lineWebUrl, '_blank');
                    } else {
                        window.open(qrCodeUrl, '_blank');
                    }
                }, 3000);
            } else {
                const choice = prompt('請選擇加入方式：\n1. 輸入「1」開啟網頁版LINE\n2. 輸入「2」查看QR Code\n3. 手動搜尋Bot ID：' + lineBotId);
                
                if (choice === '1') {
                    window.open(lineWebUrl, '_blank');
                } else if (choice === '2') {
                    window.open(qrCodeUrl, '_blank');
                } else {
                    alert('請在LINE中搜尋Bot ID：' + lineBotId);
                }
            }
        }
    </script>
</body>
</html>
    \`;
    
    res.send(html);
});

// 7. LINE Bot Webhook
app.post('/callback', (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error('Webhook處理錯誤:', err);
            res.status(500).end();
        });
});

// 8. 系統狀態 API
app.get('/api/stats', (req, res) => {
    const stats = LineOAuthSystem.getStats();
    res.json({
        success: true,
        ...stats,
        timestamp: new Date().toISOString()
    });
});

// 9. QR Code 頁面（從之前的實現複製）
app.get('/qr-code', (req, res) => {
    // QR Code 頁面實現...
    res.sendFile(path.join(__dirname, 'qr_code_page.html'));
});

// ================================
// 輔助函數
// ================================

// 處理 LINE 事件
async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const userId = event.source.userId;
    const userMessage = event.message.text.trim();
    
    console.log(\`收到用戶 \${userId} 的訊息: \${userMessage}\`);

    try {
        // 檢查用戶是否已註冊綁定
        const binding = lineBindings.get(userId);
        let user = null;
        
        if (binding) {
            user = users.get(binding.userId);
        }

        // 特殊指令處理
        if (userMessage.toLowerCase() === 'hello') {
            let welcomeText;
            if (user) {
                welcomeText = `Hello ${user.displayName}! 歡迎回到記事機器人！\n\n您可以：\n📝 直接輸入任務進行記錄\n📋 詢問「今天我的任務有哪些？」\n🤖 向我提問任何問題`;
            } else {
                welcomeText = `Hello! 歡迎使用記事機器人！\n\n💡 建議您先完成註冊：\n🔗 ${process.env.BASE_URL || 'http://localhost:3000'}/line-register\n\n註冊後即可使用完整功能！`;
            }
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: welcomeText
            });
        }

        if (userMessage === '/help' || userMessage === '幫助') {
            let helpText;
            if (user) {
                helpText = `📝 記事機器人功能說明\n\n✅ 已綁定用戶：${user.displayName}\n\n📋 功能列表：\n• 直接輸入任務：「17:00小美約會」\n• 查看任務：「今天我的任務有哪些？」\n• AI問答：直接提問任何問題\n• 個人資料：${process.env.BASE_URL || 'http://localhost:3000'}/profile/${binding.userId}`;
            } else {
                helpText = `📝 記事機器人功能說明\n\n❗ 您尚未完成註冊綁定\n\n🔗 請先完成註冊：\n${process.env.BASE_URL || 'http://localhost:3000'}/line-register\n\n註冊後您可以：\n• 智能任務管理\n• AI 問答助手\n• 個人資料管理`;
            }
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: helpText
            });
        }

        // 如果用戶未註冊，引導註冊
        if (!user) {
            const registerText = `👋 歡迎使用記事機器人！\n\n您尚未完成註冊綁定，請先完成註冊以使用完整功能：\n\n🔗 點擊連結註冊：\n${process.env.BASE_URL || 'http://localhost:3000'}/line-register\n\n註冊完成後即可使用：\n📝 智能任務管理\n🤖 AI 問答助手\n📊 個人資料管理`;
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: registerText
            });
        }

        // 已註冊用戶的功能處理
        const isTaskQuery = /今天|任務|待辦|清單/.test(userMessage) && /什麼|哪些|多少|幾個/.test(userMessage);
        
        if (isTaskQuery) {
            return handleTaskQuery(event, user.id);
        }

        const isTaskRecord = isTaskMessage(userMessage);
        if (isTaskRecord) {
            return handleTaskRecord(event, user.id, userMessage);
        }

        // 其他訊息使用 ChatGPT
        const aiResponse = await getChatGPTResponse(userMessage);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: aiResponse
        });

    } catch (error) {
        console.error('處理訊息錯誤:', error);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '抱歉，處理您的訊息時發生錯誤，請稍後再試。'
        });
    }
}

// 其他輔助函數（任務管理、ChatGPT等）
function isTaskMessage(message) {
    if (message.length < 3) return false;
    if (/[？?]/.test(message)) return false;
    if (/什麼|為什麼|怎麼|如何|是否/.test(message)) return false;
    
    const taskKeywords = ['買', '去', '做', '完成', '開會', '約會', '上課', '工作', '打電話', '寫', '整理', '準備', '拜訪', '會議'];
    const timePattern = /\d{1,2}[:：]\d{2}|\d{1,2}點|上午|下午|早上|晚上|明天|今天/;
    
    return taskKeywords.some(keyword => message.includes(keyword)) || timePattern.test(message);
}

async function handleTaskRecord(event, userId, taskText) {
    try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const taskId = Date.now();
        const task = {
            id: taskId,
            text: taskText,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('zh-TW')
        };
        
        if (!userTasks.has(userId)) {
            userTasks.set(userId, []);
        }
        
        userTasks.get(userId).push(task);
        
        const flexMessage = createTaskRecordFlexMessage(taskText, userId, taskId, baseUrl);
        flexMessage.quickReply = {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'uri',
                        label: '今天',
                        uri: \`\${baseUrl}/today-tasks/\${userId}\`
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'uri',
                        label: '全部',
                        uri: \`\${baseUrl}/all-tasks/\${userId}\`
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'uri',
                        label: '個人',
                        uri: \`\${baseUrl}/profile/\${userId}\`
                    }
                }
            ]
        };
        
        return client.replyMessage(event.replyToken, flexMessage);
        
    } catch (error) {
        console.error('任務記錄錯誤:', error);
        throw error;
    }
}

async function handleTaskQuery(event, userId) {
    try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const todayTasks = getTodayTasks(userId);
        
        if (todayTasks.length === 0) {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '📋 您今天還沒有記錄任何任務！\n\n💡 直接輸入任務即可記錄，例如：\n「17:00小美約會」\n「買牛奶和雞蛋」'
            });
        }

        const flexMessage = createTaskListFlexMessage(todayTasks, userId, baseUrl);
        return client.replyMessage(event.replyToken, flexMessage);
        
    } catch (error) {
        console.error('任務查詢錯誤:', error);
        throw error;
    }
}

// 其他必要函數...
function createTaskRecordFlexMessage(taskText, userId, taskId, baseUrl) {
    return {
        type: 'flex',
        altText: '📝 任務已記錄',
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
                        color: '#00B900'
                    },
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    {
                        type: 'text',
                        text: '您的任務：',
                        margin: 'lg',
                        size: 'sm',
                        color: '#666666'
                    },
                    {
                        type: 'text',
                        text: taskText,
                        weight: 'bold',
                        size: 'md',
                        color: '#333333',
                        margin: 'sm'
                    },
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    {
                        type: 'text',
                        text: '✨ 任務已成功儲存到今日待辦事項',
                        margin: 'lg',
                        size: 'sm',
                        color: '#666666'
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: '🔗 查看 Threads 動態',
                            uri: 'https://www.threads.com/@ryan_ryan_lin?hl=zh-tw'
                        },
                        style: 'primary',
                        color: '#00B900'
                    }
                ]
            }
        }
    };
}

function createTaskListFlexMessage(tasks, userId, baseUrl) {
    const taskCount = tasks.length;
    const displayTasks = tasks.slice(0, 3);
    const hasMore = taskCount > 3;
    
    return {
        type: 'flex',
        altText: \`📋 \${taskCount}個待辦事項\`,
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: \`📋 \${taskCount}個待辦事項\`,
                        weight: 'bold',
                        size: 'xl',
                        color: '#00B900'
                    },
                    {
                        type: 'text',
                        text: \`今日共有 \${taskCount} 項任務\`,
                        size: 'sm',
                        color: '#666666',
                        margin: 'sm'
                    },
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    ...displayTasks.map((task, index) => ({
                        type: 'text',
                        text: \`\${index + 1}. \${task.text}\`,
                        size: 'sm',
                        color: '#333333',
                        margin: 'md'
                    })),
                    ...(hasMore ? [{
                        type: 'text',
                        text: \`...還有 \${taskCount - 3} 項任務\`,
                        size: 'sm',
                        color: '#666666',
                        margin: 'md'
                    }] : []),
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    {
                        type: 'text',
                        text: '💪 今日任務，一起加油！',
                        size: 'sm',
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
                        action: {
                            type: 'uri',
                            label: '🌐 查看活動動態',
                            uri: 'https://www.threads.com/activity?hl=zh-tw'
                        },
                        style: 'primary',
                        color: '#00B900'
                    }
                ]
            }
        }
    };
}

async function getChatGPTResponse(message) {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OPENAI_TIMEOUT')), 20000)
        );

        const openaiPromise = openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: '你是一個記事機器人的AI助手，請用繁體中文回答，語氣要友善且有幫助性。'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        });

        const completion = await Promise.race([openaiPromise, timeoutPromise]);
        return completion.choices[0].message.content.trim();

    } catch (error) {
        console.error('ChatGPT API錯誤:', error);
        
        if (error.message === 'OPENAI_TIMEOUT') {
            return '抱歉，AI助手回應時間過長，請稍後再試或簡化您的問題。';
        }
        
        return '抱歉，AI助手暫時無法回應，請稍後再試。';
    }
}

function getUserTasks(userId) {
    return userTasks.get(userId) || [];
}

function getTodayTasks(userId) {
    const tasks = getUserTasks(userId);
    const today = new Date().toLocaleDateString('zh-TW');
    return tasks.filter(task => task.date === today);
}

function getTodayTasksCount(userId) {
    return getTodayTasks(userId).length;
}

// ================================
// 啟動服務器
// ================================

const PORT = process.env.PORT || 3000;

// 驗證環境變數
if (!SecurityManager.validateEnvironment()) {
    console.error('環境變數驗證失敗，請檢查 .env 文件');
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(\`🚀 LINE 註冊綁定系統啟動成功！\`);
    console.log(\`📱 服務運行在 port \${PORT}\`);
    console.log(\`🔗 註冊頁面: http://localhost:\${PORT}/line-register\`);
    console.log(\`📊 系統統計: http://localhost:\${PORT}/api/stats\`);
    
    // 顯示當前系統狀態
    const stats = LineOAuthSystem.getStats();
    console.log(\`📈 當前狀態: \${stats.totalUsers} 用戶, \${stats.totalBindings} 綁定\`);
});