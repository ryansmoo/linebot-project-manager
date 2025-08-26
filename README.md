# 📝 記事機器人 LINE Bot

這是一個功能強大的記事機器人，整合了ChatGPT AI，能幫您記錄、管理今日待辦事項，並提供精美的Flex Message視覺體驗。

## 🌟 功能特色

- 📋 **任務記錄與管理**：智能識別並記錄您的待辦事項
- 🎤 **語音識別功能**：**支援語音轉文字記錄任務** ✨NEW✨
- 📱 **精美Flex Message**：專業級卡片式視覺回覆
- 🌐 **任務網頁介面**：**精美的網頁任務管理系統**
- 📅 **Google Calendar 整合**：**自動同步帶時間的任務到 Google 日曆**
- 🔧 **多種互動模式**：
  - `20:00 回家吃飯` - **任務記錄** + 確認卡片 + **📅 上傳日曆按鈕**
  - 🎙️ **語音訊息** - **語音轉文字** + **自動建立任務**
  - `今天我的任務有哪些？` - **任務清單** + **網頁介面按鈕**
  - `hello` - 記事機器人歡迎訊息
  - `/help` 或 `幫助` - 功能說明
  - 其他問題 - ChatGPT AI智能回覆
- 🧠 **ChatGPT AI整合**：非任務相關問題的智能問答
- 📊 **網頁功能**：響應式設計、自動刷新、動畫效果、統計資訊
- 🔒 **用戶隔離**：每個用戶獨立的任務儲存和網頁
- 🚀 **自動化部署**：一鍵啟動腳本

## 安裝步驟

1. 安裝依賴套件：
   ```bash
   npm install
   ```

2. 建立 `.env` 檔案（參考 `.env.example`）：
   ```env
   LINE_CHANNEL_ACCESS_TOKEN=你的_channel_access_token
   LINE_CHANNEL_SECRET=你的_channel_secret
   PORT=3000
   
   # OpenAI API 設定
   OPENAI_API_KEY=你的_openai_api_key
   OPENAI_MODEL=gpt-3.5-turbo
   
   # Google Calendar 設定（選用）
   GOOGLE_CLIENT_ID=你的_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=你的_google_oauth_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```

3. 啟動機器人：
   ```bash
   npm start
   ```

   或使用開發模式（自動重啟）：
   ```bash
   npm run dev
   ```

## LINE Developer Console 設定

1. 在 LINE Developer Console 建立新的 Channel
2. 取得 Channel Access Token 和 Channel Secret
3. 設定 Webhook URL 為：`https://你的域名/webhook`
4. 啟用 Webhook

## 📁 檔案說明

- `app.js` - 記事機器人主程式（整合ChatGPT + 任務管理）
- `package.json` - 專案配置和依賴（包含OpenAI套件）
- `.env.example` - 環境變數範本（含OpenAI設定）
- `README.md` - 使用說明
- `OPENAI_SETUP.md` - OpenAI API設定詳細指南
- **`MEMO_BOT_GUIDE.md`** - **記事機器人完整指南**
- **`WEB_INTERFACE_GUIDE.md`** - **任務網頁介面使用指南**
- **`VOICE_RECOGNITION_GUIDE.md`** - **語音識別功能使用指南**
- **`DEPLOYMENT_GUIDE.md`** - **自動部署指南** ✨NEW✨
- `FLEX_MESSAGE_GUIDE.md` - Flex Message功能說明
- `start-with-localtunnel.sh` - 自動化啟動腳本（推薦）
- `stop-services.sh` - 停止服務腳本
- `status.sh` - 服務狀態檢查腳本

## 🚀 快速開始（推薦）

使用自動化腳本一鍵啟動：

```bash
./start-bot-with-ngrok.sh
```

此腳本會自動：
- 啟動 LINE Bot
- 啟動 ngrok tunnel
- 顯示 Webhook URL
- 提供管理介面連結

## 🛠️ 管理指令

| 功能 | 指令 |
|------|------|
| 🚀 **一鍵自動部署** | `auto-deploy.bat` (Windows) / `./auto-deploy.sh` (Linux/Mac) |
| 🚀 啟動服務 | `./start-bot-with-ngrok.sh` |
| 🛑 停止服務 | `./stop-services.sh` |
| 🔗 獲取 Webhook URL | `./get-webhook-url.sh` |
| 📊 查看服務狀態 | `./status.sh` |
| 📋 查看 Bot 日誌 | `tail -f bot.log` |
| 🌐 Ngrok 管理介面 | http://localhost:4040 |

## 📱 測試步驟

1. 執行 `./start-bot-with-ngrok.sh` 啟動服務
2. 複製顯示的 Webhook URL
3. **設定OpenAI API金鑰**（重要！）
   - 請參考 `OPENAI_SETUP.md` 詳細說明
   - 在 `.env` 檔案中填入您的OpenAI API金鑰

4. 在 [LINE Developer Console](https://developers.line.biz/console/) 設定 Webhook URL

5. **測試記事功能**：
   - 傳送 `hello` - 獲得記事機器人歡迎訊息
   - 傳送 `17:00小美約會` - **記錄任務** + 確認卡片 + **網頁連結**
   - 🎤 **發送語音訊息** - **語音轉文字** + **自動建立任務**
   - 點擊卡片按鈕 - **開啟精美的任務網頁介面**
   - 傳送 `今天我的任務有哪些？` - **任務清單** + **網頁按鈕**
   - 傳送 `/help` 或 `幫助` - 查看功能說明  
   - 傳送其他問題 - 獲得ChatGPT AI回覆

## 🔧 手動啟動（進階）

如果需要手動控制：

1. 啟動 LINE Bot：
   ```bash
   npm start
   ```

2. 開啟新終端機，啟動 ngrok：
   ```bash
   ngrok http 3000
   ```

## 📊 監控與除錯

- **服務狀態**: `./status.sh`
- **Bot 日誌**: `tail -f bot.log`
- **Ngrok 日誌**: `tail -f ngrok.log`
- **Ngrok 管理介面**: http://localhost:4040

## 📅 Google Calendar 整合功能

### 🎯 功能說明
當用戶輸入包含時間的任務時，會自動顯示「📅 上傳日曆」按鈕，可將任務同步到 Google Calendar。

### 📝 使用範例
```
用戶輸入：20:00 回家吃飯
系統回覆：[Flex Message 卡片]
         📝 任務已記錄
         您的任務：20:00 回家吃飯
         ⏰ 時間：20:00
         [📝 編輯] [📅 上傳日曆]
```

### ⚙️ 詳細設定
請參考 [`GOOGLE_CALENDAR_SETUP.md`](./GOOGLE_CALENDAR_SETUP.md) 獲得完整的設定指南。

### 支援的時間格式
- `HH:MM` - 例如：`09:30`、`14:00`
- `H:MM` - 例如：`9:30`
- 支援中文冒號：`18：30`

## ⚠️ 重要注意事項

- 每次重啟 ngrok，Webhook URL 會改變，需重新設定
- 免費版 ngrok 有連線時間限制
- 請勿將 `.env` 檔案提交到版本控制系統
- Google Calendar 功能需要額外的 OAuth 設定（參考設定指南）