#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 項目路徑
PROJECT_DIR="/mnt/c/Users/林憲毅/linebot-project-manager"

echo -e "${BLUE}🤖 啟動 LINE Bot 自動化腳本${NC}"
echo "=================================="

# 清理之前可能存在的進程
echo -e "${YELLOW}🧹 清理之前的進程...${NC}"
pkill -f "node app.js" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
sleep 2

# 切換到專案目錄
cd "$PROJECT_DIR"

# 檢查必要檔案是否存在
if [ ! -f "app.js" ]; then
    echo -e "${RED}❌ 找不到 app.js 檔案！${NC}"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 找不到 .env 檔案！${NC}"
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

# 啟動 ngrok
echo -e "${YELLOW}🌐 啟動 ngrok tunnel...${NC}"
nohup ngrok http 3000 > ngrok.log 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > ngrok.pid

# 等待 ngrok 啟動
echo -e "${YELLOW}⏳ 等待 ngrok 建立連接...${NC}"
sleep 5

# 嘗試獲取 ngrok URL
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[a-z0-9-]*\.ngrok[a-z.-]*\.app' | head -1)
    
    if [ ! -z "$NGROK_URL" ]; then
        break
    fi
    
    echo -e "${YELLOW}⏳ 嘗試 $ATTEMPT/$MAX_ATTEMPTS - 等待 ngrok...${NC}"
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ ! -z "$NGROK_URL" ]; then
    WEBHOOK_URL="${NGROK_URL}/webhook"
    echo ""
    echo -e "${GREEN}🎉 成功啟動！${NC}"
    echo "=================================="
    echo -e "${GREEN}✅ LINE Bot:${NC} http://localhost:3000"
    echo -e "${GREEN}✅ Ngrok URL:${NC} $NGROK_URL"
    echo -e "${GREEN}🔗 Webhook URL:${NC} $WEBHOOK_URL"
    echo ""
    echo -e "${BLUE}📋 請將以下 Webhook URL 複製到 LINE Developer Console:${NC}"
    echo -e "${YELLOW}$WEBHOOK_URL${NC}"
    echo ""
    echo -e "${BLUE}📊 監控網址:${NC} http://localhost:4040"
    echo ""
    
    # 將 Webhook URL 保存到檔案
    echo "$WEBHOOK_URL" > webhook-url.txt
    
    # 提供快捷指令
    echo -e "${BLUE}💡 快捷指令:${NC}"
    echo "• 查看 Bot 日誌: tail -f $PROJECT_DIR/bot.log"
    echo "• 查看 Ngrok 日誌: tail -f $PROJECT_DIR/ngrok.log"
    echo "• 停止服務: $PROJECT_DIR/stop-services.sh"
    echo "• 重新獲取 URL: $PROJECT_DIR/get-webhook-url.sh"
    
else
    echo -e "${RED}❌ 無法獲取 ngrok URL！請檢查 ngrok 是否正常運行${NC}"
    echo "請手動檢查 http://localhost:4040"
fi

echo ""
echo -e "${GREEN}服務正在背景運行中...${NC}"
echo -e "${YELLOW}按 Ctrl+C 不會停止服務，使用 stop-services.sh 來停止${NC}"