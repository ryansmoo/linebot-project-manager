// 測試 Google Calendar 整合功能
require('dotenv').config();
const { google } = require('googleapis');

console.log('🧪 測試 Google Calendar 整合功能');
console.log('====================================');

// 測試時間偵測功能
function extractTimeFromText(text) {
    const timePattern = /(\d{1,2})[：:]\d{2}/;
    const match = text.match(timePattern);
    
    if (match) {
        const timeStr = match[0].replace('：', ':');
        const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
        
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return {
                hasTime: true,
                time: timeStr,
                hours: hours,
                minutes: minutes,
                textWithoutTime: text.replace(timePattern, '').trim(),
                originalText: text
            };
        }
    }
    
    return {
        hasTime: false,
        time: null,
        hours: null,
        minutes: null,
        textWithoutTime: text,
        originalText: text
    };
}

// 測試用例
const testMessages = [
    '20:00 散步',
    '早上09:30 開會',
    '14:15 午餐',
    '沒有時間格式的訊息',
    '23:59 睡前閱讀',
    '8:00 起床'
];

console.log('🕐 測試時間偵測功能:');
testMessages.forEach(msg => {
    const result = extractTimeFromText(msg);
    console.log(`輸入: "${msg}"`);
    console.log(`結果: ${result.hasTime ? '✅' : '❌'} 時間=${result.time} 任務="${result.textWithoutTime}"`);
    console.log('---');
});

// 測試 Google Calendar 授權 URL 生成
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'https://tasty-fireant-11.loca.lt/auth/google/callback';

console.log('\n📅 Google Calendar 設定:');
console.log('CLIENT_ID:', clientId);
console.log('REDIRECT_URI:', redirectUri);

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
    ],
    state: JSON.stringify({ userId: 'test-user', task: '20:00 散步', test: true }),
    prompt: 'consent'
});

console.log('\n🔗 測試授權 URL:');
console.log(authUrl);

console.log('\n⚠️  注意事項:');
console.log('1. 確保 Google Cloud Console 中的重新導向 URI 包含:');
console.log(`   ${redirectUri}`);
console.log('2. 用戶可以在 LINE Bot 中測試傳送: "20:00 散步"');
console.log('3. 應該會看到 "📅 上傳日曆" 按鈕');
console.log('4. 點擊按鈕會開始 Google OAuth 授權流程');