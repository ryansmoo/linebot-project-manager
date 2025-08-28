// 驗證最簡單的 Quick Reply 測試功能
console.log('🧪 === 最簡單的 Quick Reply 測試驗證 ===');
console.log('');

console.log('📋 測試設計說明：');
console.log('- 觸發指令：測試qr, testqr, TESTQR');
console.log('- 訊息類型：純文字 (text)，不使用 Flex Message');
console.log('- Quick Reply：3個簡單按鈕');
console.log('- 發送方式：client.replyMessage (最穩定的方式)');
console.log('- 字段名稱：quick_reply (LINE 官方規範)');
console.log('');

// 模擬 Quick Reply 結構
const testQuickReply = {
  items: [
    {
      type: 'action',
      action: {
        type: 'message',
        label: '✅ 成功',
        text: '✅ Quick Reply 成功！'
      }
    },
    {
      type: 'action', 
      action: {
        type: 'message',
        label: '❌ 失敗',
        text: '❌ Quick Reply 失敗'
      }
    },
    {
      type: 'action',
      action: {
        type: 'message', 
        label: '🔄 重試',
        text: '測試qr'
      }
    }
  ]
};

console.log('✅ Quick Reply 結構驗證：');
console.log(JSON.stringify(testQuickReply, null, 2));
console.log('');

// 完整訊息結構
const completeMessage = {
  type: 'text',
  text: '🧪 最簡單的 Quick Reply 測試\n\n如果看到下方有按鈕，代表 Quick Reply 功能正常！',
  quick_reply: testQuickReply
};

console.log('📋 完整訊息結構檢查：');
console.log('- 訊息類型:', completeMessage.type);
console.log('- 包含 quick_reply:', !!completeMessage.quick_reply);
console.log('- 按鈕數量:', completeMessage.quick_reply.items.length);
console.log('- 所有按鈕都是 message 類型:', 
  completeMessage.quick_reply.items.every(item => item.action.type === 'message') ? '是' : '否');
console.log('');

console.log('🎯 測試步驟：');
console.log('1. 向 Line Bot 發送訊息: "測試qr"');
console.log('2. 觀察回應訊息下方是否出現 3 個按鈕：');
console.log('   - ✅ 成功');
console.log('   - ❌ 失敗'); 
console.log('   - 🔄 重試');
console.log('3. 點擊任一按鈕測試觸發是否正常');
console.log('');

console.log('🔍 預期結果：');
console.log('✅ 如果 Quick Reply 正常：按鈕會顯示在訊息下方');
console.log('❌ 如果 Quick Reply 失敗：只會看到純文字，沒有按鈕');
console.log('');

console.log('📊 排除問題的優勢：');
console.log('- 最簡單結構：排除 Flex Message 複雜度影響');
console.log('- 純文字訊息：排除內容格式干擾');
console.log('- 直接 Reply：排除 Push Message 相容性問題');
console.log('- 標準結構：符合 LINE 官方所有規範');
console.log('');

console.log('💡 如果這個測試失敗：');
console.log('問題可能在於：');
console.log('1. LINE Bot SDK 版本不兼容');
console.log('2. LINE Channel 設定問題');
console.log('3. LINE 帳戶類型限制');
console.log('4. 平台或地區限制');
console.log('');

console.log('🚀 開始測試！');
console.log('發送 "測試qr" 給你的 Line Bot 開始測試！');