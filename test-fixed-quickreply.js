// 測試修正後的 Quick Reply 功能
const BASE_URL = 'https://test-url.com';

// 修正後的 createStandardQuickReply 函數
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

// 模擬任務資料
const todayTasks = [
  { 
    text: '開會討論新專案', 
    taskTime: null, 
    reminderEnabled: false 
  },
  { 
    text: '跟小美約會⏰', 
    taskTime: '2024-07-02T12:00', 
    reminderEnabled: true 
  }
];

const userId = 'test-user-123';

// 建立簡單的 Flex Message
const flexMessage = {
  type: 'flex',
  altText: `${todayTasks.length}個待辦事項`,
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📋 今天的任務',
          weight: 'bold',
          size: 'lg',
          color: '#ffffff'
        }
      ],
      backgroundColor: '#0084FF',
      paddingAll: '20px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: todayTasks.map((task, index) => ({
        type: 'text',
        text: `${index + 1}. ${task.text}`,
        size: 'sm',
        margin: index === 0 ? 'none' : 'md'
      }))
    }
  }
};

// 添加修正後的 Quick Reply
flexMessage.quickReply = createStandardQuickReply(BASE_URL, userId);

console.log('🔧 測試修正後的 Quick Reply：');
console.log('=====================================');
console.log('✅ Quick Reply 結構：');
console.log(JSON.stringify(flexMessage.quickReply, null, 2));
console.log('');
console.log('✅ 完整訊息結構檢查：');
console.log('- 訊息類型:', flexMessage.type);
console.log('- 是否包含 quickReply:', flexMessage.quickReply ? '✅ 是' : '❌ 否');
console.log('- Quick Reply 按鈕數量:', flexMessage.quickReply?.items?.length || 0);
console.log('');
console.log('✅ Quick Reply 按鈕詳情：');
if (flexMessage.quickReply?.items) {
  flexMessage.quickReply.items.forEach((item, index) => {
    console.log(`  ${index + 1}. 標籤: "${item.action.label}"`);
    console.log(`     動作類型: ${item.action.type}`);
    console.log(`     觸發文字: "${item.action.text}"`);
    console.log('');
  });
}

console.log('🔧 修正內容：');
console.log('- 將 Quick Reply 動作類型從 "uri" 改為 "message"');
console.log('- 移除可能有問題的 URI 連結');  
console.log('- 使用簡單的文字觸發，讓 bot 處理對應功能');
console.log('- 添加 emoji 讓按鈕更美觀');