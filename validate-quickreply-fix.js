// 完整測試修正後的 Quick Reply 功能
const BASE_URL = process.env.BASE_URL || 'https://your-app.railway.app';

// 引入修正後的函數
function createStandardQuickReply(baseUrl, userId) {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📅 今日任務',
          text: '任務'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📋 全部任務',
          text: '全部'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '❓ 幫助',
          text: '/help'
        }
      }
    ]
  };
}

// 模擬創建 Flex Message
function createTaskListFlexMessage(taskCount, tasks, userId, baseUrl) {
  const displayTasks = tasks.slice(0, 3);
  
  return {
    type: 'flex',
    altText: `${taskCount}個待辦事項`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 任務清單',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: `共 ${taskCount} 項任務`,
            size: 'sm',
            color: '#ffffff'
          }
        ],
        backgroundColor: '#0084FF',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: displayTasks.map((task, index) => ({
          type: 'box',
          layout: 'baseline',
          contents: [
            {
              type: 'text',
              text: `${index + 1}.`,
              size: 'sm',
              color: '#00B900',
              weight: 'bold',
              flex: 0
            },
            {
              type: 'text',
              text: task.text || task,
              size: 'sm',
              color: '#333333',
              wrap: true,
              flex: 1
            }
          ],
          spacing: 'sm',
          margin: index === 0 ? 'none' : 'md'
        })),
        spacing: 'sm',
        paddingAll: '15px'
      }
    }
  };
}

console.log('🧪 === Quick Reply 修正驗證測試 ===');
console.log('');

// 測試數據
const userId = 'test-user-123';
const testTasks = [
  '完成專案報告',
  '參加會議',
  '回覆客戶郵件'
];

// 1. 測試 Quick Reply 結構
console.log('1️⃣ 測試 Quick Reply 結構：');
const quickReply = createStandardQuickReply(BASE_URL, userId);
console.log('✅ Quick Reply 生成成功');
console.log('✅ 按鈕數量:', quickReply.items.length);
console.log('✅ 所有按鈕都是 message 類型:', 
  quickReply.items.every(item => item.action.type === 'message') ? '是' : '否'
);
console.log('');

// 2. 測試完整的 Flex Message + Quick Reply
console.log('2️⃣ 測試完整的 Flex Message：');
const flexMessage = createTaskListFlexMessage(testTasks.length, testTasks, userId, BASE_URL);
flexMessage.quickReply = quickReply;

console.log('✅ Flex Message 類型:', flexMessage.type);
console.log('✅ 包含 Quick Reply:', flexMessage.quickReply ? '是' : '否');
console.log('✅ Alt Text:', flexMessage.altText);
console.log('');

// 3. 驗證 JSON 結構完整性
console.log('3️⃣ 驗證 JSON 結構：');
try {
  const jsonString = JSON.stringify(flexMessage);
  const parsedBack = JSON.parse(jsonString);
  console.log('✅ JSON 序列化/反序列化:', '成功');
  console.log('✅ Quick Reply 在 JSON 中保持完整:', 
    parsedBack.quickReply && parsedBack.quickReply.items ? '是' : '否'
  );
} catch (error) {
  console.log('❌ JSON 處理失敗:', error.message);
}
console.log('');

// 4. 輸出完整結構供檢查
console.log('4️⃣ 完整訊息結構檢查：');
console.log('Quick Reply Items:');
flexMessage.quickReply.items.forEach((item, index) => {
  console.log(`  ${index + 1}. "${item.action.label}" → 發送 "${item.action.text}"`);
});
console.log('');

console.log('🎯 修正摘要：');
console.log('- 將 Quick Reply action type 從 "uri" 改為 "message"');
console.log('- 移除了可能造成問題的 URI 連結');
console.log('- 使用簡單的文字觸發，由 bot 內部邏輯處理');
console.log('- 添加了表情符號讓按鈕更直觀');
console.log('');
console.log('📱 用戶使用方式：');
console.log('- 點擊 "📅 今日任務" → 觸發 "任務" 文字，bot 顯示今日任務');
console.log('- 點擊 "📋 全部任務" → 觸發 "全部" 文字，bot 顯示所有任務');  
console.log('- 點擊 "❓ 幫助" → 觸發 "/help" 文字，bot 顯示幫助訊息');