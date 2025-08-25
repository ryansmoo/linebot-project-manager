# LINE Bot 雲端部署指南

## 🚀 方案一：GitHub + Railway（強烈推薦）

### 📝 準備工作
1. 確保有 GitHub 帳戶
2. 註冊 Railway 帳戶：https://railway.app
3. 準備 LINE Bot 設定資料

### 🔧 部署步驟

#### 步驟 1：準備 GitHub Repository
```bash
# 1. 在 GitHub 建立新的 repository
# 2. 將專案推送到 GitHub

git init
git add .
git commit -m "Initial commit: LINE Bot with LIFF"
git branch -M main
git remote add origin https://github.com/你的用戶名/linebot-project.git
git push -u origin main
```

#### 步驟 2：設定 Railway 部署
1. 前往 https://railway.app
2. 點擊 "Start a New Project"
3. 選擇 "Deploy from GitHub repo"
4. 選擇您的 LINE Bot repository
5. Railway 會自動偵測為 Node.js 專案

#### 步驟 3：設定環境變數
在 Railway Dashboard 中設定：
```
LINE_CHANNEL_ACCESS_TOKEN=您的_Access_Token
LINE_CHANNEL_SECRET=您的_Channel_Secret
LINE_LIFF_ID=您的_LIFF_ID
PORT=3000
NODE_ENV=production
```

#### 步驟 4：取得部署 URL
- Railway 會自動生成像 `https://linebot-project-production.up.railway.app` 的 URL
- 這就是您的穩定 Webhook URL！

#### 步驟 5：更新 LINE Developer Console
```
Webhook URL: https://您的railway網址.up.railway.app/webhook
```

---

## 🌟 方案二：GitHub + Render

### 🔧 部署步驟

#### 步驟 1：同樣推送到 GitHub

#### 步驟 2：設定 Render
1. 前往 https://render.com
2. 註冊並連結 GitHub
3. 點擊 "New Web Service"
4. 選擇您的 repository
5. 設定：
   ```
   Name: linebot-project
   Region: Singapore (較近台灣)
   Branch: main
   Build Command: npm install
   Start Command: node simple-linebot.js
   ```

#### 步驟 3：設定環境變數
在 Render Dashboard 中添加：
```
LINE_CHANNEL_ACCESS_TOKEN=您的_Access_Token
LINE_CHANNEL_SECRET=您的_Channel_Secret
LINE_LIFF_ID=您的_LIFF_ID
PORT=10000
NODE_ENV=production
```

#### 步驟 4：取得 URL
- Render 提供像 `https://linebot-project.onrender.com` 的固定 URL

---

## 📋 必要的檔案調整

### 1. 新增 railway.json（Railway 專用）
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "node simple-linebot.js"
  }
}
```

### 2. 更新 package.json
```json
{
  "scripts": {
    "start": "node simple-linebot.js",
    "dev": "nodemon simple-linebot.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 3. 新增 .gitignore
```
node_modules/
.env
*.log
*.pid
tunnel.log
ngrok.log
.DS_Store
```

---

## 🔒 安全性考量

### 環境變數設定（絕不提交到 Git）
```bash
# .env 檔案內容（不要上傳到 GitHub）
LINE_CHANNEL_ACCESS_TOKEN=實際的token
LINE_CHANNEL_SECRET=實際的secret
LINE_LIFF_ID=實際的liff_id
```

### env.example 檔案（可以上傳）
```bash
# 範例環境變數檔案
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
LINE_CHANNEL_SECRET=your_secret_here  
LINE_LIFF_ID=your_liff_id_here
PORT=3000
NODE_ENV=production
```

---

## 🎯 優勢比較

| 特點 | Tunnel (本機) | Railway | Render |
|------|---------------|---------|---------|
| 穩定性 | ❌ 不穩定 | ✅ 非常穩定 | ✅ 穩定 |
| HTTPS | ⚠️ 有時有問題 | ✅ 自動 | ✅ 自動 |
| 費用 | 免費 | 免費額度 | 免費 |
| 設定難度 | 簡單 | 簡單 | 簡單 |
| 啟動時間 | 立即 | 快速 | 較慢 |
| 自動更新 | ❌ | ✅ Git push | ✅ Git push |

---

## 🚀 快速部署建議

**最推薦：Railway**
1. 5分鐘內完成部署
2. 推送到 GitHub 自動更新
3. 穩定的 HTTPS URL
4. 適合正式使用

**預算考量：Render**  
1. 完全免費
2. 功能完整
3. 冷啟動需等待
4. 適合測試使用

選擇任一方案都能徹底解決 tunnel 不穩定的問題！