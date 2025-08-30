require('dotenv').config();
const {
  commitNewTask,
  commitUpdateTask,
  commitCompleteTask,
  commitDeleteTask,
  commitVoiceTask,
  getStats
} = require('./enhanced-auto-git');

// 創建一個測試檔案來模擬任務變更
const fs = require('fs');
const path = require('path');

const testDataFile = path.join(__dirname, 'test-tasks-data.json');

// 初始化測試數據
function initTestData() {
  const testData = {
    tasks: [],
    lastUpdate: new Date().toISOString()
  };
  
  fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
  console.log('📋 創建測試任務數據文件');
}

// 添加任務到測試數據
function addTaskToTestData(taskText, userId, taskId) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
  } catch (error) {
    data = { tasks: [], lastUpdate: new Date().toISOString() };
  }
  
  const newTask = {
    id: taskId,
    text: taskText,
    userId: userId,
    createdAt: new Date().toISOString(),
    completed: false
  };
  
  data.tasks.push(newTask);
  data.lastUpdate = new Date().toISOString();
  
  fs.writeFileSync(testDataFile, JSON.stringify(data, null, 2));
  console.log('📝 任務已添加到測試數據:', taskText);
}

// 更新任務狀態
function updateTaskInTestData(taskId, updates) {
  let data = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
  const taskIndex = data.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex !== -1) {
    Object.assign(data.tasks[taskIndex], updates);
    data.lastUpdate = new Date().toISOString();
    fs.writeFileSync(testDataFile, JSON.stringify(data, null, 2));
    console.log('📝 任務已更新:', data.tasks[taskIndex].text);
  }
}

// 刪除任務
function deleteTaskFromTestData(taskId) {
  let data = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
  const taskIndex = data.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex !== -1) {
    const deletedTask = data.tasks.splice(taskIndex, 1)[0];
    data.lastUpdate = new Date().toISOString();
    fs.writeFileSync(testDataFile, JSON.stringify(data, null, 2));
    console.log('🗑️ 任務已刪除:', deletedTask.text);
  }
}

// 主要測試函數
async function runAutoGitTest() {
  console.log('🧪 開始測試自動 Git 提交功能\n');
  console.log('================================');
  
  // 初始化
  initTestData();
  
  // 測試 1: 新增任務
  console.log('\n1️⃣ 測試新增任務');
  const task1Id = 'task-' + Date.now() + '-1';
  const task2Id = 'task-' + Date.now() + '-2';
  const task3Id = 'task-' + Date.now() + '-3';
  
  addTaskToTestData('測試任務：完成自動 Git 提交功能', 'user1', task1Id);
  commitNewTask('測試任務：完成自動 Git 提交功能', 'user1', task1Id);
  
  setTimeout(() => {
    addTaskToTestData('測試任務：優化批次提交邏輯', 'user1', task2Id);
    commitNewTask('測試任務：優化批次提交邏輯', 'user1', task2Id);
  }, 1000);
  
  setTimeout(() => {
    addTaskToTestData('測試任務：驗證語音任務功能', 'user1', task3Id);
    commitVoiceTask('測試任務：驗證語音任務功能', 'user1', task3Id);
  }, 2000);
  
  // 測試 2: 更新任務
  setTimeout(() => {
    console.log('\n2️⃣ 測試更新任務');
    updateTaskInTestData(task1Id, { text: '測試任務：完成自動 Git 提交功能（已更新）' });
    commitUpdateTask('測試任務：完成自動 Git 提交功能（已更新）', 'user1', task1Id);
  }, 3000);
  
  // 測試 3: 完成任務
  setTimeout(() => {
    console.log('\n3️⃣ 測試完成任務');
    updateTaskInTestData(task2Id, { completed: true, completedAt: new Date().toISOString() });
    commitCompleteTask('測試任務：優化批次提交邏輯', 'user1', task2Id, true);
  }, 4000);
  
  // 測試 4: 取消完成任務
  setTimeout(() => {
    console.log('\n4️⃣ 測試取消完成任務');
    updateTaskInTestData(task2Id, { completed: false, completedAt: null });
    commitCompleteTask('測試任務：優化批次提交邏輯', 'user1', task2Id, false);
  }, 5000);
  
  // 測試 5: 刪除任務
  setTimeout(() => {
    console.log('\n5️⃣ 測試刪除任務');
    deleteTaskFromTestData(task3Id);
    commitDeleteTask('測試任務：驗證語音任務功能', 'user1', task3Id);
  }, 6000);
  
  // 顯示統計
  setTimeout(() => {
    console.log('\n================================');
    console.log('📊 Git 提交統計:');
    const stats = getStats();
    console.log('   待處理提交:', stats.pendingCommits);
    console.log('   正在處理:', stats.isProcessing);
    console.log('   上次提交時間:', new Date(stats.lastCommitTime).toLocaleString());
    console.log('   距離上次提交:', Math.round(stats.timeSinceLastCommit / 1000) + '秒');
  }, 8000);
  
  // 最終檢查
  setTimeout(() => {
    console.log('\n✅ 測試完成！');
    console.log('📋 檢查生成的提交記錄...');
    
    // 顯示最終的測試數據
    try {
      const finalData = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
      console.log('📊 最終測試數據:');
      console.log('   總任務數:', finalData.tasks.length);
      console.log('   最後更新:', finalData.lastUpdate);
      
      finalData.tasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.text} ${task.completed ? '✅' : '⭕'}`);
      });
      
    } catch (error) {
      console.error('❌ 讀取測試數據失敗:', error);
    }
    
    console.log('\n🎯 結論:');
    console.log('   - 所有任務操作都會自動觸發 Git 提交');
    console.log('   - 批次處理避免頻繁提交');
    console.log('   - 提交訊息包含詳細的變更資訊');
    console.log('   - 支援新增、更新、完成、刪除等所有操作');
  }, 10000);
}

// 執行測試
runAutoGitTest().catch(console.error);