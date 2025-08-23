# 📱 Flex Message 功能說明

您的AI LINE Bot現在支援Flex Message豐富訊息卡片功能！

## 🎯 觸發條件

當用戶在LINE中傳送 **"任務"** 時，機器人會回傳一個精美的Flex Message卡片。

## 🎨 Flex Message 特色

### 📋 卡片內容：
- **標題**：✅ 任務收到！
- **描述**：您的任務已經成功接收，點擊下方按鈕查看更多資訊！
- **英雄圖片**：精美的任務管理背景圖
- **按鈕連結**：🔗 前往 Ryan 的 Threads

### 🔗 按鈕功能：
- **連結目標**：https://www.threads.com/@ryan_ryan_lin?hl=zh-tw
- **按鈕樣式**：主要藍色按鈕
- **點擊行為**：在瀏覽器中打開Threads頁面

## 💻 技術實作

### Flex Message 結構：
```json
{
  "type": "flex",
  "altText": "任務收到！",
  "contents": {
    "type": "bubble",
    "hero": {
      "type": "image",
      "url": "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
    },
    "body": {
      "contents": [
        {
          "type": "text",
          "text": "✅ 任務收到！",
          "weight": "bold",
          "size": "xl"
        }
      ]
    },
    "footer": {
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "uri",
            "uri": "https://www.threads.com/@ryan_ryan_lin?hl=zh-tw"
          }
        }
      ]
    }
  }
}
```

## 🧪 測試方法

### 基本測試：
1. 在LINE中向您的Bot傳送 `任務`
2. 應該會收到一個精美的卡片訊息
3. 點擊按鈕確認連結正常工作

### 預期結果：
- ✅ 收到Flex Message卡片
- ✅ 卡片顯示"任務收到！"標題
- ✅ 按鈕可以正常點擊
- ✅ 點擊按鈕會開啟Threads頁面

## 🎨 自訂修改

如果您想要修改Flex Message的外觀或內容：

### 修改文字：
在 `app.js` 的 `createTaskFlexMessage()` 函數中修改：
```javascript
{
  type: 'text',
  text: '✅ 任務收到！',  // 修改這裡的標題
  weight: 'bold',
  size: 'xl'
}
```

### 修改按鈕連結：
```javascript
{
  type: 'button',
  action: {
    type: 'uri',
    label: '🔗 前往 Ryan 的 Threads',  // 修改按鈕文字
    uri: 'https://www.threads.com/@ryan_ryan_lin?hl=zh-tw'  // 修改連結
  }
}
```

### 修改圖片：
```javascript
hero: {
  type: 'image',
  url: 'https://your-image-url.com/image.jpg',  // 替換圖片URL
  size: 'full',
  aspectRatio: '20:13'
}
```

## 🛠️ 其他功能整合

您的Bot現在支援以下指令：

| 指令 | 回應類型 | 功能說明 |
|------|----------|----------|
| `hello` | 文字訊息 | AI智能歡迎訊息 |
| `任務` | **Flex Message** | 精美卡片 + Threads連結 |
| `/help` 或 `幫助` | 文字訊息 | 功能說明 |
| 其他任何訊息 | 文字訊息 | ChatGPT AI回覆 |

## 🌟 Flex Message 優勢

- **視覺吸引力**：比純文字更有吸引力
- **互動性強**：支援按鈕、連結等互動元素
- **品牌展示**：可以展示圖片、Logo等品牌元素
- **用戶體驗佳**：提供更豐富的使用者體驗

## 📱 在不同裝置上的表現

Flex Message會自動適應不同的螢幕大小：
- **手機**：完整顯示所有元素
- **平板**：保持良好的比例
- **桌面版LINE**：正常顯示按鈕和圖片

現在您的LINE Bot擁有了專業級的視覺訊息功能！🎉