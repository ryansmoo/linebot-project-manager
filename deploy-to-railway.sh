#!/bin/bash

# LINE Bot Railway 自動部署腳本
echo "🚀 LINE Bot Railway 自動部署開始..."

# 檢查 Railway CLI 是否已安裝
if ! command -v railway &> /dev/null; then
    echo "📦 安裝 Railway CLI..."
    npm install -g @railway/cli
fi

# 檢查是否在專案目錄中
if [ ! -f "package.json" ]; then
    echo "❌ 請在專案根目錄執行此腳本"
    exit 1
fi

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo "❌ 找不到 .env 檔案"
    echo "📝 請確保您已設定環境變數"
    exit 1
fi

echo "✅ 環境檢查完成"

# 提交最新更改到 Git
echo "📝 準備 Git 提交..."
git add .
git status

read -p "是否要提交目前的更改？(y/N): " commit_choice
if [[ $commit_choice =~ ^[Yy]$ ]]; then
    read -p "輸入提交訊息: " commit_message
    if [ -z "$commit_message" ]; then
        commit_message="🚀 Deploy: Google Calendar integration feature"
    fi
    git commit -m "$commit_message"
    echo "✅ Git 提交完成"
else
    echo "⏭️  跳過 Git 提交"
fi

# 推送到 GitHub
echo "📤 推送到 GitHub..."
git push origin main
if [ $? -eq 0 ]; then
    echo "✅ GitHub 推送成功"
else
    echo "❌ GitHub 推送失敗，請檢查權限"
    exit 1
fi

echo ""
echo "🎯 下一步：手動設定 Railway"
echo "================================"
echo ""
echo "請按照以下步驟操作："
echo ""
echo "1. 📋 前往 Railway.app:"
echo "   https://railway.app"
echo ""
echo "2. 🔑 使用 GitHub 帳號登入"
echo ""
echo "3. 🚀 點擊 'Deploy from GitHub repo'"
echo ""
echo "4. 📁 選擇您的儲存庫："
echo "   ryansmoo/linebot-project-manager"
echo ""
echo "5. ⚙️  設定環境變數（重要！）："

# 讀取並顯示 .env 檔案內容（隱藏敏感資訊）
echo "   複製以下環境變數到 Railway:"
echo ""
while IFS='=' read -r key value; do
    if [[ $key && ! $key =~ ^# ]]; then
        if [[ $key =~ (SECRET|TOKEN|KEY) ]]; then
            echo "   $key=***隱藏***"
        else
            echo "   $key=$value"
        fi
    fi
done < .env

echo "   NODE_ENV=production"
echo "   PORT=3000"
echo ""
echo "6. 🎉 等待部署完成（2-5分鐘）"
echo ""
echo "7. 🔗 記下您的 Railway 應用程式 URL"
echo "   格式通常是: https://your-app-name.up.railway.app"
echo ""
echo "8. 📱 更新 LINE Developer Console:"
echo "   - Webhook URL: https://your-url.up.railway.app/webhook"
echo "   - LIFF Endpoint: https://your-url.up.railway.app/liff/tasks"
echo "   - OAuth Callback: https://your-url.up.railway.app/auth/line/callback"
echo ""

# 創建 Railway URL 記錄檔案
cat > railway-deployment-info.md << EOF
# 🚀 Railway 部署資訊

## 📅 部署日期
$(date '+%Y-%m-%d %H:%M:%S')

## 🔗 Railway 應用程式 URL
請在完成部署後更新此處：
\`\`\`
https://your-app-name.up.railway.app
\`\`\`

## 🔧 需要更新的 LINE Settings

### Webhook URL
\`\`\`
https://your-app-name.up.railway.app/webhook
\`\`\`

### LIFF App Endpoint URL  
\`\`\`
https://your-app-name.up.railway.app/liff/tasks
\`\`\`

### LINE Login Callback URL
\`\`\`
https://your-app-name.up.railway.app/auth/line/callback
\`\`\`

### Google Calendar OAuth Redirect URI
\`\`\`
https://your-app-name.up.railway.app/auth/google/callback
\`\`\`

## 📝 測試清單

- [ ] 健康檢查: https://your-url/health
- [ ] 主頁: https://your-url/
- [ ] LINE Bot 回應測試
- [ ] 任務記錄功能
- [ ] Google Calendar 整合
- [ ] LIFF App 功能
- [ ] 管理後台: https://your-url/admin/dashboard

## 🚀 部署完成後記得：

1. 更新 .env 中的 BASE_URL
2. 重新設定 Google Cloud Console OAuth 重新導向 URI
3. 測試所有功能
4. 記錄實際的 Railway URL 到此檔案

EOF

echo "📋 部署資訊已儲存到 railway-deployment-info.md"
echo ""
echo "🎯 準備完成！現在請前往 Railway.app 完成部署"
echo "📋 部署完成後，請更新 railway-deployment-info.md 中的實際 URL"