# 🚀 自動部署指南

## 📋 一鍵自動部署

### Windows 用戶
```bash
# 雙擊執行或在命令提示字元中執行
auto-deploy.bat
```

### Linux/Mac 用戶
```bash
# 在終端中執行
./auto-deploy.sh
```

## 🔄 自動部署流程

### 1. GitHub 自動更新 ✅
- ✅ Git 提交所有變更
- ✅ 推送到 GitHub 主分支
- ✅ 更新儲存庫版本

### 2. Railway 自動部署 🚀
- 🔄 Railway 檢測到 GitHub 更新
- 🔄 自動開始建置和部署
- ⏰ 通常需要 2-5 分鐘完成

### 3. 部署驗證 ✅
- 📊 檢查 Railway 部署狀態
- 🧪 測試 LINE Bot 功能
- 📝 更新部署資訊

## 🔗 重要連結

- **GitHub 儲存庫**: https://github.com/ryansmoo/linebot-project-manager
- **Railway 控制台**: https://railway.app
- **LINE Developer Console**: https://developers.line.biz/console/

## 📊 部署狀態檢查

### Railway 控制台檢查項目：
1. **部署狀態**: 查看最新部署是否成功
2. **建置日誌**: 檢查是否有錯誤
3. **應用程式URL**: 確認服務正常運行
4. **環境變數**: 確保所有必要的環境變數已設定

### LINE Bot 功能測試：
- [ ] 文字訊息回應
- [ ] 🎤 語音識別功能
- [ ] ⏰ 任務時間顯示格式
- [ ] 📝 任務編輯功能
- [ ] 📅 Google Calendar 整合
- [ ] 📱 LIFF 應用程式

## 🛠️ 故障排除

### 常見問題：

1. **Railway 部署失敗**
   - 檢查建置日誌中的錯誤訊息
   - 確認 `package.json` 和 `railway.json` 配置正確
   - 檢查環境變數是否完整

2. **GitHub 推送失敗**
   - 確認 Git 認證設定
   - 檢查網路連接
   - 解決可能的合併衝突

3. **LINE Bot 無回應**
   - 檢查 Railway 應用程式是否正在運行
   - 確認 Webhook URL 設定正確
   - 驗證 LINE Channel Token 和 Secret

## 📈 版本追蹤

每次部署都會：
- 📝 自動生成詳細的提交訊息
- 🏷️ 包含功能說明和技術細節
- 👥 標記 Claude Code 協作貢獻
- 📊 記錄在 Git 歷史中

## 🎯 最佳實踐

### 部署前檢查：
- ✅ 本地測試所有功能
- ✅ 檢查程式碼語法錯誤
- ✅ 確認環境變數設定
- ✅ 驗證 Git 狀態乾淨

### 部署後驗證：
- ✅ 檢查 Railway 部署狀態
- ✅ 測試核心功能
- ✅ 確認新功能正常運作
- ✅ 監控錯誤日誌

---

🎉 **現在您可以使用 `auto-deploy.bat` 或 `auto-deploy.sh` 一鍵完成整個部署流程！**