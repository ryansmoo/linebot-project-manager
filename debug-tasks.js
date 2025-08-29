// 簡單的調試工具來檢查任務儲存狀況

const http = require('http');

console.log('🔍 調試任務儲存狀況');
console.log('當前系統時間:', new Date());
console.log('當前日期格式:', new Date().toISOString().split('T')[0]);

// 模擬檢查API端點
function checkAPI(date, userId = 'test-user') {
    const options = {
        hostname: 'localhost',
        port: 3016,
        path: `/api/tasks/${userId}?date=${date}`,
        method: 'GET'
    };

    console.log(`\n🌐 檢查API: ${options.hostname}:${options.port}${options.path}`);
    
    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log(`📊 ${date} 的任務數據:`, result);
                
                if (result.success && result.tasks) {
                    console.log(`📝 找到 ${result.tasks.length} 個任務:`);
                    result.tasks.forEach((task, index) => {
                        console.log(`   ${index + 1}. ${task.text} (${task.completed ? '✅' : '⏳'})`);
                    });
                } else {
                    console.log('❌ 沒有找到任務或API調用失敗');
                }
            } catch (error) {
                console.error('❌ 解析API回應失敗:', error.message);
                console.log('原始回應:', data);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error(`❌ API調用失敗:`, error.message);
    });
    
    req.end();
}

// 檢查今天和可能的日期
const today2025 = '2025-08-29';
const today2024 = '2024-08-29';

console.log('\n🔍 檢查可能的日期...');
checkAPI(today2025);
setTimeout(() => checkAPI(today2024), 1000);

// 檢查昨天和明天
setTimeout(() => {
    checkAPI('2025-08-28'); // 昨天
    checkAPI('2025-08-30'); // 明天
}, 2000);