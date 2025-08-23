# 🚀 LINE Bot 雲端部署指南

本指南將協助您將 LINE Bot 專案部署到免費的雲端平台。

## 📋 部署前準備

### 1. 所需帳號
- [x] GitHub 帳號
- [ ] Railway 帳號 (推薦免費方案)
- [ ] 或 Render 帳號 (備用選項)

### 2. 環境變數準備
請準備以下環境變數的值：
```
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret
LINE_CHANNEL_ID=你的_LINE_Channel_ID
LINE_LOGIN_CHANNEL_SECRET=你的_LINE_Login_Channel_Secret
OPENAI_API_KEY=你的_OpenAI_API_Key
LINE_LIFF_ID=你的_LIFF_ID
JWT_SECRET=你的_JWT_安全金鑰
```

## 🌟 選項1：Railway 部署 (推薦)

### 為什麼選擇 Railway？
- ✅ **完全免費**：每月 $5 免費額度
- ✅ **自動部署**：連接 GitHub 自動部署
- ✅ **支持資料庫**：內建 SQLite 支持
- ✅ **HTTPS 自動**：免費 SSL 憑證
- ✅ **簡單易用**：一鍵部署

### 部署步驟

#### 1. 建立 GitHub 儲存庫
```bash
# 在您的專案目錄中
git init
git add .
git commit -m "🎉 Initial commit: LINE Bot with database and LIFF"
git branch -M main
git remote add origin https://github.com/你的用戶名/linebot-project-manager.git
git push -u origin main
```

#### 2. 在 Railway 部署
1. 訪問 [Railway.app](https://railway.app)
2. 使用 GitHub 帳號登入
3. 點擊 "Deploy from GitHub repo"
4. 選擇您的 `linebot-project-manager` 儲存庫
5. Railway 會自動偵測 Node.js 專案

#### 3. 設定環境變數
在 Railway 專案設定中添加以下環境變數：
```
LINE_CHANNEL_ACCESS_TOKEN=實際的Token值
LINE_CHANNEL_SECRET=實際的Secret值
LINE_CHANNEL_ID=實際的ChannelID
LINE_LOGIN_CHANNEL_SECRET=實際的LoginSecret
OPENAI_API_KEY=實際的OpenAI金鑰
LINE_LIFF_ID=實際的LIFF_ID
JWT_SECRET=隨機生成的安全金鑰
NODE_ENV=production
PORT=3000
```

#### 4. 部署完成
- Railway 會提供一個域名，例如：`https://your-app-name.up.railway.app`
- 自動部署需要 2-5 分鐘

## 🔄 選項2：Render 部署 (備用)

### 部署步驟
1. 訪問 [Render.com](https://render.com)
2. 連接 GitHub 帳號
3. 選擇 "Web Service"
4. 連接您的儲存庫
5. 設定：
   - Build Command: `npm install`
   - Start Command: `npm start`
6. 添加環境變數（同上）

## 🔧 部署後設定

### 1. 更新 LINE Developer Console

#### Webhook URL
將 Webhook URL 更新為您的雲端域名：
```
https://your-app-name.up.railway.app/webhook
```

#### LIFF App Endpoint URL
```
https://your-app-name.up.railway.app/liff/tasks
```

#### LINE Login Callback URL
```
https://your-app-name.up.railway.app/auth/line/callback
```

### 2. 測試部署

訪問以下 URL 確認服務正常：
- 主頁：`https://your-app-name.up.railway.app/`
- 健康檢查：`https://your-app-name.up.railway.app/health`
- 管理後台：`https://your-app-name.up.railway.app/admin/dashboard`

## 📱 功能測試

### LINE Bot 測試
1. 傳送 `hello` - 檢查基本回應
2. 傳送 `19:00看電影` - 檢查任務記錄 Flex Message
3. 傳送 `今天我的任務有哪些？` - 檢查任務清單
4. 點擊 Flex Message 按鈕 - 檢查 LIFF App

### 管理功能測試
- 會員註冊：訪問 `/auth` 頁面
- 資料庫管理：訪問 `/admin/dashboard`
- LIFF App：訪問 `/liff/tasks`

## 🔄 持續部署

### 自動部署設定
一旦設定完成，每次推送到 GitHub main 分支都會自動部署：
```bash
git add .
git commit -m "🔧 更新功能"
git push origin main
```

### 查看部署日誌
- Railway：在專案儀表板查看 "Deployments" 標籤
- Render：在儀表板查看 "Logs" 部分

## 🛠️ 故障排除

### 常見問題

#### 1. 部署失敗
```bash
# 檢查 package.json 是否正確
# 確認所有依賴都已安裝
npm install
npm start  # 本地測試
```

#### 2. 環境變數錯誤
- 確認所有必要的環境變數都已設定
- 檢查變數名稱拼寫是否正確
- 避免在值中包含多餘的空格或引號

#### 3. 資料庫問題
- SQLite 在雲端環境中會自動建立
- 每次重新部署會清空記憶體資料
- 資料庫檔案會持久化在雲端檔案系統中

#### 4. LINE Webhook 連接問題
- 確認 Webhook URL 設定正確
- 檢查 SSL 憑證是否有效（雲端平台自動提供）
- 驗證 Channel Secret 設定是否正確

## 📊 監控和維護

### 應用程式監控
- Railway: 內建監控儀表板
- 自訂監控: 訪問 `/admin/dashboard` 查看統計

### 日誌查看
- 雲端平台提供即時日誌查看
- 系統日誌儲存在資料庫中，可透過管理介面查看

### 效能優化
- 免費方案通常有請求次數限制
- 考慮升級到付費方案以獲得更好效能
- 優化資料庫查詢以減少回應時間

## 💡 後續擴展建議

1. **備份策略**: 定期備份資料庫
2. **監控告警**: 設定錯誤通知
3. **效能優化**: 使用 CDN 加速靜態資源
4. **安全性**: 添加 API 限制和驗證
5. **功能擴展**: 增加更多 LIFF 功能

## 🎉 完成！

您的 LINE Bot 現在已在雲端運行，享受 24/7 的穩定服務！