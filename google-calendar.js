require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Google Calendar API 設定
class GoogleCalendarService {
  constructor() {
    this.credentials = null;
    this.oauth2Client = null;
    this.calendar = null;
    this.userTokens = new Map(); // 儲存每個用戶的 token
    
    this.initializeAuth();
  }

  initializeAuth() {
    try {
      // 從環境變數讀取 Google OAuth2 設定
      const credentials = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback']
      };

      this.credentials = credentials;
      this.oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris[0]
      );

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      console.log('✅ Google Calendar API 初始化成功');
    } catch (error) {
      console.error('❌ Google Calendar API 初始化失敗:', error.message);
    }
  }

  // 生成授權 URL
  generateAuthUrl(userId, state = null) {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 客戶端未初始化');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ userId, customState: state }),
      prompt: 'consent' // 強制顯示同意畫面以獲取 refresh token
    });

    console.log(`📅 為用戶 ${userId} 生成授權 URL`);
    return authUrl;
  }

  // 處理授權回調
  async handleAuthCallback(code, state) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      const stateData = JSON.parse(state);
      const userId = stateData.userId;

      // 儲存用戶的 tokens
      this.userTokens.set(userId, {
        ...tokens,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ 用戶 ${userId} Google Calendar 授權成功`);
      return { success: true, userId };
    } catch (error) {
      console.error('❌ Google Calendar 授權失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  // 檢查用戶是否已授權
  isUserAuthorized(userId) {
    return this.userTokens.has(userId);
  }

  // 設定用戶的 OAuth2 客戶端
  setUserAuth(userId) {
    const userToken = this.userTokens.get(userId);
    if (!userToken) {
      throw new Error('用戶未授權 Google Calendar');
    }

    this.oauth2Client.setCredentials(userToken);
    return true;
  }

  // 創建日曆事件
  async createCalendarEvent(userId, eventData) {
    try {
      if (!this.isUserAuthorized(userId)) {
        throw new Error('用戶未授權 Google Calendar');
      }

      this.setUserAuth(userId);

      // 解析時間和日期
      const { title, time, date, description } = eventData;
      
      // 預設為今天
      const eventDate = date || new Date().toISOString().split('T')[0];
      
      // 解析時間 (格式: HH:MM 或 H:MM)
      let startDateTime, endDateTime;
      if (time) {
        const [hours, minutes] = time.split(':').map(num => parseInt(num));
        const startDate = new Date(`${eventDate}T00:00:00+08:00`);
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setHours(hours + 1, minutes, 0, 0); // 預設 1 小時長度
        
        startDateTime = startDate.toISOString();
        endDateTime = endDate.toISOString();
      } else {
        // 如果沒有時間，設為全天事件
        startDateTime = eventDate;
        endDateTime = eventDate;
      }

      const event = {
        summary: title,
        description: description || `由 LINE Bot 記事機器人創建\n原始內容: ${title}`,
        start: time ? {
          dateTime: startDateTime,
          timeZone: 'Asia/Taipei'
        } : {
          date: eventDate
        },
        end: time ? {
          dateTime: endDateTime,
          timeZone: 'Asia/Taipei'
        } : {
          date: eventDate
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 60 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      console.log(`✅ 成功為用戶 ${userId} 創建日曆事件: ${title}`);
      return {
        success: true,
        eventId: response.data.id,
        eventUrl: response.data.htmlLink,
        event: response.data
      };

    } catch (error) {
      console.error(`❌ 創建日曆事件失敗:`, error.message);
      
      // 檢查是否為授權過期
      if (error.code === 401) {
        this.userTokens.delete(userId);
        return {
          success: false,
          error: 'authorization_expired',
          message: 'Google Calendar 授權已過期，請重新授權'
        };
      }
      
      return {
        success: false,
        error: error.code || 'unknown_error',
        message: error.message
      };
    }
  }

  // 獲取用戶的日曆事件列表
  async getUserEvents(userId, timeMin = null, timeMax = null) {
    try {
      if (!this.isUserAuthorized(userId)) {
        throw new Error('用戶未授權 Google Calendar');
      }

      this.setUserAuth(userId);

      const params = {
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20
      };

      const response = await this.calendar.events.list(params);
      
      console.log(`✅ 成功獲取用戶 ${userId} 的日曆事件`);
      return {
        success: true,
        events: response.data.items || []
      };

    } catch (error) {
      console.error(`❌ 獲取日曆事件失敗:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 移除用戶授權
  revokeUserAuth(userId) {
    if (this.userTokens.has(userId)) {
      this.userTokens.delete(userId);
      console.log(`✅ 已移除用戶 ${userId} 的 Google Calendar 授權`);
      return true;
    }
    return false;
  }

  // 獲取所有已授權用戶
  getAuthorizedUsers() {
    return Array.from(this.userTokens.keys());
  }
}

// 全域實例
const googleCalendarService = new GoogleCalendarService();

module.exports = googleCalendarService;