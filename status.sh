#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 LINE Bot 服務狀態${NC}"
echo "===================="

# 檢查 LINE Bot 狀態
if pgrep -f "node app.js" > /dev/null; then
    BOT_PID=$(pgrep -f "node app.js")
    echo -e "${GREEN}✅ LINE Bot: 運行中 (PID: $BOT_PID)${NC}"
    
    # 檢查端口
    if ss -tuln | grep -q ":3000"; then
        echo -e "${GREEN}✅ 端口 3000: 正在監聽${NC}"
    else
        echo -e "${RED}❌ 端口 3000: 未在監聽${NC}"
    fi
else
    echo -e "${RED}❌ LINE Bot: 未運行${NC}"
fi

# 檢查 Ngrok 狀態
if pgrep -f "ngrok" > /dev/null; then
    NGROK_PID=$(pgrep -f "ngrok")
    echo -e "${GREEN}✅ Ngrok: 運行中 (PID: $NGROK_PID)${NC}"
    
    # 檢查 ngrok 管理端口
    if ss -tuln | grep -q ":4040"; then
        echo -e "${GREEN}✅ Ngrok 管理介面: http://localhost:4040${NC}"
        
        # 嘗試獲取公開 URL
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[a-z0-9-]*\.ngrok[a-z.-]*\.app' | head -1)
        if [ ! -z "$NGROK_URL" ]; then
            echo -e "${GREEN}✅ 公開 URL: $NGROK_URL${NC}"
            echo -e "${GREEN}🔗 Webhook URL: ${NGROK_URL}/webhook${NC}"
        else
            echo -e "${YELLOW}⚠️  無法獲取公開 URL${NC}"
        fi
    else
        echo -e "${RED}❌ Ngrok 管理介面: 無法存取${NC}"
    fi
else
    echo -e "${RED}❌ Ngrok: 未運行${NC}"
fi

# 檢查日誌檔案
echo ""
echo -e "${BLUE}📋 日誌檔案:${NC}"
if [ -f "bot.log" ]; then
    BOT_LOG_SIZE=$(stat -f%z bot.log 2>/dev/null || stat -c%s bot.log 2>/dev/null)
    echo -e "${GREEN}✅ bot.log (${BOT_LOG_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}⚠️  bot.log: 不存在${NC}"
fi

if [ -f "ngrok.log" ]; then
    NGROK_LOG_SIZE=$(stat -f%z ngrok.log 2>/dev/null || stat -c%s ngrok.log 2>/dev/null)
    echo -e "${GREEN}✅ ngrok.log (${NGROK_LOG_SIZE} bytes)${NC}"
else
    echo -e "${YELLOW}⚠️  ngrok.log: 不存在${NC}"
fi

# 檢查配置檔案
echo ""
echo -e "${BLUE}⚙️  配置檔案:${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env: 存在${NC}"
else
    echo -e "${RED}❌ .env: 不存在${NC}"
fi

if [ -f "webhook-url.txt" ]; then
    WEBHOOK_URL=$(cat webhook-url.txt)
    echo -e "${GREEN}✅ 已保存的 Webhook URL: $WEBHOOK_URL${NC}"
else
    echo -e "${YELLOW}⚠️  webhook-url.txt: 不存在${NC}"
fi

echo ""
echo -e "${BLUE}💡 快捷指令:${NC}"
echo "• 啟動服務: ./start-bot-with-ngrok.sh"
echo "• 停止服務: ./stop-services.sh"
echo "• 獲取 URL: ./get-webhook-url.sh"
echo "• 查看 Bot 日誌: tail -f bot.log"
echo "• 查看 Ngrok 日誌: tail -f ngrok.log"
echo ""