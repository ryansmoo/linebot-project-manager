require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');

// LINE Bot 配置
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// 任務儲存 (記憶體)
const tasks = new Map(); // userId -> tasks array

// GitHub 自動提交功能
const { commitNewTask } = require('./enhanced-auto-git');

// 中間件
app.use(express.json());
app.use(express.static('public'));

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 建立如圖片顯示的 Flex Message
function createTaskListFlexMessage(todayTasks) {
  const taskItems = todayTasks.map((task, index) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${index + 1}.`,
        size: 'sm',
        color: '#666666',
        flex: 0,
        margin: 'none'
      },
      {
        type: 'text',
        text: task.text,
        size: 'sm',
        color: '#333333',
        flex: 1,
        wrap: true,
        margin: 'sm'
      },
      {
        type: 'icon',
        url: 'https://cdn-icons-png.flaticon.com/512/1828/1828911.png',
        size: 'sm',
        margin: 'sm'
      },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [],
            width: '20px',
            height: '20px',
            borderWidth: '2px',
            borderColor: task.completed ? '#00B900' : '#CCCCCC',
            cornerRadius: '4px',
            backgroundColor: task.completed ? '#00B900' : '#FFFFFF'
          }
        ],
        flex: 0,
        margin: 'sm'
      }
    ],
    spacing: 'sm',
    margin: index > 0 ? 'md' : 'none'
  }));

  const completedCount = todayTasks.filter(t => t.completed).length;
  const pendingCount = todayTasks.length - completedCount;

  return {
    type: 'flex',
    altText: `今天 ${todayTasks.length} 件事要做`,
    contents: {
      type: 'bubble',
      styles: {
        body: {
          backgroundColor: '#F4D03F'
        }
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `今天 ${todayTasks.length} 件事要做`,
            weight: 'bold',
            size: 'lg',
            color: '#333333',
            align: 'center',
            margin: 'none'
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#DDDDDD'
          },
          ...taskItems,
          {
            type: 'separator',
            margin: 'lg',
            color: '#DDDDDD'
          },
          {
            type: 'text',
            text: `已完成 ${completedCount} 件，待完成 ${pendingCount} 件`,
            size: 'sm',
            color: '#666666',
            align: 'center',
            margin: 'md'
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '📋 全部紀錄',
              text: '查看全部任務'
            },
            color: '#999999',
            flex: 1
          },
          {
            type: 'button',
            style: 'secondary', 
            action: {
              type: 'message',
              label: '👤 個人帳號',
              text: '個人設定'
            },
            color: '#999999',
            flex: 1,
            margin: 'sm'
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      }
    }
  };
}

// 處理 Webhook 事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const messageText = event.message.text.trim();
  const today = new Date().toISOString().split('T')[0];

  console.log(`💬 收到訊息: ${messageText} from user: ${userId.substring(0, 10)}...`);

  // 初始化用戶任務列表
  if (!tasks.has(userId)) {
    tasks.set(userId, []);
  }

  // 新增任務
  const newTask = {
    id: Date.now().toString(),
    text: messageText,
    createdAt: new Date().toISOString(),
    date: today,
    userId: userId,
    completed: false
  };

  tasks.get(userId).push(newTask);
  console.log(`📝 任務已儲存: ${newTask.text}`);

  // GitHub 自動提交
  try {
    commitNewTask(newTask.text);
    console.log(`📤 已提交到 Git: ${newTask.text}`);
  } catch (error) {
    console.error(`❌ Git 提交失敗:`, error.message);
  }

  // 獲取今天的任務
  const todayTasks = tasks.get(userId).filter(task => task.date === today);

  // 建立回應訊息
  const replyMessage = createTaskListFlexMessage(todayTasks);

  try {
    // 回傳 Flex Message
    const result = await client.replyMessage(event.replyToken, replyMessage);
    console.log(`✅ Flex Message 發送成功`);
    return result;
  } catch (error) {
    console.error(`❌ Flex Message 發送失敗:`, error.message);
    
    // 備案：發送純文字訊息
    try {
      const fallbackText = `✅ 已記錄: ${messageText}\n\n📋 今天共 ${todayTasks.length} 項任務`;
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: fallbackText
      });
      console.log(`✅ 備案文字訊息發送成功`);
    } catch (fallbackError) {
      console.error(`❌ 備案訊息也失敗:`, fallbackError.message);
    }
  }
}

// Webhook 路由
app.post('/webhook', (req, res) => {
  console.log(`📨 收到 Webhook 請求: ${new Date().toLocaleTimeString('zh-TW')}`);
  
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(`❌ Webhook 錯誤:`, err);
      res.status(500).end();
    });
});

// 任務管理 API
app.get('/api/tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const userTasks = tasks.get(userId) || [];
  res.json({ tasks: userTasks });
});

// 啟動伺服器
const PORT = process.env.PORT || 3016;
app.listen(PORT, () => {
  console.log(`🚀 簡化版 LINE Bot 啟動成功！`);
  console.log(`📡 伺服器運行於: http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL: 請設定到 LINE Developer Console`);
  console.log(`🎯 功能: 傳訊息 → Flex Message + 任務堆疊 + GitHub 自動提交`);
  console.log(`⚡ 準備接收 LINE 訊息...`);
});