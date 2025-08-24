// 測試 Google Calendar 整合系統

const axios = require('axios');

// 測試配置 - 請替換成你的實際配置
const TEST_CONFIG = {
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyJS4Yho7R0UZASLIEEf-xsTzl9OLrT8BUh21Vkc3_zAO5gXTQy3l0uiUL8caw9fTDU/exec',
  LINE_USER_ID: 'test_user_123' // 測試用的 LINE 使用者 ID
};

// 測試函數
async function testCalendarSystem() {
  console.log('🧪 開始測試 Google Calendar 整合系統...\n');

  try {
    // 1. 測試檢查授權狀態
    console.log('1️⃣ 測試檢查授權狀態...');
    await testAuthStatus();
    
    // 2. 測試新增事件
    console.log('\n2️⃣ 測試新增事件...');
    const eventId = await testAddEvent();
    
    if (eventId) {
      // 3. 測試查看事件
      console.log('\n3️⃣ 測試查看事件...');
      await testListEvents();
      
      // 4. 測試刪除事件
      console.log('\n4️⃣ 測試刪除事件...');
      await testDeleteEvent(eventId);
    }
    
    console.log('\n✅ 所有測試完成！');
    
  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error.message);
  }
}

// 測試授權狀態
async function testAuthStatus() {
  try {
    const response = await axios.post(TEST_CONFIG.GOOGLE_SCRIPT_URL, {
      action: 'listEvents',
      lineUserId: TEST_CONFIG.LINE_USER_ID,
      maxResults: 1
    });
    
    if (response.data.needAuth) {
      console.log('❌ 使用者尚未授權');
      console.log('請先完成以下步驟：');
      console.log(`1. 訪問: ${TEST_CONFIG.GOOGLE_SCRIPT_URL}?action=authorize&lineUserId=${TEST_CONFIG.LINE_USER_ID}`);
      console.log('2. 完成 Google 授權');
      console.log('3. 重新執行此測試');
      return false;
    } else if (response.data.success) {
      console.log('✅ 授權狀態正常');
      return true;
    } else {
      console.log('⚠️ 授權檢查異常:', response.data.error);
      return false;
    }
  } catch (error) {
    console.log('❌ 授權檢查失敗:', error.message);
    return false;
  }
}

// 測試新增事件
async function testAddEvent() {
  try {
    const testEvent = {
      action: 'addEvent',
      lineUserId: TEST_CONFIG.LINE_USER_ID,
      title: '測試事件 - ' + new Date().toLocaleString('zh-TW'),
      startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1小時後
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2小時後
      description: '這是一個自動測試事件，可以安全刪除'
    };
    
    const response = await axios.post(TEST_CONFIG.GOOGLE_SCRIPT_URL, testEvent);
    
    if (response.data.success) {
      console.log('✅ 事件新增成功');
      console.log('📅 事件ID:', response.data.eventId);
      return response.data.eventId;
    } else {
      console.log('❌ 事件新增失敗:', response.data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ 新增事件測試失敗:', error.message);
    return null;
  }
}

// 測試查看事件
async function testListEvents() {
  try {
    const response = await axios.post(TEST_CONFIG.GOOGLE_SCRIPT_URL, {
      action: 'listEvents',
      lineUserId: TEST_CONFIG.LINE_USER_ID,
      maxResults: 5
    });
    
    if (response.data.success) {
      console.log('✅ 事件列表取得成功');
      console.log('📋 事件數量:', response.data.events.length);
      
      if (response.data.events.length > 0) {
        console.log('📅 最近的事件:');
        response.data.events.slice(0, 2).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.summary}`);
          console.log(`      時間: ${new Date(event.start.dateTime || event.start.date).toLocaleString('zh-TW')}`);
        });
      }
    } else {
      console.log('❌ 事件列表取得失敗:', response.data.error);
    }
  } catch (error) {
    console.log('❌ 查看事件測試失敗:', error.message);
  }
}

// 測試刪除事件
async function testDeleteEvent(eventId) {
  if (!eventId) {
    console.log('⚠️ 沒有事件ID，跳過刪除測試');
    return;
  }
  
  try {
    const response = await axios.post(TEST_CONFIG.GOOGLE_SCRIPT_URL, {
      action: 'deleteEvent',
      lineUserId: TEST_CONFIG.LINE_USER_ID,
      eventId: eventId
    });
    
    if (response.data.success) {
      console.log('✅ 事件刪除成功');
    } else {
      console.log('❌ 事件刪除失敗:', response.data.error);
    }
  } catch (error) {
    console.log('❌ 刪除事件測試失敗:', error.message);
  }
}

// 如果直接執行此檔案，則開始測試
if (require.main === module) {
  if (TEST_CONFIG.GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') {
    console.log('❌ 請先在檔案中設定你的 Google Apps Script URL');
    console.log('修改 TEST_CONFIG.GOOGLE_SCRIPT_URL 的值');
    process.exit(1);
  }
  
  testCalendarSystem();
}

module.exports = {
  testCalendarSystem,
  testAuthStatus,
  testAddEvent,
  testListEvents,
  testDeleteEvent
};