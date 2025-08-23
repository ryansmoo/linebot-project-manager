const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 資料庫檔案路徑
const DB_PATH = path.join(__dirname, 'linebot.db');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // 初始化資料庫連接
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
          return;
        }
        
        console.log('Connected to SQLite database');
        this.setupDatabase().then(() => {
          this.isInitialized = true;
          resolve();
        }).catch(reject);
      });
    });
  }

  // 設置資料庫架構
  async setupDatabase() {
    return new Promise((resolve, reject) => {
      const schemaSQL = fs.readFileSync(path.join(__dirname, 'database_setup.sql'), 'utf8');
      
      this.db.exec(schemaSQL, (err) => {
        if (err) {
          console.error('Database setup error:', err);
          reject(err);
          return;
        }
        
        console.log('Database schema initialized');
        resolve();
      });
    });
  }

  // 執行查詢
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // 執行單一操作 (INSERT, UPDATE, DELETE)
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Run error:', err);
          reject(err);
          return;
        }
        resolve({ 
          lastID: this.lastID, 
          changes: this.changes 
        });
      });
    });
  }

  // =============================================
  // 會員相關操作
  // =============================================

  // 建立會員
  async createMember(memberData) {
    const {
      memberId,
      lineUserId,
      email,
      name,
      displayName,
      profilePicture,
      language = 'zh-TW',
      timezone = 'Asia/Taipei',
      registrationMethod = 'manual',
      settings = '{}'
    } = memberData;

    const sql = `
      INSERT INTO members (
        member_id, line_user_id, email, name, display_name, 
        profile_picture, language, timezone, registration_method, settings,
        last_activity_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return await this.run(sql, [
      memberId, lineUserId, email, name, displayName,
      profilePicture, language, timezone, registrationMethod, 
      typeof settings === 'object' ? JSON.stringify(settings) : settings
    ]);
  }

  // 取得會員資料
  async getMember(identifier, type = 'line_user_id') {
    let sql = '';
    
    if (type === 'line_user_id') {
      sql = 'SELECT * FROM members WHERE line_user_id = ?';
    } else if (type === 'member_id') {
      sql = 'SELECT * FROM members WHERE member_id = ?';
    } else if (type === 'email') {
      sql = 'SELECT * FROM members WHERE email = ?';
    }

    const rows = await this.query(sql, [identifier]);
    return rows.length > 0 ? rows[0] : null;
  }

  // 更新會員資料
  async updateMember(memberId, updates) {
    const allowedFields = [
      'email', 'name', 'display_name', 'profile_picture', 
      'language', 'timezone', 'settings', 'is_active'
    ];

    const updateFields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(memberId);

    const sql = `UPDATE members SET ${updateFields.join(', ')} WHERE member_id = ?`;
    return await this.run(sql, values);
  }

  // 更新最後活動時間
  async updateLastActivity(lineUserId) {
    const sql = `
      UPDATE members 
      SET last_activity_at = CURRENT_TIMESTAMP 
      WHERE line_user_id = ?
    `;
    return await this.run(sql, [lineUserId]);
  }

  // =============================================
  // 聊天記錄相關操作
  // =============================================

  // 記錄聊天訊息
  async logChatMessage(logData) {
    const {
      lineUserId,
      memberId,
      messageType,
      direction,
      content,
      rawData,
      intentDetected,
      responseType,
      processingTime,
      isSuccessful = true,
      errorMessage = null,
      sessionId
    } = logData;

    const sql = `
      INSERT INTO chat_logs (
        line_user_id, member_id, message_type, direction, content,
        raw_data, intent_detected, response_type, processing_time,
        is_successful, error_message, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [
      lineUserId, memberId, messageType, direction, content,
      typeof rawData === 'object' ? JSON.stringify(rawData) : rawData,
      intentDetected, responseType, processingTime,
      isSuccessful, errorMessage, sessionId
    ]);
  }

  // 取得用戶聊天記錄
  async getChatHistory(lineUserId, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM chat_logs 
      WHERE line_user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    return await this.query(sql, [lineUserId, limit, offset]);
  }

  // =============================================
  // 任務相關操作
  // =============================================

  // 建立任務
  async createTask(taskData) {
    const {
      taskId,
      lineUserId,
      memberId,
      title,
      description = '',
      status = 'pending',
      priority = 1,
      dueDate = null,
      tags = '',
      source = 'line',
      metadata = '{}'
    } = taskData;

    const sql = `
      INSERT INTO tasks (
        task_id, line_user_id, member_id, title, description,
        status, priority, due_date, tags, source, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [
      taskId, lineUserId, memberId, title, description,
      status, priority, dueDate, tags, source,
      typeof metadata === 'object' ? JSON.stringify(metadata) : metadata
    ]);
  }

  // 取得用戶任務
  async getTasks(lineUserId, status = null, limit = 50) {
    let sql = `SELECT * FROM tasks WHERE line_user_id = ?`;
    let params = [lineUserId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    return await this.query(sql, params);
  }

  // 更新任務狀態
  async updateTaskStatus(taskId, status, completedAt = null) {
    let sql = `UPDATE tasks SET status = ?`;
    let params = [status];

    if (status === 'completed' && completedAt) {
      sql += `, completed_at = ?`;
      params.push(completedAt);
    }

    sql += ` WHERE task_id = ?`;
    params.push(taskId);

    return await this.run(sql, params);
  }

  // 刪除任務
  async deleteTask(taskId) {
    const sql = `DELETE FROM tasks WHERE task_id = ?`;
    return await this.run(sql, [taskId]);
  }

  // =============================================
  // 統計相關操作
  // =============================================

  // 更新用戶活動統計
  async updateActivityStats(lineUserId, activityType, count = 1) {
    const today = new Date().toISOString().split('T')[0];

    // 先檢查今日記錄是否存在
    const existingRecord = await this.query(
      'SELECT * FROM user_activity_stats WHERE line_user_id = ? AND date = ?',
      [lineUserId, today]
    );

    if (existingRecord.length > 0) {
      // 更新現有記錄
      const updateField = this.getActivityField(activityType);
      const sql = `
        UPDATE user_activity_stats 
        SET ${updateField} = ${updateField} + ?, last_activity_at = CURRENT_TIMESTAMP
        WHERE line_user_id = ? AND date = ?
      `;
      return await this.run(sql, [count, lineUserId, today]);
    } else {
      // 建立新記錄
      const member = await this.getMember(lineUserId);
      const memberId = member ? member.member_id : null;

      const fieldMap = {
        message_count: 0,
        task_created: 0,
        task_completed: 0,
        ai_queries: 0,
        liff_visits: 0
      };

      const activityField = this.getActivityField(activityType);
      fieldMap[activityField] = count;

      const sql = `
        INSERT INTO user_activity_stats (
          line_user_id, member_id, date, message_count, task_created,
          task_completed, ai_queries, liff_visits, first_activity_at, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      return await this.run(sql, [
        lineUserId, memberId, today,
        fieldMap.message_count, fieldMap.task_created, fieldMap.task_completed,
        fieldMap.ai_queries, fieldMap.liff_visits
      ]);
    }
  }

  // 取得活動統計欄位名稱
  getActivityField(activityType) {
    const fieldMap = {
      'message': 'message_count',
      'task_create': 'task_created',
      'task_complete': 'task_completed',
      'ai_query': 'ai_queries',
      'liff_visit': 'liff_visits'
    };
    return fieldMap[activityType] || 'message_count';
  }

  // 取得用戶統計資料
  async getUserStats(lineUserId, days = 30) {
    const sql = `
      SELECT * FROM user_activity_stats 
      WHERE line_user_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date DESC
    `;
    return await this.query(sql, [lineUserId]);
  }

  // =============================================
  // 系統日誌相關操作
  // =============================================

  // 記錄系統日誌
  async logSystem(level, category, message, details = null, userId = null, ipAddress = null, userAgent = null) {
    const sql = `
      INSERT INTO system_logs (level, category, message, details, user_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [
      level, category, message,
      typeof details === 'object' ? JSON.stringify(details) : details,
      userId, ipAddress, userAgent
    ]);
  }

  // 取得系統日誌
  async getSystemLogs(level = null, category = null, limit = 100) {
    let sql = 'SELECT * FROM system_logs WHERE 1=1';
    let params = [];

    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await this.query(sql, params);
  }

  // =============================================
  // 管理功能
  // =============================================

  // 取得資料庫統計
  async getDatabaseStats() {
    const stats = {};

    // 會員數量
    const memberCount = await this.query('SELECT COUNT(*) as count FROM members');
    stats.totalMembers = memberCount[0].count;

    // 聊天記錄數量
    const chatCount = await this.query('SELECT COUNT(*) as count FROM chat_logs');
    stats.totalChatLogs = chatCount[0].count;

    // 任務數量
    const taskCount = await this.query('SELECT COUNT(*) as count FROM tasks');
    stats.totalTasks = taskCount[0].count;

    // 今日活動會員
    const activeToday = await this.query(`
      SELECT COUNT(DISTINCT line_user_id) as count 
      FROM user_activity_stats 
      WHERE date = date('now')
    `);
    stats.activeMembersToday = activeToday[0].count;

    return stats;
  }

  // 關閉資料庫連接
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

// 建立全域資料庫實例
const database = new Database();

module.exports = database;