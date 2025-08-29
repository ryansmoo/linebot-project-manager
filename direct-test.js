// 直接測試任務儲存功能

const http = require('http');

// 簡單的訊息事件，繞過簽名驗證
const simpleEvent = {
    events: [
        {
            type: 'message',
            message: {
                type: 'text',
                text: '去買菜'
            },
            source: {
                userId: 'test-user-829'  // 使用829作為測試
            },
            replyToken: 'test-token'
        }
    ]
};

const postData = JSON.stringify(simpleEvent);

console.log('🧪 發送簡單測試訊息...');
console.log('📝 訊息:', simpleEvent.events[0].message.text);
console.log('👤 用戶ID:', simpleEvent.events[0].source.userId);

const options = {
    hostname: 'localhost',
    port: 3016,
    path: '/webhook',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`\n📡 狀態碼: ${res.statusCode}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    
    res.on('end', () => {
        console.log('📨 伺服器回應:', responseData);
        
        // 等待處理完成後檢查結果
        setTimeout(() => {
            checkResult();
        }, 2000);
    });
});

req.on('error', (error) => {
    console.error('❌ 請求錯誤:', error.message);
});

req.write(postData);
req.end();

function checkResult() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n🔍 檢查今天 (${today}) 的任務...`);
    
    const checkOptions = {
        hostname: 'localhost',
        port: 3016,
        path: `/api/tasks/test-user-829?date=${today}`,
        method: 'GET'
    };
    
    const checkReq = http.request(checkOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('📊 結果:', result);
                
                if (result.success && result.tasks.length > 0) {
                    console.log('\n✅ 成功找到任務！');
                    result.tasks.forEach((task, i) => {
                        console.log(`   ${i+1}. "${task.text}" (${task.date})`);
                        console.log(`      ID: ${task.id}`);
                        console.log(`      建立時間: ${task.createdAt}`);
                    });
                } else {
                    console.log('\n❌ 沒有找到任務');
                    console.log('可能原因：');
                    console.log('1. 任務沒有正確儲存');  
                    console.log('2. 日期不匹配');
                    console.log('3. 用戶ID不匹配');
                }
            } catch (error) {
                console.error('❌ 解析錯誤:', error.message);
                console.log('原始數據:', data);
            }
        });
    });
    
    checkReq.end();
}