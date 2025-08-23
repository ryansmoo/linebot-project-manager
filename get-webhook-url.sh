#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔗 獲取 Webhook URL${NC}"
echo "==================="

# 檢查服務是否運行
if ! pgrep -f "node app.js" > /dev/null; then
    echo -e "${RED}❌ LINE Bot 未運行！請先執行 start-bot-with-ngrok.sh${NC}"
    exit 1
fi

if ! pgrep -f "ngrok" > /dev/null; then
    echo -e "${RED}❌ Ngrok 未運行！請先執行 start-bot-with-ngrok.sh${NC}"
    exit 1
fi

# 嘗試從多個來源獲取 URL
echo -e "${YELLOW}🔍 正在獲取 ngrok URL...${NC}"

# 方法 1: 從 ngrok API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[a-z0-9-]*\.ngrok[a-z.-]*\.app' | head -1)

# 方法 2: 如果 API 失敗，嘗試從保存的檔案讀取
if [ -z "$NGROK_URL" ] && [ -f "webhook-url.txt" ]; then
    SAVED_URL=$(cat webhook-url.txt)
    NGROK_URL=$(echo $SAVED_URL | sed 's|/webhook||')
fi

if [ ! -z "$NGROK_URL" ]; then
    WEBHOOK_URL="${NGROK_URL}/webhook"
    echo ""
    echo -e "${GREEN}✅ 找到 Webhook URL:${NC}"
    echo -e "${YELLOW}$WEBHOOK_URL${NC}"
    echo ""
    echo -e "${BLUE}🌐 Ngrok 管理介面:${NC} http://localhost:4040"
    echo ""
    echo -e "${BLUE}📋 請將以下 URL 複製到 LINE Developer Console:${NC}"
    echo -e "${GREEN}$WEBHOOK_URL${NC}"
    
    # 更新保存的 URL
    echo "$WEBHOOK_URL" > webhook-url.txt
    
    # 提供複製用的純文字
    echo ""
    echo "=== 純文字複製用 ==="
    echo "$WEBHOOK_URL"
    echo "=================="
    
else
    echo -e "${RED}❌ 無法獲取 ngrok URL！${NC}"
    echo ""
    echo -e "${YELLOW}💡 可能的解決方案:${NC}"
    echo "1. 檢查 ngrok 是否正常運行: ps aux | grep ngrok"
    echo "2. 手動查看 ngrok 管理介面: http://localhost:4040"
    echo "3. 重新啟動服務: ./stop-services.sh && ./start-bot-with-ngrok.sh"
fi

echo ""