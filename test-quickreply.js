// 測試 Quick Reply 生成
const BASE_URL = 'https://test-url.com';

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

// 模擬用戶資料
const userId = 'test-user-123';
const today = '2024-08-26';

// 建立任務清單內容
const taskListItems = todayTasks.map((task, index) => ({
  type: "box",
  layout: "baseline",
  contents: [
    {
      type: "text",
      text: `${index + 1}.`,
      size: "sm",
      color: "#00B900",
      weight: "bold",
      flex: 0
    },
    {
      type: "text",
      text: task.text,
      size: "sm",
      color: "#333333",
      wrap: true,
      flex: 1
    }
  ],
  spacing: "sm",
  margin: index === 0 ? "none" : "md"
}));

// 第二則：今天所有任務清單
const taskListMessage = {
  type: 'flex',
  altText: `今天的任務清單`,
  contents: {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📋 今天的任務",
          weight: "bold",
          size: "lg",
          color: "#ffffff"
        },
        {
          type: "text",
          text: `今天任務 ${todayTasks.length} 項`,
          size: "sm",
          color: "#ffffff"
        }
      ],
      backgroundColor: "#0084FF",
      paddingAll: "20px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: taskListItems,
      spacing: "sm",
      paddingAll: "15px"
    }
  }
};

// 建立 Quick Reply 按鈕
const quickReply = {
  items: [
    {
      type: 'action',
      action: {
        type: 'uri',
        label: '📅 今天',
        uri: `${BASE_URL}/liff/tasks.html?date=${today}&userId=${encodeURIComponent(userId)}`
      }
    },
    {
      type: 'action',
      action: {
        type: 'uri',
        label: '📋 全部',
        uri: `${BASE_URL}/liff/all-tasks.html?userId=${encodeURIComponent(userId)}`
      }
    },
    {
      type: 'action',
      action: {
        type: 'uri',
        label: '👤 帳戶',
        uri: `${BASE_URL}/liff/profile.html?userId=${encodeURIComponent(userId)}`
      }
    }
  ]
};

// 將 Quick Reply 添加到第二則訊息
taskListMessage.quickReply = quickReply;

console.log('測試 Quick Reply 生成：');
console.log('=================================');
console.log('✅ Quick Reply 結構：');
console.log(JSON.stringify(quickReply, null, 2));
console.log('');
console.log('✅ 第二則訊息是否包含 Quick Reply：', taskListMessage.quickReply ? '是' : '否');
console.log('');
console.log('✅ Quick Reply 項目數量：', taskListMessage.quickReply?.items?.length || 0);
console.log('');
console.log('Quick Reply 按鈕：');
if (taskListMessage.quickReply?.items) {
  taskListMessage.quickReply.items.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.action.label} - ${item.action.uri}`);
  });
}