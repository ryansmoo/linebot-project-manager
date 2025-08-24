# Google Calendar 整合設定指南

## 🎯 完整設定步驟

### 1. Google Cloud Console 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Calendar API：
   - 在左側選單選擇「API 和服務」>「程式庫」
   - 搜尋「Google Calendar API」並啟用

4. 建立 OAuth 2.0 憑證：
   - 選擇「API 和服務」>「憑證」
   - 點擊「建立憑證」>「OAuth 用戶端 ID」
   - 應用程式類型選擇「網路應用程式」
   - 設定重新導向 URI（稍後會用到）

### 2. Google Apps Script 部署

1. 前往 [Google Apps Script](https://script.google.com/)
2. 建立新專案
3. 將 `google-apps-script-calendar.js` 中的程式碼複製貼上
4. 在程式碼中替換以下變數：
   ```javascript
   const clientId = 'YOUR_GOOGLE_CLIENT_ID';
   const clientSecret = 'YOUR_GOOGLE_CLIENT_SECRET';
   ```

5. 部署為網路應用程式：
   - 點擊「部署」>「新增部署」
   - 類型選擇「網路應用程式」
   - 執行身分選擇「執行應用程式的使用者」
   - 存取權限選擇「所有人」
   - 複製部署的網路應用程式 URL

6. 回到 Google Cloud Console 設定重新導向 URI：
   - 在 OAuth 憑證設定中新增重新導向 URI：
   - `YOUR_GOOGLE_APPS_SCRIPT_URL?action=callback&lineUserId=*`

### 3. LINE Bot 設定

1. 在 `LINE BOT/app.js` 中替換：
   ```javascript
   const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL';
   ```

2. 確保已安裝 axios：
   ```bash
   npm install axios
   ```

## 🚀 使用方式

### 使用者操作流程

1. **第一次使用 - 授權綁定**
   - 在 LINE 中輸入：`綁定行事曆`
   - 點擊彈出的按鈕進行 Google 授權
   - 完成授權後即可開始使用

2. **新增行事曆事件**
   ```
   新增事件 會議標題|2024-12-25 14:00|2024-12-25 15:00|會議描述
   ```

3. **查看近期行程**
   ```
   查看行程
   ```

4. **查看幫助**
   ```
   行事曆幫助
   ```

### 支援的指令

| 指令 | 說明 | 範例 |
|------|------|------|
| `綁定行事曆` | 授權綁定 Google Calendar | - |
| `新增事件 標題\|開始時間\|結束時間\|描述` | 新增行事曆事件 | `新增事件 開會\|2024-12-25 14:00\|2024-12-25 15:00\|重要會議` |
| `查看行程` | 顯示近期10個行程 | - |
| `行事曆幫助` | 顯示使用說明 | - |

## 🔧 技術架構

```
LINE Bot → Google Apps Script → Google Calendar API
    ↓              ↓                    ↓
使用者訊息    OAuth授權處理        個人行事曆操作
```

### 架構優勢

1. **穩定性高**：Google 自家服務間整合
2. **無伺服器**：使用 Google Apps Script 免費託管
3. **個人化**：每個使用者綁定自己的 Google 帳號
4. **安全性**：OAuth 2.0 標準授權流程

## 🛠️ 故障排除

### 常見問題

1. **授權失敗**
   - 檢查 Google Cloud Console OAuth 設定
   - 確認重新導向 URI 設定正確
   - 檢查 Client ID 和 Secret 是否正確

2. **新增事件失敗**
   - 確認時間格式正確 (YYYY-MM-DD HH:MM)
   - 檢查使用者是否已完成授權
   - 查看 Google Apps Script 執行記錄

3. **無法查看行程**
   - 確認 Google Calendar API 已啟用
   - 檢查存取權限設定

### 除錯方法

1. **Google Apps Script 記錄**
   - 在 Google Apps Script 中查看「執行」記錄
   - 使用 `console.log()` 輸出除錯資訊

2. **LINE Bot 記錄**
   - 檢查伺服器 console 輸出
   - 確認 API 請求回應狀態

## 📝 注意事項

1. **時間格式**：必須使用 `YYYY-MM-DD HH:MM` 格式
2. **分隔符號**：使用直線符號 `|` 分隔參數
3. **授權有效期**：Google OAuth token 會過期，需要實作 refresh token 機制
4. **用量限制**：Google Calendar API 有請求限制，注意用量管控

## 🔐 安全考量

1. **敏感資訊保護**
   - Client Secret 不應暴露在前端
   - 使用 Google Apps Script 作為中介層
   - 定期輪換 OAuth 憑證

2. **使用者隱私**
   - 只存取使用者授權的行事曆
   - 不儲存不必要的個人資訊
   - 遵循 GDPR 等隱私法規

---

🎉 完成設定後，你的 LINE Bot 就能讓每個使用者綁定自己的 Google Calendar 了！