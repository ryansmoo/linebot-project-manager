-- Supabase 資料庫結構設定
-- 請在 Supabase Dashboard 的 SQL Editor 中執行此腳本

-- 1. 建立用戶訊息表
CREATE TABLE user_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    direction VARCHAR(20) DEFAULT 'incoming', -- incoming, outgoing
    content TEXT NOT NULL,
    intent_detected VARCHAR(100),
    response_type VARCHAR(100),
    raw_data JSONB,
    processing_time INTEGER,
    is_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 建立用戶任務表
CREATE TABLE user_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) NOT NULL,
    task_text TEXT NOT NULL,
    task_title VARCHAR(500),
    task_description TEXT,
    task_time VARCHAR(100), -- 解析出的時間字串
    task_date DATE DEFAULT CURRENT_DATE,
    has_time BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, deleted
    priority INTEGER DEFAULT 1,
    tags JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. 建立用戶資料表
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200),
    email VARCHAR(300),
    profile_data JSONB,
    settings JSONB DEFAULT '{"chatMode": "smart", "notifications": true, "theme": "default"}',
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 建立用戶活動統計表
CREATE TABLE user_activity_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) NOT NULL,
    activity_date DATE DEFAULT CURRENT_DATE,
    message_count INTEGER DEFAULT 0,
    task_count INTEGER DEFAULT 0,
    completed_task_count INTEGER DEFAULT 0,
    ai_query_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(line_user_id, activity_date)
);

-- 5. 建立索引以提高查詢效能
CREATE INDEX idx_user_messages_line_user_id ON user_messages(line_user_id);
CREATE INDEX idx_user_messages_created_at ON user_messages(created_at DESC);
CREATE INDEX idx_user_messages_intent ON user_messages(intent_detected);

CREATE INDEX idx_user_tasks_line_user_id ON user_tasks(line_user_id);
CREATE INDEX idx_user_tasks_date ON user_tasks(task_date DESC);
CREATE INDEX idx_user_tasks_status ON user_tasks(status);
CREATE INDEX idx_user_tasks_has_time ON user_tasks(has_time);

CREATE INDEX idx_users_line_user_id ON users(line_user_id);
CREATE INDEX idx_users_last_activity ON users(last_activity_at DESC);

CREATE INDEX idx_user_activity_stats_user_date ON user_activity_stats(line_user_id, activity_date DESC);

-- 6. 建立 RLS (Row Level Security) 政策
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_stats ENABLE ROW LEVEL SECURITY;

-- 基本的 RLS 政策 (可依需求調整)
-- 注意：這裡使用簡單的政策，實際部署時應該根據安全需求調整

-- 用戶訊息表政策
CREATE POLICY "Enable all operations for authenticated users" ON user_messages
    FOR ALL USING (true);

-- 用戶任務表政策  
CREATE POLICY "Enable all operations for authenticated users" ON user_tasks
    FOR ALL USING (true);

-- 用戶表政策
CREATE POLICY "Enable all operations for authenticated users" ON users
    FOR ALL USING (true);

-- 用戶活動統計表政策
CREATE POLICY "Enable all operations for authenticated users" ON user_activity_stats
    FOR ALL USING (true);

-- 7. 建立觸發器自動更新 updated_at 欄位
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_messages_updated_at BEFORE UPDATE ON user_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at BEFORE UPDATE ON user_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_activity_stats_updated_at BEFORE UPDATE ON user_activity_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 插入測試資料 (可選)
-- INSERT INTO users (line_user_id, display_name) VALUES 
-- ('test_user_123', '測試用戶');

COMMENT ON TABLE user_messages IS '用戶訊息記錄表';
COMMENT ON TABLE user_tasks IS '用戶任務管理表';
COMMENT ON TABLE users IS '用戶基本資料表';
COMMENT ON TABLE user_activity_stats IS '用戶活動統計表';