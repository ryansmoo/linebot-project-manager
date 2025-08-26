#!/bin/bash

echo ""
echo "🚀 自動部署到 GitHub + Railway"
echo "================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "❌ 錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

# 顯示目前的變更
echo "📋 檢查目前的變更..."
git status

echo ""
echo "🔍 查看變更差異..."
git diff --stat
echo ""

# 詢問是否繼續
read -p "是否要提交並部署這些變更？ (y/N): " continue_deploy
if [[ ! $continue_deploy =~ ^[Yy]$ ]]; then
    echo "🛑 已取消部署"
    exit 0
fi

# 獲取提交訊息
echo ""
read -p "📝 請輸入提交訊息（留空使用預設訊息）: " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="🔧 功能更新與改進"
fi

echo ""
echo "📦 正在提交變更..."

# 添加所有變更
git add .

# 創建提交
git commit -m "$commit_msg

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

if [ $? -ne 0 ]; then
    echo "❌ Git 提交失敗"
    exit 1
fi

echo "✅ Git 提交成功"

echo ""
echo "📤 推送到 GitHub..."
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ GitHub 推送失敗"
    exit 1
fi

echo "✅ GitHub 推送成功"

echo ""
echo "🔄 Railway 自動部署已觸發"
echo ""
echo "📋 Railway 狀態檢查:"
echo "  - Railway 會自動檢測到 GitHub 更新"
echo "  - 通常需要 2-5 分鐘完成部署"
echo "  - 可前往 Railway.app 查看部署進度"
echo ""

# 顯示重要資訊
echo "🔗 重要連結:"
echo "  - GitHub: https://github.com/ryansmoo/linebot-project-manager"
echo "  - Railway: https://railway.app"
echo ""

# 獲取最新的commit資訊
echo "📊 最新提交資訊:"
git log -1 --oneline

echo ""
echo "🎉 自動部署完成！"
echo ""
echo "📝 接下來的步驟:"
echo "  1. 前往 Railway.app 確認部署狀態"
echo "  2. 等待部署完成 (2-5分鐘)"
echo "  3. 測試 LINE Bot 功能"
echo "  4. 如有問題請檢查 Railway 日誌"
echo ""