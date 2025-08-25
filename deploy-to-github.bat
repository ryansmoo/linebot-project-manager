@echo off
chcp 65001 >nul
echo 🚀 準備部署到 GitHub + 雲端服務
echo =====================================

echo 📋 檢查 Git 狀態...
if not exist ".git" (
    echo 🔧 初始化 Git repository...
    git init
    git branch -M main
)

echo 📝 添加檔案到 Git...
git add .
git status

echo.
echo 📤 準備提交...
set /p commit_message="輸入提交訊息 (預設: Deploy LINE Bot): "
if "%commit_message%"=="" set commit_message=Deploy LINE Bot with LIFF support

git commit -m "%commit_message%"

echo.
echo 🔗 GitHub Repository 設定
echo =====================================
echo 1. 前往 GitHub 建立新的 repository
echo 2. 複製 repository URL (例如: https://github.com/username/linebot-project.git)
echo 3. 回來按任意鍵繼續...
pause

set /p repo_url="請輸入 GitHub repository URL: "
if not "%repo_url%"=="" (
    git remote add origin %repo_url%
    echo 📤 推送到 GitHub...
    git push -u origin main
    echo ✅ 成功推送到 GitHub!
)

echo.
echo 🌟 下一步: 選擇雲端部署服務
echo =====================================
echo 推薦選項:
echo 1. Railway (https://railway.app) - 推薦
echo    - 連接 GitHub repository
echo    - 自動部署
echo    - 設定環境變數
echo.
echo 2. Render (https://render.com) - 免費
echo    - 連接 GitHub repository  
echo    - 設定為 Web Service
echo    - 添加環境變數
echo.
echo 🔑 需要設定的環境變數:
echo LINE_CHANNEL_ACCESS_TOKEN=您的_Access_Token
echo LINE_CHANNEL_SECRET=您的_Channel_Secret  
echo LINE_LIFF_ID=您的_LIFF_ID
echo PORT=3000
echo NODE_ENV=production
echo.
echo ✅ 完成後您將獲得穩定的 HTTPS URL!
pause