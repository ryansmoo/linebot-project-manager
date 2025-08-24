# Supabase 設定指南

## 🚀 快速開始

### 1. 建立 Supabase 專案

1. 前往 [Supabase](https://supabase.com/) 並註冊帳號
2. 建立新專案
3. 等待專案初始化完成

### 2. 執行資料庫結構

1. 在 Supabase Dashboard 中，前往 **SQL Editor**
2. 複製 `supabase-schema.sql` 檔案的內容
3. 在 SQL Editor 中貼上並執行

### 3. 取得 API 憑證

1. 在 Supabase Dashboard 中，前往 **Settings** → **API**
2. 複製以下資訊：
   - **Project URL** (格式：`https://xxxxx.supabase.co`)
   - **API Key** (anon public key)

### 4. 設定環境變數

1. 複製 `env.example` 檔案並重新命名為 `.env`
2. 填入你的 Supabase 憑證：

```env
SUPABASE_URL=https://你的專案ID.supabase.co
SUPABASE_ANON_KEY=你的_SUPABASE_ANON_KEY
```

## 📊 資料庫結構

### 主要資料表

1. **user_messages** - 記錄所有用戶訊息
2. **user_tasks** - 用戶任務管理
3. **users** - 用戶基本資料
4. **user_activity_stats** - 用戶活動統計

### 資料流程

```
用戶傳送訊息 → LINE Bot → 
├─ 記錄到 user_messages 表
├─ 解析任務 → 記錄到 user_tasks 表
├─ 更新 users 表的最後活動時間
└─ 更新 user_activity_stats 表的統計
```

## 🔧 功能特色

### ✅ 已實作的功能

- **訊息記錄**：所有用戶訊息都會自動記錄到 Supabase
- **任務管理**：任務創建、查詢、狀態管理
- **時間解析**：自動解析訊息中的時間資訊
- **用戶追蹤**：記錄用戶活動和統計資料
- **備援機制**：如果 Supabase 連接失敗，會退回到記憶體儲存

### 🎯 保持不變的功能

- **Flex Message 格式**：完全保持原本的美觀格式
- **用戶體驗**：使用者完全感覺不到後端改動
- **所有指令**：「任務」、「今日任務」、「幫助」等指令正常運作

## 🛠️ 使用方式

### 啟動服務

```bash
# 安裝依賴
npm install

# 設定環境變數 (.env 檔案)
cp env.example .env
# 編輯 .env 檔案填入你的憑證

# 啟動服務
npm start
```

### 測試連接

```bash
# 執行 Supabase 連接測試
node -e "require('./supabase-config').testConnection()"
```

## 📝 API 說明

### 主要函數

- `supabaseConfig.logMessage(messageData)` - 記錄訊息
- `supabaseConfig.addTask(taskData)` - 新增任務
- `supabaseConfig.getUserTasks(userId)` - 取得用戶任務
- `supabaseConfig.getUserMessages(userId)` - 取得用戶訊息歷史

### 資料格式

```javascript
// 訊息格式
{
  line_user_id: "U1234567890",
  message_type: "text",
  direction: "incoming",
  content: "明天14:00開會",
  raw_data: { /* LINE event 原始資料 */ }
}

// 任務格式
{
  line_user_id: "U1234567890",
  task_text: "明天14:00開會",
  task_time: "14:00",
  has_time: true,
  status: "active"
}
```

## 🔍 監控和除錯

### Supabase Dashboard

1. **Table Editor**：直接查看和編輯資料
2. **SQL Editor**：執行自定義查詢
3. **Logs**：查看 API 請求記錄
4. **Auth**：管理用戶認證（如有需要）

### 常用查詢

```sql
-- 查看最近訊息
SELECT * FROM user_messages 
ORDER BY created_at DESC 
LIMIT 10;

-- 查看用戶任務統計
SELECT line_user_id, COUNT(*) as task_count 
FROM user_tasks 
WHERE status = 'active' 
GROUP BY line_user_id;

-- 查看今日任務
SELECT * FROM user_tasks 
WHERE task_date = CURRENT_DATE 
AND status = 'active';
```

## 🚨 注意事項

1. **RLS 政策**：目前設定為允許所有操作，正式環境請調整安全政策
2. **API 限制**：Supabase 免費方案有使用限制，注意用量
3. **資料備份**：重要資料請定期備份
4. **環境變數**：`.env` 檔案不要提交到 Git

## 🎉 完成！

設定完成後，你的 LINE Bot 就會：
- ✅ 自動記錄所有用戶訊息到 Supabase
- ✅ 智能解析並儲存用戶任務
- ✅ 提供完整的任務管理功能
- ✅ 保持原本美觀的 Flex Message 介面

所有資料都會安全地儲存在 Supabase 雲端資料庫中！