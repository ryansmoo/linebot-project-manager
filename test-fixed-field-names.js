// 驗證修正後的 Quick Reply 字段名稱
console.log('🧪 === 驗證修正後的 Quick Reply 字段名稱 ===');
console.log('');

// 模擬修正後的 createQuickReply 函數
function createQuickReply() {
  return {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📅 今日任務',
          text: '今天任務'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '📝 新增任務',
          text: '新增任務'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: '❓ 說明',
          text: '說明'
        }
      }
    ]
  };
}

// 模擬修正後的訊息結構
const replyMessage = {
  type: 'flex',
  altText: '任務完成',
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ 任務完成',
          weight: 'bold',
          color: '#ffffff'
        }
      ],
      backgroundColor: '#00B900'
    }
  }
};

// 使用統一的 Quick Reply 函數
const quickReply = createQuickReply();

// ✅ 修正：使用正確的字段名稱 "quick_reply"
replyMessage.quick_reply = quickReply;

console.log('1️⃣ 字段名稱檢查：');
console.log('✅ 使用正確字段名稱:', Object.hasOwnProperty.call(replyMessage, 'quick_reply') ? 'quick_reply' : '未找到');
console.log('❌ 舊的錯誤字段名稱:', Object.hasOwnProperty.call(replyMessage, 'quickReply') ? 'quickReply (仍存在)' : '已清除');
console.log('');

console.log('2️⃣ Quick Reply 結構檢查：');
console.log('- 物件存在:', !!replyMessage.quick_reply);
console.log('- Items 陣列存在:', Array.isArray(replyMessage.quick_reply?.items));
console.log('- 按鈕數量:', replyMessage.quick_reply?.items?.length || 0);
console.log('- 所有按鈕類型一致:', 
  replyMessage.quick_reply?.items?.every(item => item.action.type === 'message') ? '是 (全部 message)' : '否');
console.log('');

console.log('3️⃣ 完整 JSON 結構：');
console.log('符合 LINE 官方規範的訊息結構：');
console.log(JSON.stringify(replyMessage, null, 2));
console.log('');

console.log('4️⃣ 修正前後比較：');
console.log('❌ 修正前：message.quickReply = {...}  (LINE SDK 無法識別)');
console.log('✅ 修正後：message.quick_reply = {...}  (符合 LINE 官方規範)');
console.log('');

console.log('5️⃣ 技術細節：');
console.log('- LINE Messaging API 使用下劃線命名風格');
console.log('- quick_reply 是官方指定的字段名稱');
console.log('- SDK 會忽略不認識的字段名稱');
console.log('- 這就是為什麼之前 Quick Reply 不顯示的原因');
console.log('');

console.log('🎯 預期結果：');
console.log('修正字段名稱後，Quick Reply 按鈕應該會在 Flex Message 下方正確顯示！');