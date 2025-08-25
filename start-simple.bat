@echo off
chcp 65001 >nul
echo 🚀 啟動精簡版 LINE Bot 服務
echo =====================================

echo 📋 檢查環境...
if not exist "node_modules\" (
    echo ❌ 找不到 node_modules，請先執行 npm install
    pause
    exit /b 1
)

if not exist ".env" (
    echo ❌ 找不到 .env 檔案，請先複製 env.example 並設定環境變數
    pause
    exit /b 1
)

echo ✅ 環境檢查完成

echo.
echo 📡 啟動 LINE Bot 服務...
echo 🔗 本地端口: 3000
echo 📱 LIFF 任務頁面: http://localhost:3000/liff/tasks.html
echo 👤 LIFF 個人頁面: http://localhost:3000/liff/profile.html
echo 🔗 Webhook URL: http://localhost:3000/webhook
echo.
echo ⚠️  請將 Webhook URL 設定到 LINE Developer Console
echo 📝 按 Ctrl+C 停止服務
echo =====================================
echo.

node simple-linebot.js