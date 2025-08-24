// Google Calendar 服務模組
require('dotenv').config();
const { google } = require('googleapis');
const supabaseConfig = require('./supabase-config');

// Google OAuth 設定
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3015/auth/google/callback'
);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// 生成 Google OAuth 授權 URL
function generateAuthUrl(lineUserId, state = 'calendar_auth') {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: JSON.stringify({ lineUserId, state }),
    prompt: 'consent'
  });
  
  return authUrl;
}

// 處理 OAuth 回調，取得 tokens
async function handleOAuthCallback(code, state) {
  try {
    const { tokens } = await oauth2Client.getAccessToken(code);
    const { lineUserId } = JSON.parse(state);
    
    // 儲存 tokens 到 Supabase
    const result = await supabaseConfig.supabase
      .from('google_calendar_auth')
      .upsert({
        line_user_id: lineUserId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(tokens.expiry_date).toISOString(),
        is_authorized: true,
        last_sync_at: new Date().toISOString()
      })
      .select();
    
    if (result.error) {
      console.error('儲存授權資訊失敗:', result.error);
      return { success: false, error: result.error };
    }
    
    console.log(`✅ Google Calendar 授權成功 - User: ${lineUserId}`);
    return { success: true, data: result.data[0] };
    
  } catch (error) {
    console.error('OAuth 回調處理失敗:', error);
    return { success: false, error: error.message };
  }
}

// 檢查用戶是否已授權
async function isUserAuthorized(lineUserId) {
  try {
    const { data, error } = await supabaseConfig.supabase
      .from('google_calendar_auth')
      .select('*')
      .eq('line_user_id', lineUserId)
      .eq('is_authorized', true)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    // 檢查 token 是否過期
    if (data.token_expires_at && new Date(data.token_expires_at) <= new Date()) {
      // 嘗試刷新 token
      return await refreshAccessToken(lineUserId);
    }
    
    return true;
  } catch (error) {
    console.error('檢查授權狀態失敗:', error);
    return false;
  }
}

// 刷新 access token
async function refreshAccessToken(lineUserId) {
  try {
    const { data, error } = await supabaseConfig.supabase
      .from('google_calendar_auth')
      .select('refresh_token')
      .eq('line_user_id', lineUserId)
      .single();
    
    if (error || !data?.refresh_token) {
      return false;
    }
    
    oauth2Client.setCredentials({
      refresh_token: data.refresh_token
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // 更新資料庫中的 tokens
    const updateResult = await supabaseConfig.supabase
      .from('google_calendar_auth')
      .update({
        access_token: credentials.access_token,
        token_expires_at: new Date(credentials.expiry_date).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', lineUserId);
    
    if (updateResult.error) {
      console.error('更新 token 失敗:', updateResult.error);
      return false;
    }
    
    console.log(`✅ Token 刷新成功 - User: ${lineUserId}`);
    return true;
    
  } catch (error) {
    console.error('刷新 token 失敗:', error);
    return false;
  }
}

// 取得用戶的授權資訊
async function getUserAuthInfo(lineUserId) {
  try {
    const { data, error } = await supabaseConfig.supabase
      .from('google_calendar_auth')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();
    
    if (error) {
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 設定 OAuth2 客戶端憑證
async function setUserCredentials(lineUserId) {
  const authInfo = await getUserAuthInfo(lineUserId);
  if (!authInfo.success) {
    return false;
  }
  
  oauth2Client.setCredentials({
    access_token: authInfo.data.access_token,
    refresh_token: authInfo.data.refresh_token,
    expiry_date: new Date(authInfo.data.token_expires_at).getTime()
  });
  
  return true;
}

// 創建 Calendar 事件
async function createCalendarEvent(lineUserId, eventData) {
  try {
    // 檢查授權
    const isAuth = await isUserAuthorized(lineUserId);
    if (!isAuth) {
      return { success: false, error: '用戶尚未授權', needAuth: true };
    }
    
    // 設定用戶憑證
    await setUserCredentials(lineUserId);
    
    // 準備事件資料
    const event = {
      summary: eventData.title,
      description: eventData.description || `LINE Bot 任務：${eventData.title}`,
      start: {
        dateTime: eventData.startTime,
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'Asia/Taipei',
      },
    };
    
    // 創建事件
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    
    const googleEventId = response.data.id;
    
    // 記錄同步日誌
    await logCalendarSync(lineUserId, eventData.taskId, 'create', googleEventId, 'success', event, response.data);
    
    // 更新任務表中的 google_event_id
    if (eventData.taskId) {
      await supabaseConfig.supabase
        .from('user_tasks')
        .update({ 
          google_event_id: googleEventId,
          sync_to_calendar: true 
        })
        .eq('id', eventData.taskId);
    }
    
    console.log(`✅ Calendar 事件創建成功 - User: ${lineUserId}, Event: ${googleEventId}`);
    
    return {
      success: true,
      eventId: googleEventId,
      eventUrl: response.data.htmlLink,
      message: '事件已成功同步到 Google Calendar！'
    };
    
  } catch (error) {
    console.error('創建 Calendar 事件失敗:', error);
    
    // 記錄錯誤日誌
    await logCalendarSync(lineUserId, eventData.taskId, 'create', null, 'failed', eventData, null, error.message);
    
    return { 
      success: false, 
      error: `創建事件失敗: ${error.message}` 
    };
  }
}

// 記錄 Calendar 同步日誌
async function logCalendarSync(lineUserId, taskId, action, googleEventId, status, requestData, responseData, errorMessage = null) {
  try {
    const logData = {
      line_user_id: lineUserId,
      task_id: taskId,
      action: action,
      google_event_id: googleEventId,
      sync_status: status,
      error_message: errorMessage,
      request_data: requestData,
      response_data: responseData
    };
    
    await supabaseConfig.supabase
      .from('calendar_sync_logs')
      .insert([logData]);
      
    console.log(`📝 Calendar 同步日誌已記錄 - Action: ${action}, Status: ${status}`);
    
  } catch (error) {
    console.error('記錄同步日誌失敗:', error);
  }
}

// 解析任務時間為 Google Calendar 格式
function parseTaskTimeToCalendarFormat(taskText, taskTime) {
  const now = new Date();
  let startTime, endTime;
  
  // 如果包含日期資訊（如 2025/08/25）
  const dateMatch = taskText.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  let baseDate = new Date();
  
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // 解析時間
  const timeMatch = taskTime.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    startTime = new Date(baseDate);
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // 預設事件長度為 1 小時
    endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
  } else {
    // 如果無法解析時間，設定為下一個小時
    startTime = new Date(now.getTime() + 60 * 60 * 1000);
    endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  }
  
  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };
}

module.exports = {
  generateAuthUrl,
  handleOAuthCallback,
  isUserAuthorized,
  createCalendarEvent,
  parseTaskTimeToCalendarFormat,
  getUserAuthInfo,
  refreshAccessToken
};