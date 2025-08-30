require('dotenv').config();
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

async function diagnoseToken() {
  console.log('🔍 檢查 LINE Channel Access Token');
  console.log('Token 長度:', config.channelAccessToken ? config.channelAccessToken.length : 'undefined');
  console.log('Token 前10字:', config.channelAccessToken ? config.channelAccessToken.substring(0, 10) : 'undefined');
  
  try {
    // 測試 TOKEN 有效性
    const response = await axios.get('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Channel Access Token 有效！');
    console.log('📋 Bot 資訊:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Channel Access Token 無效:');
    if (error.response) {
      console.error('   狀態碼:', error.response.status);
      console.error('   錯誤內容:', error.response.data);
    } else {
      console.error('   錯誤:', error.message);
    }
  }
}

// 同時測試一個簡單的回覆
async function testReply() {
  console.log('\n🧪 測試回覆功能...');
  
  try {
    // 使用一個假的 replyToken 來測試
    const testResponse = await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken: 'fake-reply-token-for-testing',
      messages: [
        {
          type: 'text',
          text: '測試訊息'
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ 回覆測試成功');
    
  } catch (error) {
    console.log('📊 回覆測試結果:');
    if (error.response) {
      console.log('   狀態碼:', error.response.status);
      if (error.response.status === 400) {
        console.log('   ✅ HTTP 400 是預期的 (因為使用假 replyToken)');
        console.log('   ✅ 這表示 TOKEN 有效，只是 replyToken 無效');
      } else {
        console.log('   ❌ 非預期錯誤:', error.response.data);
      }
    } else {
      console.error('   ❌ 網路錯誤:', error.message);
    }
  }
}

console.log('🔧 LINE Bot Token 診斷工具');
console.log('================================');
diagnoseToken().then(() => testReply());