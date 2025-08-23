-- LINE 用戶註冊系統資料庫結構

-- 1. 用戶主表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,                    -- 系統內部唯一ID
    email VARCHAR(255),                                  -- 用戶郵箱（可選）
    username VARCHAR(100),                               -- 用戶名（可選）
    display_name VARCHAR(200),                           -- 顯示名稱
    avatar_url TEXT,                                     -- 頭像URL
    status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_uuid (uuid),
    INDEX idx_status (status)
);

-- 2. LINE 綁定表
CREATE TABLE line_bindings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,                                -- 關聯 users.id
    line_user_id VARCHAR(100) UNIQUE NOT NULL,           -- LINE UserID (U開頭)
    line_display_name VARCHAR(200),                      -- LINE 顯示名稱
    line_picture_url TEXT,                               -- LINE 頭像
    line_email VARCHAR(255),                             -- LINE 郵箱（需申請權限）
    access_token TEXT,                                   -- LINE Access Token
    refresh_token TEXT,                                  -- LINE Refresh Token
    token_expires_at TIMESTAMP NULL,                     -- Token 過期時間
    first_binding_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_friend BOOLEAN DEFAULT FALSE,                     -- 是否為好友
    friend_added_at TIMESTAMP NULL,                      -- 成為好友時間
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_line_user_id (line_user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_friend (is_friend)
);

-- 3. 用戶任務表（現有功能保留）
CREATE TABLE user_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    task_id BIGINT NOT NULL,                             -- 原本的時間戳ID
    task_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_task_id (task_id)
);

-- 4. LINE Login 狀態表（安全性）
CREATE TABLE line_oauth_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    state_token VARCHAR(64) UNIQUE NOT NULL,             -- 隨機狀態值
    user_session_id VARCHAR(128),                        -- 用戶 session ID
    ip_address VARCHAR(45),                              -- 用戶IP
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,                       -- 狀態過期時間
    is_used BOOLEAN DEFAULT FALSE,                       -- 是否已使用
    
    INDEX idx_state_token (state_token),
    INDEX idx_expires (expires_at)
);

-- 5. 系統日誌表（審計用）
CREATE TABLE system_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    line_user_id VARCHAR(100) NULL,
    action VARCHAR(100) NOT NULL,                        -- login, register, bind, message_sent
    details JSON,                                        -- 詳細資訊
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_action_created (action, created_at),
    INDEX idx_user_id (user_id),
    INDEX idx_line_user_id (line_user_id)
);

-- 創建初始索引和約束
ALTER TABLE line_bindings ADD CONSTRAINT uk_one_line_per_user 
    UNIQUE KEY (user_id, line_user_id);

-- 清理過期狀態的存儲程序
DELIMITER //
CREATE EVENT cleanup_expired_oauth_states
ON SCHEDULE EVERY 1 HOUR
DO
  DELETE FROM line_oauth_states 
  WHERE expires_at < NOW() OR (created_at < DATE_SUB(NOW(), INTERVAL 1 DAY));
//
DELIMITER ;