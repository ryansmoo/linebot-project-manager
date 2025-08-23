-- =============================================
-- LINE Bot 資料庫架構設計
-- =============================================

-- 1. 會員資料表
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id VARCHAR(100) UNIQUE NOT NULL,           -- 系統生成的會員ID
    line_user_id VARCHAR(100) UNIQUE,                 -- LINE 用戶ID
    email VARCHAR(255),                               -- 電子郵件
    name VARCHAR(100),                                -- 姓名
    display_name VARCHAR(100),                        -- LINE 顯示名稱
    profile_picture VARCHAR(500),                     -- 頭像URL
    language VARCHAR(10) DEFAULT 'zh-TW',            -- 語言偏好
    timezone VARCHAR(50) DEFAULT 'Asia/Taipei',       -- 時區
    is_active BOOLEAN DEFAULT 1,                     -- 是否啟用
    registration_method VARCHAR(20) DEFAULT 'manual', -- 註冊方式：manual, line_login
    settings TEXT,                                    -- JSON格式的用戶設定
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 建立時間
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 更新時間
    last_login_at DATETIME,                          -- 最後登入時間
    last_activity_at DATETIME                        -- 最後活動時間
);

-- 2. LINE OA 互動記錄表
CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id VARCHAR(100) NOT NULL,              -- LINE 用戶ID
    member_id VARCHAR(100),                           -- 關聯會員ID
    message_type VARCHAR(20) NOT NULL,               -- 訊息類型：text, image, sticker等
    direction VARCHAR(10) NOT NULL,                  -- 方向：incoming, outgoing
    content TEXT,                                     -- 訊息內容
    raw_data TEXT,                                    -- 原始資料(JSON格式)
    intent_detected VARCHAR(50),                      -- 識別的意圖
    response_type VARCHAR(50),                        -- 回應類型：task, ai, help等
    processing_time INTEGER,                          -- 處理時間(毫秒)
    is_successful BOOLEAN DEFAULT 1,                 -- 是否處理成功
    error_message TEXT,                              -- 錯誤訊息
    session_id VARCHAR(100),                         -- 對話會話ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 建立時間
    
    FOREIGN KEY (member_id) REFERENCES members(member_id)
);

-- 3. 任務記錄表
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id VARCHAR(100) UNIQUE NOT NULL,            -- 系統生成的任務ID
    line_user_id VARCHAR(100) NOT NULL,              -- LINE 用戶ID
    member_id VARCHAR(100),                           -- 關聯會員ID
    title TEXT NOT NULL,                             -- 任務標題
    description TEXT,                                -- 任務描述
    status VARCHAR(20) DEFAULT 'pending',            -- 狀態：pending, completed, cancelled
    priority INTEGER DEFAULT 1,                      -- 優先級：1-5
    due_date DATETIME,                               -- 截止日期
    completed_at DATETIME,                           -- 完成時間
    tags VARCHAR(500),                               -- 標籤(逗號分隔)
    reminder_count INTEGER DEFAULT 0,                -- 提醒次數
    source VARCHAR(20) DEFAULT 'line',               -- 來源：line, liff, api
    metadata TEXT,                                   -- 額外資料(JSON格式)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 建立時間
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 更新時間
    
    FOREIGN KEY (member_id) REFERENCES members(member_id)
);

-- 4. 用戶活動統計表
CREATE TABLE IF NOT EXISTS user_activity_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id VARCHAR(100) NOT NULL,              -- LINE 用戶ID
    member_id VARCHAR(100),                           -- 關聯會員ID
    date DATE NOT NULL,                              -- 統計日期
    message_count INTEGER DEFAULT 0,                 -- 訊息數量
    task_created INTEGER DEFAULT 0,                  -- 建立任務數
    task_completed INTEGER DEFAULT 0,                -- 完成任務數
    ai_queries INTEGER DEFAULT 0,                    -- AI查詢次數
    liff_visits INTEGER DEFAULT 0,                   -- LIFF訪問次數
    total_session_time INTEGER DEFAULT 0,            -- 總會話時間(秒)
    first_activity_at DATETIME,                      -- 當日首次活動
    last_activity_at DATETIME,                       -- 當日最後活動
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- 建立時間
    
    FOREIGN KEY (member_id) REFERENCES members(member_id),
    UNIQUE(line_user_id, date)
);

-- 5. 系統日誌表
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level VARCHAR(20) NOT NULL,                      -- 日誌等級：info, warning, error
    category VARCHAR(50) NOT NULL,                   -- 分類：auth, webhook, api等
    message TEXT NOT NULL,                           -- 日誌訊息
    details TEXT,                                    -- 詳細資料(JSON格式)
    user_id VARCHAR(100),                            -- 相關用戶ID
    ip_address VARCHAR(45),                          -- IP地址
    user_agent TEXT,                                 -- User Agent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP    -- 建立時間
);

-- =============================================
-- 索引建立
-- =============================================

-- 會員表索引
CREATE INDEX IF NOT EXISTS idx_members_line_user_id ON members(line_user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);

-- 聊天記錄索引
CREATE INDEX IF NOT EXISTS idx_chat_logs_line_user_id ON chat_logs(line_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_member_id ON chat_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_message_type ON chat_logs(message_type);

-- 任務記錄索引
CREATE INDEX IF NOT EXISTS idx_tasks_line_user_id ON tasks(line_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_member_id ON tasks(member_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 活動統計索引
CREATE INDEX IF NOT EXISTS idx_activity_stats_user_date ON user_activity_stats(line_user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_stats_date ON user_activity_stats(date);

-- 系統日誌索引
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- =============================================
-- 觸發器 - 自動更新時間戳
-- =============================================

-- 會員表更新觸發器
CREATE TRIGGER IF NOT EXISTS update_members_timestamp 
    AFTER UPDATE ON members
    FOR EACH ROW
    BEGIN
        UPDATE members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- 任務表更新觸發器
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    FOR EACH ROW
    BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =============================================
-- 初始資料插入
-- =============================================

-- 插入系統啟動日誌
INSERT OR IGNORE INTO system_logs (level, category, message, details) 
VALUES ('info', 'database', 'Database schema initialized', '{"version": "1.0", "tables_created": 5}');