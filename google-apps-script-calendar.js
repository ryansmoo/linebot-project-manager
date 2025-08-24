// Google Apps Script 程式碼
// 請將此程式碼複製到 Google Apps Script 專案中

// 設定 PropertiesService 來儲存使用者的授權資訊
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const lineUserId = data.lineUserId;
    
    switch(action) {
      case 'authorize':
        return handleAuthorization(lineUserId, data);
      case 'addEvent':
        return addCalendarEvent(lineUserId, data);
      case 'listEvents':
        return listCalendarEvents(lineUserId, data);
      case 'deleteEvent':
        return deleteCalendarEvent(lineUserId, data);
      case 'updateEvent':
        return updateCalendarEvent(lineUserId, data);
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: '不支援的操作'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    console.error('處理請求時發生錯誤:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  const lineUserId = e.parameter.lineUserId;
  const code = e.parameter.code;
  
  if (action === 'callback' && code) {
    return handleOAuthCallback(lineUserId, code);
  }
  
  if (action === 'authorize') {
    return generateAuthorizationUrl(lineUserId);
  }
  
  return ContentService.createTextOutput('請使用正確的參數');
}

// 生成 Google OAuth 授權 URL
function generateAuthorizationUrl(lineUserId) {
  const clientId = 'YOUR_GOOGLE_CLIENT_ID'; // 需要替換成你的 Google Client ID
  const redirectUri = ScriptApp.getService().getUrl() + '?action=callback&lineUserId=' + lineUserId;
  const scope = 'https://www.googleapis.com/auth/calendar';
  
  const authUrl = 'https://accounts.google.com/oauth/authorize?' +
    'client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=' + encodeURIComponent(scope) +
    '&response_type=code' +
    '&access_type=offline' +
    '&prompt=consent';
  
  // 返回重導向到授權頁面
  return HtmlService.createHtmlOutput(`
    <script>
      window.location.href = '${authUrl}';
    </script>
  `);
}

// 處理 OAuth 回調
function handleOAuthCallback(lineUserId, code) {
  try {
    const clientId = 'YOUR_GOOGLE_CLIENT_ID';
    const clientSecret = 'YOUR_GOOGLE_CLIENT_SECRET';
    const redirectUri = ScriptApp.getService().getUrl() + '?action=callback&lineUserId=' + lineUserId;
    
    const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }
    });
    
    const tokenData = JSON.parse(response.getContentText());
    
    if (tokenData.access_token) {
      // 儲存使用者的授權資訊
      const userStore = PropertiesService.getScriptProperties();
      userStore.setProperties({
        [lineUserId + '_access_token']: tokenData.access_token,
        [lineUserId + '_refresh_token']: tokenData.refresh_token || '',
        [lineUserId + '_authorized']: 'true'
      });
      
      return HtmlService.createHtmlOutput(`
        <html>
          <head><title>授權成功</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>✅ Google Calendar 授權成功！</h2>
            <p>你現在可以返回 LINE Bot 開始使用行事曆功能。</p>
            <p style="color: #666;">請關閉此視窗</p>
          </body>
        </html>
      `);
    } else {
      throw new Error('無法取得存取權杖');
    }
  } catch(error) {
    return HtmlService.createHtmlOutput(`
      <html>
        <head><title>授權失敗</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ 授權失敗</h2>
          <p>錯誤：${error.toString()}</p>
          <p>請重新嘗試授權</p>
        </body>
      </html>
    `);
  }
}

// 檢查使用者是否已授權
function isUserAuthorized(lineUserId) {
  const userStore = PropertiesService.getScriptProperties();
  return userStore.getProperty(lineUserId + '_authorized') === 'true';
}

// 取得使用者的存取權杖
function getUserAccessToken(lineUserId) {
  const userStore = PropertiesService.getScriptProperties();
  return userStore.getProperty(lineUserId + '_access_token');
}

// 新增行事曆事件
function addCalendarEvent(lineUserId, data) {
  if (!isUserAuthorized(lineUserId)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '使用者尚未授權',
      needAuth: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const accessToken = getUserAccessToken(lineUserId);
    const event = {
      summary: data.title,
      description: data.description || '',
      start: {
        dateTime: data.startTime,
        timeZone: 'Asia/Taipei'
      },
      end: {
        dateTime: data.endTime,
        timeZone: 'Asia/Taipei'
      }
    };
    
    const response = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(event)
    });
    
    const result = JSON.parse(response.getContentText());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      eventId: result.id,
      message: '行事曆事件已新增成功！'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '新增事件失敗: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 列出行事曆事件
function listCalendarEvents(lineUserId, data) {
  if (!isUserAuthorized(lineUserId)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '使用者尚未授權',
      needAuth: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const accessToken = getUserAccessToken(lineUserId);
    const timeMin = data.timeMin || new Date().toISOString();
    const maxResults = data.maxResults || 10;
    
    const response = UrlFetchApp.fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`, 
      {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      }
    );
    
    const result = JSON.parse(response.getContentText());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      events: result.items || []
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '取得事件失敗: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 刪除行事曆事件
function deleteCalendarEvent(lineUserId, data) {
  if (!isUserAuthorized(lineUserId)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '使用者尚未授權',
      needAuth: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const accessToken = getUserAccessToken(lineUserId);
    const eventId = data.eventId;
    
    const response = UrlFetchApp.fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '事件已刪除成功！'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '刪除事件失敗: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 更新行事曆事件
function updateCalendarEvent(lineUserId, data) {
  if (!isUserAuthorized(lineUserId)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '使用者尚未授權',
      needAuth: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const accessToken = getUserAccessToken(lineUserId);
    const eventId = data.eventId;
    const event = {
      summary: data.title,
      description: data.description || '',
      start: {
        dateTime: data.startTime,
        timeZone: 'Asia/Taipei'
      },
      end: {
        dateTime: data.endTime,
        timeZone: 'Asia/Taipei'
      }
    };
    
    const response = UrlFetchApp.fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(event)
    });
    
    const result = JSON.parse(response.getContentText());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '事件已更新成功！'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '更新事件失敗: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}