// 測試正確的 Quick Reply 字段名稱
console.log('🔍 === LINE 官方 Quick Reply 字段名稱測試 ===');
console.log('');

// 根據 LINE 官方文檔，應該使用 "quick_reply" 而不是 "quickReply"

// 錯誤的格式 (我們現在在用的)
const incorrectFormat = {
  type: 'flex',
  altText: '任務清單',
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
        }
      ],
      backgroundColor: '#0084FF'
    }
  },
  quickReply: { // ❌ 錯誤：使用駝峰命名
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📅 今日任務',
          text: '今天任務'
        }
      }
    ]
  }
};

// 正確的格式 (LINE 官方規範)
const correctFormat = {
  type: 'flex',
  altText: '任務清單',
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
        }
      ],
      backgroundColor: '#0084FF'
    }
  },
  quick_reply: { // ✅ 正確：使用下劃線命名
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📅 今日任務',
          text: '今天任務'
        }
      }
    ]
  }
};

console.log('❌ 錯誤格式 (我們目前使用的):');
console.log('字段名稱:', Object.keys(incorrectFormat).includes('quickReply') ? 'quickReply (駝峰命名)' : '未找到');
console.log('');

console.log('✅ 正確格式 (LINE 官方規範):');
console.log('字段名稱:', Object.keys(correctFormat).includes('quick_reply') ? 'quick_reply (下劃線命名)' : '未找到');
console.log('');

console.log('🔧 修正重點:');
console.log('1. 將 "quickReply" 改為 "quick_reply"');
console.log('2. LINE Bot SDK 期望下劃線命名風格');  
console.log('3. 這可能是 Quick Reply 不顯示的根本原因');
console.log('');

console.log('📋 需要修正的代碼位置:');
console.log('- replyMessage.quickReply = quickReply; → replyMessage.quick_reply = quickReply;');
console.log('- taskListMessage.quickReply = quickReply; → taskListMessage.quick_reply = quickReply;');
console.log('');

// JSON 字符串比較
console.log('🧪 JSON 結構比較:');
console.log('');
console.log('錯誤格式 JSON 片段:');
console.log(JSON.stringify({quickReply: incorrectFormat.quickReply}, null, 2));
console.log('');
console.log('正確格式 JSON 片段:');
console.log(JSON.stringify({quick_reply: correctFormat.quick_reply}, null, 2));

console.log('');
console.log('💡 結論:');
console.log('LINE Bot SDK 無法識別 "quickReply" 字段，因此 Quick Reply 按鈕不會顯示。');
console.log('必須使用 "quick_reply" 才能符合 LINE 官方規範！');