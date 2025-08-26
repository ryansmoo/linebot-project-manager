# 🚀 Railway 部署資訊

## 📅 部署日期
2025-08-26 10:45:31

## 🔗 Railway 應用程式 URL
請在完成部署後更新此處：
```
https://your-app-name.up.railway.app
```

## 🔧 需要更新的 LINE Settings

### Webhook URL
```
https://your-app-name.up.railway.app/webhook
```

### LIFF App Endpoint URL  
```
https://your-app-name.up.railway.app/liff/tasks
```

### LINE Login Callback URL
```
https://your-app-name.up.railway.app/auth/line/callback
```

### Google Calendar OAuth Redirect URI
```
https://your-app-name.up.railway.app/auth/google/callback
```

## 📝 測試清單

- [ ] 健康檢查: https://your-url/health
- [ ] 主頁: https://your-url/
- [ ] LINE Bot 回應測試
- [ ] 任務記錄功能
- [ ] Google Calendar 整合
- [ ] LIFF App 功能
- [ ] 管理後台: https://your-url/admin/dashboard

## 🚀 部署完成後記得：

1. 更新 .env 中的 BASE_URL
2. 重新設定 Google Cloud Console OAuth 重新導向 URI
3. 測試所有功能
4. 記錄實際的 Railway URL 到此檔案

