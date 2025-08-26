@echo off
echo.
echo 🚀 自動部署到 GitHub + Railway
echo ================================
echo.

REM 檢查是否在正確的目錄
if not exist "package.json" (
    echo ❌ 錯誤：請在專案根目錄執行此腳本
    pause
    exit /b 1
)

REM 顯示目前的變更
echo 📋 檢查目前的變更...
git status

echo.
echo 🔍 查看變更差異...
git diff --stat
echo.

REM 詢問是否繼續
set /p continue="是否要提交並部署這些變更？ (y/N): "
if /i not "%continue%"=="y" (
    echo 🛑 已取消部署
    pause
    exit /b 0
)

REM 獲取提交訊息
echo.
set /p commit_msg="📝 請輸入提交訊息（留空使用預設訊息）: "
if "%commit_msg%"=="" (
    set "commit_msg=🔧 功能更新與改進"
)

echo.
echo 📦 正在提交變更...

REM 添加所有變更
git add .

REM 創建提交
git commit -m "%commit_msg%

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

if %errorlevel% neq 0 (
    echo ❌ Git 提交失敗
    pause
    exit /b 1
)

echo ✅ Git 提交成功

echo.
echo 📤 推送到 GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo ❌ GitHub 推送失敗
    pause
    exit /b 1
)

echo ✅ GitHub 推送成功

echo.
echo 🔄 Railway 自動部署已觸發
echo.
echo 📋 Railway 狀態檢查:
echo   - Railway 會自動檢測到 GitHub 更新
echo   - 通常需要 2-5 分鐘完成部署
echo   - 可前往 Railway.app 查看部署進度
echo.

REM 顯示重要資訊
echo 🔗 重要連結:
echo   - GitHub: https://github.com/ryansmoo/linebot-project-manager
echo   - Railway: https://railway.app
echo.

REM 獲取最新的commit資訊
echo 📊 最新提交資訊:
git log -1 --oneline

echo.
echo 🎉 自動部署完成！
echo.
echo 📝 接下來的步驟:
echo   1. 前往 Railway.app 確認部署狀態
echo   2. 等待部署完成 (2-5分鐘)
echo   3. 測試 LINE Bot 功能
echo   4. 如有問題請檢查 Railway 日誌
echo.

pause