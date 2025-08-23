# 📅 Google Calendar 整合設定指南

## 🎯 功能介紹

當用戶輸入包含時間的任務（例如：`20:00 回家吃飯`）時，會自動顯示「📅 上傳日曆」按鈕，點擊後可以將任務同步到 Google Calendar。

## 🔧 設定步驟

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Calendar API：
   - 在導航選單中選擇「API和服務」→「程式庫」
   - 搜尋「Google Calendar API」
   - 點擊並啟用

### 2. 設定 OAuth 2.0 憑證

1. 前往「API和服務」→「憑證」
2. 點擊「建立憑證」→「OAuth 2.0 用戶端 ID」
3. 應用程式類型選擇「網路應用程式」
4. 設定名稱（例如：LINE Bot Calendar Integration）
5. 已授權的重新導向 URI 中加入：
   ```
   http://localhost:3000/auth/google/callback
   https://your-domain.com/auth/google/callback
   ```
6. 記下「用戶端 ID」和「用戶端密鑰」

### 3. 設定環境變數

在 `.env` 檔案中加入以下設定：

```env
# Google Calendar OAuth 設定
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 4. 測試設定

1. 重新啟動應用程式
2. 在 LINE Bot 中輸入帶時間的任務：`18:00 開會`
3. 點擊出現的「📅 上傳日曆」按鈕
4. 完成 Google 授權流程

## 🚀 功能說明

### 時間格式支援

系統支援以下時間格式：
- `HH:MM` - 例如：`09:30`、`14:00`
- `H:MM` - 例如：`9:30`
- 支援中文冒號：`18：30`

### 自動處理

1. **時間檢測**：自動識別任務文字中的時間
2. **任務解析**：分離時間和任務內容
3. **日曆事件**：創建 Google Calendar 事件
4. **提醒設定**：自動設定 10 分鐘前彈窗提醒和 1 小時前郵件提醒

### 使用流程

1. 用戶輸入：`20:00 回家吃飯`
2. 系統顯示確認卡片，包含「📅 上傳日曆」按鈕
3. 首次使用需要 Google 授權
4. 授權成功後，任務自動同步到 Google Calendar
5. 在 Google Calendar 中查看事件

## 🛡️ 安全性

- 使用 OAuth 2.0 標準授權流程
- 只請求必要的日曆權限
- 授權資訊安全儲存在記憶體中
- 支援授權撤銷功能

## 🔍 API 端點

### 檢查授權狀態
```
GET /api/calendar/status/:userId
```

### 撤銷授權
```
POST /api/calendar/revoke/:userId
```

### OAuth 回調
```
GET /auth/google/callback
```

## 🐛 故障排除

### 常見問題

1. **授權失敗**
   - 檢查 OAuth 憑證是否正確
   - 確認重新導向 URI 設定正確

2. **無法創建事件**
   - 確認已啟用 Google Calendar API
   - 檢查授權範圍是否包含日曆事件權限

3. **時間格式無法識別**
   - 確保使用 `HH:MM` 或 `H:MM` 格式
   - 支援中英文冒號

### 日誌檢查

查看控制台輸出的相關日誌：
- `✅ Google Calendar API 初始化成功`
- `📅 為用戶 XXX 生成授權 URL`
- `✅ 用戶 XXX Google Calendar 授權成功`
- `✅ 成功為用戶 XXX 創建日曆事件: XXX`

## 📱 使用範例

```
用戶輸入：18:00 和小美約會
系統回覆：[Flex Message 卡片]
         📝 任務已記錄
         您的任務：18:00 和小美約會
         ⏰ 時間：18:00
         [📝 編輯] [📅 上傳日曆]
         ✅ 任務已記錄，可同步到 Google 日曆
```