#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 停止 LINE Bot 服務${NC}"
echo "====================="

# 停止 NODE.JS 應用
echo -e "${YELLOW}🔄 停止 LINE Bot...${NC}"
if [ -f "bot.pid" ]; then
    BOT_PID=$(cat bot.pid)
    if ps -p $BOT_PID > /dev/null; then
        kill $BOT_PID
        echo -e "${GREEN}✅ LINE Bot (PID: $BOT_PID) 已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  LINE Bot 已經停止了${NC}"
    fi
    rm -f bot.pid
else
    # 備用方法：通過進程名稱停止
    if pgrep -f "node app.js" > /dev/null; then
        pkill -f "node app.js"
        echo -e "${GREEN}✅ LINE Bot 進程已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  找不到運行中的 LINE Bot${NC}"
    fi
fi

# 停止 NGROK
echo -e "${YELLOW}🔄 停止 ngrok...${NC}"
if [ -f "ngrok.pid" ]; then
    NGROK_PID=$(cat ngrok.pid)
    if ps -p $NGROK_PID > /dev/null; then
        kill $NGROK_PID
        echo -e "${GREEN}✅ Ngrok (PID: $NGROK_PID) 已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  Ngrok 已經停止了${NC}"
    fi
    rm -f ngrok.pid
else
    # 備用方法：通過進程名稱停止
    if pgrep -f "ngrok" > /dev/null; then
        pkill -f "ngrok"
        echo -e "${GREEN}✅ Ngrok 進程已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  找不到運行中的 Ngrok${NC}"
    fi
fi

# 清理臨時檔案
echo -e "${YELLOW}🧹 清理臨時檔案...${NC}"
rm -f webhook-url.txt
echo -e "${GREEN}✅ 臨時檔案已清理${NC}"

# 檢查端口是否釋放
echo -e "${YELLOW}🔍 檢查端口狀態...${NC}"
if ss -tuln | grep -q ":3000"; then
    echo -e "${YELLOW}⚠️  端口 3000 仍在使用中，可能需要手動清理${NC}"
else
    echo -e "${GREEN}✅ 端口 3000 已釋放${NC}"
fi

if ss -tuln | grep -q ":4040"; then
    echo -e "${YELLOW}⚠️  端口 4040 仍在使用中，可能需要手動清理${NC}"
else
    echo -e "${GREEN}✅ 端口 4040 已釋放${NC}"
fi

echo ""
echo -e "${GREEN}🎉 所有服務已停止！${NC}"
echo ""
echo -e "${BLUE}💡 提示:${NC}"
echo "• 要重新啟動服務: ./start-bot-with-ngrok.sh"
echo "• 查看日誌檔案: ls -la *.log"
echo ""