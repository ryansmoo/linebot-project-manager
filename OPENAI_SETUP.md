# 🤖 OpenAI API 設定指南

您的LINE Bot現在已經整合了ChatGPT AI智能回覆功能！要完整啟用此功能，請按照以下步驟設定OpenAI API金鑰。

## 🔑 取得OpenAI API金鑰

### 步驟1：註冊OpenAI帳號
1. 前往 [OpenAI Platform](https://platform.openai.com/)
2. 點擊「Sign up」註冊新帳號
3. 驗證您的電子郵件和電話號碼

### 步驟2：取得API金鑰
1. 登入後，前往 [API Keys](https://platform.openai.com/api-keys)
2. 點擊「Create new secret key」
3. 為金鑰命名（例如：LINE-Bot-Key）
4. **重要**：複製並安全保存您的API金鑰（只會顯示一次）

### 步驟3：設定付費方案（如需要）
1. 前往 [Billing](https://platform.openai.com/account/billing/overview)
2. 新用戶通常有免費額度，用完後需要設定付費方案
3. 建議設定用量限制以控制費用

## ⚙️ 設定API金鑰

### 方法1：修改.env檔案
編輯 `.env` 檔案，將您的API金鑰填入：

```bash
# OpenAI API 設定
OPENAI_API_KEY=sk-your_real_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

### 方法2：使用環境變數
```bash
export OPENAI_API_KEY="sk-your_real_api_key_here"
export OPENAI_MODEL="gpt-3.5-turbo"
```

## 🧪 測試AI功能

設定完成後，重新啟動您的Bot：

```bash
./stop-services.sh
./start-with-localtunnel.sh
```

然後在LINE中測試以下訊息：

- `hello` - 獲得AI智能歡迎訊息
- `/help` 或 `幫助` - 查看功能說明
- 任何其他問題 - 獲得ChatGPT AI回覆

## 💡 AI模型選擇

您可以在`.env`檔案中選擇不同的模型：

- `gpt-3.5-turbo` - 較便宜，回應快速
- `gpt-4` - 更智能，但較昂貴
- `gpt-4-turbo` - 平衡性能與成本

## 💰 費用估算

- GPT-3.5-turbo：每1K tokens約 $0.0015-0.002
- GPT-4：每1K tokens約 $0.03-0.06
- 一般對話每次約消耗100-500 tokens

## ⚠️ 注意事項

1. **保護您的API金鑰**：不要將其提交到Git或分享給他人
2. **設定使用限制**：在OpenAI控制台設定月度預算上限
3. **監控使用量**：定期檢查API使用統計
4. **備份原始Bot**：保留不使用AI的版本作為備用

## 🛠️ 疑難排解

### 常見錯誤訊息：

- **"抱歉，AI功能尚未設定"** → 檢查API金鑰是否正確設定
- **"AI服務配額已用完"** → 檢查OpenAI帳戶餘額或升級方案
- **"AI服務設定有誤"** → 檢查API金鑰格式是否正確

### 檢查設定狀態：
```bash
curl https://your-tunnel-url.loca.lt/health
```

應該看到 `"enabled": true` 表示AI功能已啟用。

## 🎉 完成設定後

您的LINE Bot將具備以下AI功能：

✨ **智能對話**：與用戶進行自然對話
🧠 **問答系統**：回答各種問題
📚 **知識查詢**：提供資訊和解釋
💬 **多語言支援**：主要使用繁體中文回覆

享受您的AI智能LINE Bot！🤖