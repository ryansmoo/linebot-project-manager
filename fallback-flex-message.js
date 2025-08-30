// 檢查並優化 Flex Message 備案策略

// 當 Flex Message 發送失敗時的備案邏輯
function createFallbackFlexMessage(taskText, todayTasks) {
  // 建立簡化但完整的 Flex Message
  return {
    type: 'flex',
    altText: `已新增任務: ${taskText}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ 任務已記錄',
            weight: 'bold',
            size: 'lg',
            color: '#2196F3'
          },
          {
            type: 'text',
            text: taskText,
            wrap: true,
            margin: 'md',
            color: '#333333'
          },
          {
            type: 'separator',
            margin: 'xl'
          },
          {
            type: 'text',
            text: `📋 今天共 ${todayTasks.length} 項任務`,
            margin: 'xl',
            size: 'sm',
            color: '#666666'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'message',
              label: '查看所有任務',
              text: '今天任務'
            }
          }
        ]
      }
    }
  };
}

// 當所有 Flex Message 都失敗時的最終備案
function createTextFallback(taskText, todayTasks) {
  const completedCount = todayTasks.filter(t => t.completed).length;
  const pendingCount = todayTasks.length - completedCount;
  
  let message = `✅ 任務已記錄: ${taskText}\n\n`;
  message += `📊 今天進度:\n`;
  message += `• 總任務: ${todayTasks.length} 項\n`;
  message += `• 已完成: ${completedCount} 項\n`;
  message += `• 待完成: ${pendingCount} 項\n\n`;
  
  if (todayTasks.length <= 5) {
    message += `📋 今天的任務:\n`;
    todayTasks.forEach((task, index) => {
      const status = task.completed ? '✓' : '○';
      message += `${index + 1}. ${status} ${task.text}\n`;
    });
  } else {
    message += `📋 最近的任務:\n`;
    todayTasks.slice(-3).forEach((task, index) => {
      const status = task.completed ? '✓' : '○';
      message += `${todayTasks.length - 2 + index}. ${status} ${task.text}\n`;
    });
  }
  
  return message.trim();
}

module.exports = {
  createFallbackFlexMessage,
  createTextFallback
};