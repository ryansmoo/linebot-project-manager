// 測試模擬LINE訊息發送

const http = require('http');

// 模擬LINE webhook事件結構
const mockLineEvent = {
    events: [
        {
            type: 'message',
            message: {
                type: 'text',
                text: '測試任務 - 8/29'
            },
            source: {
                userId: 'test-user-123'
            },
            replyToken: 'test-reply-token-123',
            timestamp: Date.now()
        }
    ]
};

const postData = JSON.stringify(mockLineEvent);

const options = {
    hostname: 'localhost',
    port: 3016,
    path: '/webhook',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Line-Signature': 'test-signature' // 測試用，實際需要正確的簽名
    }
};

console.log('🧪 模擬發送LINE訊息到webhook...');
console.log('訊息內容:', mockLineEvent.events[0].message.text);
console.log('用戶ID:', mockLineEvent.events[0].source.userId);
console.log('目標端點:', `${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
    console.log(`\n📡 伺服器回應狀態: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('📨 伺服器回應:', data || '(空回應)');
        
        // 等待一秒後檢查任務是否已儲存
        setTimeout(() => {
            checkStoredTask();
        }, 1000);
    });
});

req.on('error', (error) => {
    console.error('❌ 發送失敗:', error.message);
});

req.write(postData);
req.end();

// 檢查任務是否已儲存
function checkStoredTask() {
    const today = new Date().toISOString().split('T')[0];
    const checkOptions = {
        hostname: 'localhost',
        port: 3016,
        path: `/api/tasks/test-user-123?date=${today}`,
        method: 'GET'
    };
    
    console.log(`\n🔍 檢查任務是否已儲存: ${today}`);
    
    const checkReq = http.request(checkOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('📊 任務檢查結果:', result);
                
                if (result.success && result.tasks && result.tasks.length > 0) {
                    console.log('✅ 成功！任務已儲存:');
                    result.tasks.forEach((task, index) => {
                        console.log(`   ${index + 1}. "${task.text}" (ID: ${task.id})`);
                    });
                } else {
                    console.log('❌ 任務未儲存或儲存失敗');
                }
            } catch (error) {
                console.error('❌ 解析失敗:', error.message);
            }
        });
    });
    
    checkReq.on('error', (error) => {
        console.error('❌ 檢查請求失敗:', error.message);
    });
    
    checkReq.end();
}