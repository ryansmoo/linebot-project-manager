-- Google Calendar 整合資料表
-- 請在 Supabase SQL Editor 中執行此腳本

-- 1. 建立 Google OAuth 授權資訊表
CREATE TABLE google_calendar_auth (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT DEFAULT 'https://www.googleapis.com/auth/calendar',
    is_authorized BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 建立 Calendar 同步記錄表
CREATE TABLE calendar_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(100) NOT NULL,
    task_id UUID REFERENCES user_tasks(id),
    action VARCHAR(50) NOT NULL, -- create, update, delete
    google_event_id VARCHAR(200),
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 建立索引
CREATE INDEX idx_google_calendar_auth_line_user_id ON google_calendar_auth(line_user_id);
CREATE INDEX idx_google_calendar_auth_authorized ON google_calendar_auth(is_authorized);

CREATE INDEX idx_calendar_sync_logs_line_user_id ON calendar_sync_logs(line_user_id);
CREATE INDEX idx_calendar_sync_logs_task_id ON calendar_sync_logs(task_id);
CREATE INDEX idx_calendar_sync_logs_status ON calendar_sync_logs(sync_status);
CREATE INDEX idx_calendar_sync_logs_created_at ON calendar_sync_logs(created_at DESC);

-- 4. 啟用 RLS
ALTER TABLE google_calendar_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

-- 5. 建立 RLS 政策
CREATE POLICY "Enable all operations for authenticated users" ON google_calendar_auth
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON calendar_sync_logs
    FOR ALL USING (true);

-- 6. 建立觸發器自動更新 updated_at
CREATE TRIGGER update_google_calendar_auth_updated_at 
    BEFORE UPDATE ON google_calendar_auth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_sync_logs_updated_at 
    BEFORE UPDATE ON calendar_sync_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 為 user_tasks 表添加 google_event_id 欄位（如果還沒有的話）
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(200);
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS sync_to_calendar BOOLEAN DEFAULT false;

-- 8. 建立索引
CREATE INDEX IF NOT EXISTS idx_user_tasks_google_event_id ON user_tasks(google_event_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_sync_to_calendar ON user_tasks(sync_to_calendar);

COMMENT ON TABLE google_calendar_auth IS 'Google Calendar OAuth 授權資訊';
COMMENT ON TABLE calendar_sync_logs IS 'Google Calendar 同步記錄';