# 📋 LINE Bot 任務管理系統 - 產品需求文件 (PRD)

## 🎯 產品概覽

### 產品名稱
**記記 LINE Bot** (@331tabaz) - 智能任務管理系統

### 產品版本
**v2.0.0** - 簡化增強版

### 產品定位
基於 LINE 平台的個人任務管理助手，專注於簡潔高效的任務追蹤和視覺化呈現，配備自動化數據備份系統。

---

## 🚀 產品願景與目標

### 願景聲明
成為用戶日常生活中最簡單、最直觀的任務管理工具，讓任務記錄和追蹤變得像聊天一樣自然。

### 核心目標
- **簡化操作**：傳訊息即可新增任務，零學習成本
- **視覺化呈現**：美觀的 Flex Message 介面顯示任務列表  
- **數據安全**：自動備份到 GitHub，永不丟失
- **即時回饋**：任務狀態即時更新和確認

---

## 👥 目標用戶

### 主要用戶群體
1. **個人工作者**：需要簡單任務管理的上班族
2. **學生族群**：課業和個人事務管理需求
3. **忙碌家庭**：日常事務和待辦事項追蹤
4. **LINE 重度使用者**：習慣在 LINE 上處理各種事務

### 用戶痛點
- ❌ 傳統任務管理 APP 過於複雜
- ❌ 需要安裝額外應用程式
- ❌ 擔心任務數據丟失
- ❌ 介面不夠直觀美觀

---

## ✨ 核心功能

### 1. 任務管理功能

#### 1.1 任務新增
**功能描述**：用戶在 LINE 中發送任何文字訊息即可新增任務

**用戶流程**：
1. 用戶在 LINE 中發送訊息（如："完成專案報告"）
2. 系統自動將訊息內容儲存為任務
3. 立即回傳視覺化的任務確認

**技術實現**：
```javascript
// 接收 LINE Webhook → 解析訊息 → 儲存任務 → 回傳 Flex Message
const newTask = {
  id: Date.now().toString(),
  text: messageText,
  createdAt: new Date().toISOString(),
  date: today,
  userId: userId,
  completed: false
};
```

#### 1.2 任務列表顯示
**功能描述**：以美觀的 Flex Message 格式顯示當日所有任務

**視覺設計**：
- 🟡 **黃色背景** - 溫暖友善的視覺風格
- 📋 **標題顯示** - "今天 X 件事要做"
- 🔢 **編號列表** - 清晰的任務順序
- ☐ **完成狀態** - 視覺化的勾選框
- 🔘 **操作按鈕** - "📋 全部紀錄" 和 "👤 個人帳號"

**技術實現**：
```javascript
// Flex Message 結構
{
  type: 'flex',
  altText: `今天 ${todayTasks.length} 件事要做`,
  contents: {
    type: 'bubble',
    styles: { body: { backgroundColor: '#F4D03F' } },
    // ... 詳細布局結構
  }
}
```

### 2. 數據持久化與備份

#### 2.1 GitHub 自動備份
**功能描述**：每個任務操作自動提交到 GitHub 倉庫

**自動備份觸發點**：
- ✅ 新增任務
- ✅ 更新任務
- ✅ 完成任務
- ✅ 刪除任務

**技術架構**：
```javascript
// enhanced-auto-git.js 核心功能
class AutoGitCommit {
  addCommit(message, details) {
    // 批次處理機制 - 3秒內操作合併
    // 自動提交 → 推送到 GitHub
  }
}
```

**備份策略**：
- **智能合併**：3秒內的多個操作合併為一個提交
- **防頻繁提交**：避免過多的 Git 歷史記錄
- **自動推送**：`git push origin main` 確保雲端同步

#### 2.2 本地數據儲存
**功能描述**：記憶體儲存確保會話期間的數據完整性

**儲存結構**：
```javascript
// 用戶任務映射
const tasks = new Map(); // userId -> tasks array

// 任務數據結構
{
  id: '時間戳字符串',
  text: '任務內容',
  createdAt: 'ISO時間字符串',
  date: 'YYYY-MM-DD',
  userId: 'LINE用戶ID',
  completed: Boolean
}
```

---

## 🏗️ 系統架構

### 技術棧
- **後端框架**：Node.js + Express.js
- **LINE 整合**：@line/bot-sdk v10.2.0
- **部署平台**：Railway / Local with ngrok
- **版本控制**：Git + GitHub 自動備份
- **開發工具**：dotenv、axios、nodemon

### 核心模組

#### 1. simple-linebot-basic.js
**主要功能**：簡化版 LINE Bot 核心服務
- Webhook 事件處理
- Flex Message 生成
- 任務 CRUD 操作
- 錯誤處理和備案機制

#### 2. enhanced-auto-git.js  
**主要功能**：智能 Git 自動提交系統
- 批次提交處理
- GitHub 自動推送
- 提交訊息格式化
- 統計和監控功能

#### 3. 診斷和測試工具
**檔案列表**：
- `diagnose-token.js` - LINE Token 有效性檢查
- `test-task-stack-flex.js` - Flex Message 功能測試
- `update-webhook-new.js` - Webhook URL 更新工具

### 部署架構

```
📱 LINE 用戶端
      ↓ Webhook
🌐 LINE 平台
      ↓ HTTPS
☁️  部署服務 (Railway/ngrok)
      ↓ 處理
🖥️  Node.js 應用
      ↓ 自動備份
📚 GitHub 倉庫
```

---

## 🎨 用戶介面設計

### Flex Message 設計規範

#### 視覺元素
- **主色調**：#F4D03F (溫暖黃色)
- **文字顏色**：#333333 (深灰色)
- **強調色**：#00B900 (綠色 - 完成狀態)
- **輔助色**：#CCCCCC (淺灰 - 未完成)

#### 布局結構
```
┌─────────────────────────┐
│     今天 X 件事要做      │ ← 標題
├─────────────────────────┤
│ 1. □ 任務內容一         │ ← 任務列表
│ 2. ☑ 任務內容二         │
│ 3. □ 任務內容三         │
├─────────────────────────┤
│ 已完成 X 件，待完成 Y 件  │ ← 統計資訊
├─────────────────────────┤
│ [📋全部紀錄][👤個人帳號] │ ← 操作按鈕
└─────────────────────────┘
```

### 互動設計
- **輸入方式**：自然語言文字輸入
- **即時回饋**：訊息發送後立即收到 Flex Message 回應  
- **視覺確認**：清楚的任務計數和完成狀態顯示

---

## 📊 功能規格

### 核心功能清單

| 功能模組 | 功能名稱 | 實現狀態 | 優先級 |
|---------|---------|---------|--------|
| 任務管理 | 文字訊息新增任務 | ✅ 已實現 | P0 |
| 任務管理 | Flex Message 列表顯示 | ✅ 已實現 | P0 |
| 任務管理 | 任務完成狀態切換 | ⚠️ 部分實現 | P1 |
| 數據備份 | GitHub 自動提交 | ✅ 已實現 | P0 |
| 數據備份 | 批次處理機制 | ✅ 已實現 | P1 |
| 系統穩定 | 錯誤處理機制 | ✅ 已實現 | P0 |
| 系統穩定 | Webhook 驗證 | ⚠️ 測試環境關閉 | P1 |

### 已移除功能 (v2.0 簡化)
- ❌ 語音識別功能
- ❌ 任務提醒系統
- ❌ Google 日曆整合
- ❌ 複雜的 LIFF 應用
- ❌ 用戶認證系統
- ❌ 資料庫持久化

---

## 🚀 部署與運維

### 環境需求
- **Node.js**：≥18.0.0
- **npm**：≥8.0.0
- **Git**：任何版本（用於自動備份）

### 環境變數配置
```env
# .env 檔案內容
LINE_CHANNEL_ACCESS_TOKEN=你的LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET=你的LINE_CHANNEL_SECRET
PORT=3016
```

### 部署選項

#### 選項 1：Railway 雲端部署
- ✅ 自動 HTTPS
- ✅ 零配置部署
- ✅ 自動重啟
- ❌ 可能有冷啟動延遲

#### 選項 2：本地 + ngrok
- ✅ 開發調試方便
- ✅ 即時代碼修改
- ✅ 完全控制
- ❌ 需要保持電腦運行

### 監控與維護
```javascript
// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Git 統計端點 (未來功能)
app.get('/api/git-stats', (req, res) => {
  // 回傳 Git 提交統計資訊
});
```

---

## 🧪 測試策略

### 測試工具
1. **diagnose-token.js** - LINE Channel Access Token 驗證
2. **test-task-stack-flex.js** - Flex Message 功能完整性測試
3. **test-railway-webhook.js** - 雲端服務連接測試

### 測試場景
- ✅ 訊息接收和處理
- ✅ Flex Message 結構驗證
- ✅ Git 自動提交功能
- ✅ 錯誤處理和備案機制
- ⚠️ 實際 LINE 用戶端測試 (需要真實 replyToken)

---

## 📈 成功指標

### 技術指標
- **可用性**：99.9% 服務正常運行時間
- **回應速度**：< 3 秒任務確認回應
- **數據完整性**：100% 任務數據 GitHub 備份率

### 用戶體驗指標
- **操作簡易度**：單一文字輸入即可完成任務新增
- **視覺滿意度**：美觀的 Flex Message 介面
- **數據安全感**：自動 GitHub 備份確保數據不丟失

---

## 🔮 未來發展規劃

### Phase 1 - 核心穩定 (當前)
- ✅ 基礎任務管理功能
- ✅ Flex Message 視覺呈現  
- ✅ GitHub 自動備份

### Phase 2 - 功能增強 (未來)
- 📝 任務編輯和刪除功能
- ✅ 任務完成狀態切換
- 📅 任務分類和標籤系統
- 🔔 簡化版提醒功能

### Phase 3 - 進階功能 (規劃中)
- 📊 任務統計和分析報表
- 🔗 第三方整合 (Google Calendar)
- 👥 團隊協作功能
- 🎨 自訂 Flex Message 樣式

---

## 🏆 競品分析

### 優勢
- ✅ **零學習成本**：基於熟悉的 LINE 平台
- ✅ **極簡操作**：發送訊息即可新增任務
- ✅ **視覺美觀**：精心設計的 Flex Message 介面
- ✅ **數據安全**：自動 GitHub 備份機制
- ✅ **無需安裝**：直接在 LINE 中使用

### 劣勢
- ❌ **功能限制**：相比專業任務管理工具功能較少
- ❌ **平台依賴**：依賴 LINE 平台穩定性
- ❌ **多人協作**：暫不支援團隊功能

---

## 📞 技術支援

### 開發團隊
- **主要開發**：Claude AI Assistant
- **專案管理**：用戶主導的敏捷開發

### 支援資源
- **程式碼倉庫**：GitHub - linebot-project-manager
- **部署平台**：Railway / Local with ngrok
- **文件資源**：AUTO_GIT_README.md、PRD_產品需求文件.md

### 故障排除
```javascript
// 常見問題診斷流程
1. 檢查服務健康狀態：GET /health
2. 驗證 LINE Token：node diagnose-token.js  
3. 測試 Webhook 連接：node test-task-stack-flex.js
4. 檢查 Git 提交狀態：git log --oneline -5
```

---

## 📄 版本歷史

### v2.0.0 (2025-08-30) - 簡化增強版
- ✨ 全新簡化架構設計
- ✨ 優化 Flex Message 視覺呈現
- ✨ 強化 GitHub 自動備份系統
- 🗑️ 移除複雜功能，專注核心體驗

### v1.x (歷史版本)
- 🏗️ 複雜功能全整合版本
- 🎤 語音識別功能
- 📅 Google 日曆整合
- 👤 用戶認證系統
- 💾 完整資料庫支援

---

**文件建立日期**：2025-08-30  
**文件版本**：v1.0  
**最後更新**：2025-08-30 20:30:00  

---

*本產品需求文件由 Claude AI Assistant 根據實際產品功能和技術架構編寫完成。如有任何疑問或建議，請透過 GitHub Issues 聯繫開發團隊。* 🚀