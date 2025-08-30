require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Git 提交佇列，避免同時多個提交
let gitCommitQueue = [];
let isCommitting = false;

// 增強版自動 Git 提交功能
class AutoGitCommit {
  constructor() {
    this.commitQueue = [];
    this.isProcessing = false;
    this.lastCommitTime = 0;
    this.minCommitInterval = 5000; // 最小提交間隔 5 秒
    this.batchTimeout = null;
    this.pendingCommits = [];
  }

  // 添加提交到佇列
  addCommit(message, details = {}) {
    const commitData = {
      message: message,
      timestamp: Date.now(),
      details: {
        type: details.type || 'task', // task, update, delete, complete
        taskId: details.taskId,
        userId: details.userId,
        taskText: details.taskText
      }
    };

    console.log('📝 添加 Git 提交到佇列:', message);
    this.pendingCommits.push(commitData);
    
    // 清除之前的批次計時器
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // 設定批次提交計時器（3秒內的提交會被合併）
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, 3000);
  }

  // 處理批次提交
  async processBatch() {
    if (this.pendingCommits.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 開始處理 ${this.pendingCommits.length} 個待提交的變更`);

    try {
      // 合併相同類型的提交訊息
      const groupedCommits = this.groupCommitsByType(this.pendingCommits);
      const commitMessage = this.generateBatchCommitMessage(groupedCommits);
      
      // 執行 Git 提交
      await this.executeGitCommit(commitMessage);
      
      // 清空待處理提交
      this.pendingCommits = [];
      this.lastCommitTime = Date.now();
      
    } catch (error) {
      console.error('❌ 批次 Git 提交失敗:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // 按類型分組提交
  groupCommitsByType(commits) {
    const groups = {
      task: [],
      update: [],
      delete: [],
      complete: [],
      voice: [],
      other: []
    };

    commits.forEach(commit => {
      const type = commit.details.type;
      if (groups[type]) {
        groups[type].push(commit);
      } else {
        groups.other.push(commit);
      }
    });

    return groups;
  }

  // 生成批次提交訊息
  generateBatchCommitMessage(groupedCommits) {
    const messages = [];
    const taiwan_time = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dateStr = taiwan_time.toISOString().split('T')[0];
    const timeStr = taiwan_time.toTimeString().split(' ')[0];

    // 新增任務
    if (groupedCommits.task.length > 0) {
      messages.push(`📝 新增 ${groupedCommits.task.length} 個任務`);
    }

    // 更新任務
    if (groupedCommits.update.length > 0) {
      messages.push(`✏️ 更新 ${groupedCommits.update.length} 個任務`);
    }

    // 完成任務
    if (groupedCommits.complete.length > 0) {
      messages.push(`✅ 完成 ${groupedCommits.complete.length} 個任務`);
    }

    // 刪除任務
    if (groupedCommits.delete.length > 0) {
      messages.push(`🗑️ 刪除 ${groupedCommits.delete.length} 個任務`);
    }

    // 語音任務
    if (groupedCommits.voice.length > 0) {
      messages.push(`🎤 語音新增 ${groupedCommits.voice.length} 個任務`);
    }

    // 其他變更
    if (groupedCommits.other.length > 0) {
      messages.push(`🔧 其他變更 ${groupedCommits.other.length} 項`);
    }

    const mainMessage = messages.length > 0 
      ? messages.join(' | ') 
      : '📊 任務數據更新';

    return `${mainMessage}

📅 日期: ${dateStr}
⏰ 時間: ${timeStr}
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;
  }

  // 執行 Git 提交
  executeGitCommit(message) {
    return new Promise((resolve, reject) => {
      const commands = [
        'git add -A',
        'git status --porcelain', // 檢查是否有變更
      ].join(' && ');

      // 先檢查是否有變更
      exec(commands, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Git 檢查失敗:', error.message);
          reject(error);
          return;
        }

        // 如果沒有變更，跳過提交
        const statusOutput = stdout.split('\n').pop() || '';
        if (!statusOutput.trim()) {
          console.log('ℹ️ 沒有變更需要提交');
          resolve('No changes to commit');
          return;
        }

        console.log('📋 檢測到變更:', statusOutput);

        // 執行提交和推送
        const commitAndPushCommands = [
          `git commit -m "${message.replace(/"/g, '\\"')}"`,
          'git push origin main || git push origin master' // 嘗試 main 或 master 分支
        ].join(' && ');

        exec(commitAndPushCommands, { cwd: __dirname }, (commitError, commitStdout, commitStderr) => {
          if (commitError) {
            console.log('❌ Git 提交/推送失敗:', commitError.message);
            if (commitStderr) {
              console.log('⚠️ Git 錯誤詳情:', commitStderr);
            }
            reject(commitError);
            return;
          }

          if (commitStderr && !commitStderr.includes('warning')) {
            console.log('⚠️ Git 警告:', commitStderr);
          }

          console.log('✅ 成功提交並推送到 GitHub');
          console.log('📊 Git 輸出:', commitStdout);
          resolve(commitStdout);
        });
      });
    });
  }

  // 立即提交（緊急情況使用）
  async immediateCommit(message, details = {}) {
    if (this.isProcessing) {
      console.log('⚠️ Git 正在處理中，加入佇列等待');
      this.addCommit(message, details);
      return;
    }

    try {
      this.isProcessing = true;
      console.log('⚡ 執行立即 Git 提交:', message);
      await this.executeGitCommit(message);
    } catch (error) {
      console.error('❌ 立即提交失敗:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // 獲取提交統計
  getStats() {
    return {
      pendingCommits: this.pendingCommits.length,
      isProcessing: this.isProcessing,
      lastCommitTime: this.lastCommitTime,
      timeSinceLastCommit: Date.now() - this.lastCommitTime
    };
  }
}

// 建立全域實例
const gitCommitter = new AutoGitCommit();

// 導出函數供其他模組使用
module.exports = {
  // 新增任務
  commitNewTask: (taskText, userId, taskId) => {
    gitCommitter.addCommit(
      `新增任務: ${taskText.substring(0, 50)}`,
      { type: 'task', taskText, userId, taskId }
    );
  },

  // 更新任務
  commitUpdateTask: (taskText, userId, taskId) => {
    gitCommitter.addCommit(
      `更新任務: ${taskText.substring(0, 50)}`,
      { type: 'update', taskText, userId, taskId }
    );
  },

  // 完成任務
  commitCompleteTask: (taskText, userId, taskId, isCompleting) => {
    const action = isCompleting ? '完成' : '取消完成';
    gitCommitter.addCommit(
      `${action}任務: ${taskText.substring(0, 50)}`,
      { type: 'complete', taskText, userId, taskId }
    );
  },

  // 刪除任務
  commitDeleteTask: (taskText, userId, taskId) => {
    gitCommitter.addCommit(
      `刪除任務: ${taskText.substring(0, 50)}`,
      { type: 'delete', taskText, userId, taskId }
    );
  },

  // 語音任務
  commitVoiceTask: (taskText, userId, taskId) => {
    gitCommitter.addCommit(
      `語音新增任務: ${taskText.substring(0, 50)}`,
      { type: 'voice', taskText, userId, taskId }
    );
  },

  // 立即提交
  immediateCommit: (message) => {
    return gitCommitter.immediateCommit(message);
  },

  // 獲取統計
  getStats: () => gitCommitter.getStats(),

  // 原有的函數（向後兼容）
  autoGitCommit: (message) => {
    gitCommitter.addCommit(message, { type: 'other' });
  }
};

// 如果直接執行此檔案，進行測試
if (require.main === module) {
  console.log('🧪 測試 Git 自動提交功能...');
  
  const { commitNewTask, getStats } = module.exports;
  
  // 測試批次提交
  commitNewTask('測試任務 1', 'user1', 'task1');
  commitNewTask('測試任務 2', 'user1', 'task2');
  commitNewTask('測試任務 3', 'user1', 'task3');
  
  setTimeout(() => {
    console.log('📊 Git 提交統計:', getStats());
  }, 5000);
}