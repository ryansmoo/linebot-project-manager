#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 項目路徑
PROJECT_DIR="/mnt/c/Users/林憲毅/linebot-project-manager"

echo -e "${BLUE}🤖 啟動 LINE Bot 與 LocalTunnel${NC}"
echo "==============================="

# 清理之前可能存在的進程
echo -e "${YELLOW}🧹 清理之前的進程...${NC}"
pkill -f "node app.js" 2>/dev/null
pkill -f "lt --port" 2>/dev/null
sleep 2

# 切換到專案目錄
cd "$PROJECT_DIR"

# 檢查必要檔案是否存在
if [ ! -f "app.js" ]; then
    echo -e "${RED}❌ 找不到 app.js 檔案！${NC}"
    exit 1
fi

# 啟動 LINE Bot
echo -e "${YELLOW}🚀 啟動 LINE Bot...${NC}"
nohup node app.js > bot.log 2>&1 &
BOT_PID=$!
sleep 3

# 檢查 Bot 是否正常啟動
if ps -p $BOT_PID > /dev/null; then
    echo -e "${GREEN}✅ LINE Bot 已在背景啟動 (PID: $BOT_PID)${NC}"
    echo $BOT_PID > bot.pid
else
    echo -e "${RED}❌ LINE Bot 啟動失敗！檢查 bot.log 了解詳情${NC}"
    exit 1
fi

# 等待 Bot 完全啟動
sleep 2

# 啟動 LocalTunnel
echo -e "${YELLOW}🌐 啟動 LocalTunnel...${NC}"
nohup npx lt --port 3000 > tunnel.log 2>&1 &
LT_PID=$!
echo $LT_PID > tunnel.pid

# 等待 LocalTunnel 啟動
echo -e "${YELLOW}⏳ 等待 LocalTunnel 建立連接...${NC}"
sleep 5

# 嘗試從日誌中獲取 URL
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if [ -f "tunnel.log" ]; then
        TUNNEL_URL=$(grep -o 'https://.*\.loca\.lt' tunnel.log | head -1)
        
        if [ ! -z "$TUNNEL_URL" ]; then
            break
        fi
    fi
    
    echo -e "${YELLOW}⏳ 嘗試 $ATTEMPT/$MAX_ATTEMPTS - 等待 LocalTunnel...${NC}"
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

if [ ! -z "$TUNNEL_URL" ]; then
    WEBHOOK_URL="${TUNNEL_URL}/webhook"
    echo ""
    echo -e "${GREEN}🎉 成功啟動！${NC}"
    echo "=================================="
    echo -e "${GREEN}✅ LINE Bot:${NC} http://localhost:3000"
    echo -e "${GREEN}✅ Tunnel URL:${NC} $TUNNEL_URL"
    echo -e "${GREEN}🔗 Webhook URL:${NC} $WEBHOOK_URL"
    echo ""
    echo -e "${BLUE}📋 請將以下 Webhook URL 複製到 LINE Developer Console:${NC}"
    echo -e "${YELLOW}$WEBHOOK_URL${NC}"
    echo ""
    
    # 將 Webhook URL 保存到檔案
    echo "$WEBHOOK_URL" > webhook-url.txt
    
    # 提供快捷指令
    echo -e "${BLUE}💡 快捷指令:${NC}"
    echo "• 查看 Bot 日誌: tail -f $PROJECT_DIR/bot.log"
    echo "• 查看 Tunnel 日誌: tail -f $PROJECT_DIR/tunnel.log"
    echo "• 停止服務: $PROJECT_DIR/stop-services.sh"
    echo "• 測試服務: curl $TUNNEL_URL"
    
else
    echo -e "${RED}❌ 無法獲取 LocalTunnel URL！請檢查 tunnel.log${NC}"
    if [ -f "tunnel.log" ]; then
        echo -e "${YELLOW}Tunnel 日誌內容：${NC}"
        cat tunnel.log
    fi
fi

echo ""
echo -e "${GREEN}服務正在背景運行中...${NC}"
echo -e "${YELLOW}使用 ./stop-services.sh 來停止所有服務${NC}"