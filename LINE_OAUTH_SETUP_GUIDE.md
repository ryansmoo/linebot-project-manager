# 🚀 LINE 註冊綁定系統 - 完整設定指南

## 📋 系統概述

這是一個完整的 LINE 官方帳號註冊綁定系統，提供以下功能：

### 🎯 核心功能
- **LINE Login OAuth 2.0 認證**
- **自動用戶註冊與 LINE 帳號綁定**
- **自動加好友功能**
- **歡迎訊息發送**
- **完整的安全性驗證**
- **任務管理系統整合**

---

## 🔧 LINE Developers 設定

### 1. 建立 LINE Login Channel

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 或建立新的
3. 點擊 **Create Channel** → 選擇 **LINE Login**

### 2. Channel 基本設定

```
Channel Name: 記事機器人 Login
Channel Description: 記事機器人用戶註冊與綁定系統
App Type: Web App
```

### 3. 重要配置項目

#### Channel ID & Secret
```
Channel ID: 2006603938 (範例)
Channel Secret: your_channel_secret_here
```

#### Callback URL (最重要！)
```
Callback URL: https://your-domain.com/auth/line/callback

開發環境:
http://localhost:3000/auth/line/callback
```

#### Scopes (權限範圍)
請勾選以下權限：
- ✅ `profile` - 取得用戶基本資料
- ✅ `openid` - OpenID Connect 身份驗證
- ✅ `email` - 取得用戶 email（可選）

#### Linked OA (關鍵設定！)
```
請將 LINE Login 連結到您的 LINE Official Account
這樣用戶授權後就會自動成為好友
```

---

## 🗄️ 資料庫設定

### 1. 建立資料庫

```sql
-- 建立資料庫
CREATE DATABASE linebot_register CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE linebot_register;

-- 執行資料庫結構
-- 請執行 database_schema.sql 中的所有 SQL 語句
```

### 2. 資料庫連線設定

在 `.env` 檔案中加入：

```env
# 資料庫設定
DB_HOST=localhost
DB_PORT=3306
DB_NAME=linebot_register
DB_USER=your_db_username
DB_PASS=your_db_password
```

---

## 🔐 環境變數設定

建立 `.env` 檔案：

```env
# LINE Bot 基本設定
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# LINE Login 設定
LINE_CHANNEL_ID=2006603938
LINE_LOGIN_CALLBACK_URL=http://localhost:3000/auth/line/callback

# JWT 安全性設定
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# OpenAI API（用於 AI 問答）
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# 應用程式設定
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# 安全性設定（生產環境）
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

---

## 📦 安裝與部署

### 1. 安裝依賴套件

```bash
npm install express @line/bot-sdk openai jsonwebtoken express-rate-limit axios crypto dotenv
```

### 2. 檔案結構

```
linebot-project-manager/
├── app_integrated.js          # 主應用程式
├── line_oauth_system.js       # OAuth 系統核心
├── security_config.js         # 安全性配置
├── line_register.html          # 前端註冊頁面
├── database_schema.sql         # 資料庫結構
├── .env                       # 環境變數
└── package.json               # 專案配置
```

### 3. 啟動應用程式

```bash
# 開發環境
node app_integrated.js

# 生產環境 (建議使用 PM2)
npm install -g pm2
pm2 start app_integrated.js --name "linebot-register"
```

---

## 🌐 網域設定與SSL

### 1. 使用 ngrok (開發環境)

```bash
npm install -g ngrok
ngrok http 3000

# 取得 HTTPS URL，例如：
# https://abc123.ngrok.io
```

### 2. 更新 LINE Developers 設定

將 Callback URL 更新為：
```
https://abc123.ngrok.io/auth/line/callback
```

### 3. 生產環境 SSL

建議使用：
- **Cloudflare** - 免費 SSL 證書
- **Let's Encrypt** - 免費 SSL 證書
- **AWS ALB** - 如果使用 AWS 部署

---

## 🔒 安全性配置

### 1. JWT Secret 生成

```javascript
// 生成安全的 JWT Secret
const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');
console.log(secret);
```

### 2. Rate Limiting

系統已內建限流保護：
- **OAuth 請求**: 15分鐘內最多 5 次
- **API 請求**: 1分鐘內最多 60 次

### 3. CSRF 保護

- 使用隨機 state 參數
- 驗證 referrer 來源
- 防止重複提交

---

## 🧪 測試流程

### 1. 功能測試清單

- [ ] LINE Login 按鈕正常顯示
- [ ] 點擊後跳轉到 LINE 授權頁面
- [ ] 授權後正確回調到系統
- [ ] 新用戶自動建立帳號
- [ ] 舊用戶正確登入
- [ ] 自動發送歡迎訊息
- [ ] 任務管理功能正常
- [ ] 個人資料頁面顯示正確

### 2. 測試步驟

1. **開啟註冊頁面**
   ```
   http://localhost:3000/line-register
   ```

2. **點擊「使用 LINE 註冊並綁定」**
   - 應該跳轉到 LINE 授權頁面
   - 顯示權限請求（個人資料、內部識別碼等）

3. **完成授權**
   - 自動回到系統成功頁面
   - 檢查資料庫是否建立用戶記錄
   - 確認 LINE 是否收到歡迎訊息

4. **測試 LINE Bot 功能**
   ```
   發送: hello
   應該收到: 歡迎訊息與功能說明
   
   發送: 17:00小美約會
   應該收到: 任務記錄確認 Flex Message
   
   發送: 今天我的任務有哪些？
   應該收到: 任務清單 Flex Message
   ```

---

## 🐛 常見問題與解決方案

### 1. "Invalid redirect_uri" 錯誤

**原因**: LINE Developers Console 中的 Callback URL 設定不正確

**解決方案**:
```
1. 檢查 LINE Login Channel 設定
2. 確保 Callback URL 完全一致（包含 http/https）
3. 注意不要有多餘的斜線 "/"
```

### 2. OAuth 流程卡住

**可能原因**:
- 網路連線問題
- Channel Secret 不正確  
- State 參數驗證失敗

**解決方案**:
```javascript
// 檢查 console.log 輸出
console.log('[OAuth] 回調處理: code=', !!code, 'state=', state);
```

### 3. 無法發送歡迎訊息

**原因**: 
- LINE Channel Access Token 不正確
- 用戶尚未成為好友
- Bot 沒有權限發送訊息

**解決方案**:
```
1. 檢查 Channel Access Token
2. 在 LINE Developers Console 確認 LINE Login 已連結到 Official Account
3. 確認 Bot 具有發送訊息權限
```

### 4. 資料庫連線失敗

**解決方案**:
```javascript
// 加入資料庫連線測試
const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('資料庫連線失敗:', err);
    } else {
        console.log('資料庫連線成功');
    }
});
```

---

## 📊 監控與日誌

### 1. 系統狀態 API

```
GET /api/stats

回應格式:
{
    "success": true,
    "totalUsers": 150,
    "totalBindings": 150,
    "activeSessions": 45,
    "pendingOAuthStates": 2,
    "timestamp": "2025-08-22T14:30:00.000Z"
}
```

### 2. 日誌監控

重要日誌事件：
- `[OAuth] 準備狀態` - OAuth 流程開始
- `[OAuth] 回調處理` - 處理 LINE 回調
- `[OAuth] 用戶資訊` - 取得用戶資料
- `[用戶] 新用戶註冊` - 新用戶建立
- `[歡迎訊息] 發送成功` - 歡迎訊息發送

### 3. 錯誤監控

建議監控的錯誤：
- OAuth Token 交換失敗
- 用戶資料取得失敗
- 歡迎訊息發送失敗
- 資料庫操作錯誤

---

## 🚀 生產環境部署

### 1. 環境變數更新

```env
NODE_ENV=production
BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
LINE_LOGIN_CALLBACK_URL=https://your-domain.com/auth/line/callback
```

### 2. PM2 配置

```json
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'linebot-register',
        script: 'app_integrated.js',
        instances: 2,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
}
```

### 3. Nginx 代理設定

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📝 API 文檔

### 註冊綁定流程 API

#### 1. 準備 OAuth 流程
```http
POST /api/line-oauth/prepare
Content-Type: application/json

{
    "state": "64-character-hex-string",
    "referrer": "http://localhost:3000/line-register"
}
```

#### 2. LINE OAuth Callback
```http
GET /auth/line/callback?code=ABC123&state=xyz789
```

#### 3. 驗證 JWT Token
```javascript
// 使用 LineOAuthSystem.verifyJWT(token)
const result = LineOAuthSystem.verifyJWT(jwtToken);
if (result.success) {
    console.log('用戶ID:', result.user.id);
}
```

---

## 🎉 完成！

恭喜您完成了 LINE 註冊綁定系統的設定！

現在您的系統具有：
- ✅ 完整的 OAuth 2.0 認證流程
- ✅ 自動用戶註冊與綁定
- ✅ 安全性驗證機制
- ✅ 自動加好友功能
- ✅ 歡迎訊息發送
- ✅ 任務管理系統
- ✅ 響應式前端界面

### 🔗 重要連結

- **註冊頁面**: `http://localhost:3000/line-register`
- **系統狀態**: `http://localhost:3000/api/stats`
- **LINE Developers**: https://developers.line.biz/console/

如果您遇到任何問題，請檢查：
1. 環境變數設定
2. LINE Developers Console 配置
3. 資料庫連線
4. 網路連線與防火牆設定

祝您使用愉快！🎊