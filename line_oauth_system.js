// LINE OAuth 2.0 註冊綁定系統
// 完整的後端處理邏輯

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// LINE API 配置
const LINE_CONFIG = {
    CHANNEL_ID: process.env.LINE_CHANNEL_ID || '2007976732',
    CHANNEL_SECRET: process.env.LINE_LOGIN_CHANNEL_SECRET || '81060e406b7e977424c14642f8fa8c09',
    ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LOGIN_CALLBACK_URL: process.env.LINE_LOGIN_CALLBACK_URL || 'http://localhost:3000/auth/line/callback'
};

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// 記憶體存儲 (生產環境建議使用 Redis 或資料庫)
const users = new Map();           // userId -> userData
const lineBindings = new Map();    // lineUserId -> binding data
const oauthStates = new Map();     // stateToken -> state data
const userSessions = new Map();    // sessionId -> userData

class LineOAuthSystem {
    
    // 1. 準備 OAuth 流程
    static async prepareOAuth(req, res) {
        try {
            const { state, referrer } = req.body;
            const clientIP = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'] || '';
            
            // 驗證狀態參數
            if (!state || state.length !== 64) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_state',
                    message: '無效的狀態參數'
                });
            }
            
            // 儲存狀態資訊（15分鐘過期）
            const stateData = {
                token: state,
                sessionId: req.sessionID || crypto.randomUUID(),
                ipAddress: clientIP,
                userAgent: userAgent,
                referrer: referrer,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分鐘
                isUsed: false
            };
            
            oauthStates.set(state, stateData);
            
            // 清理過期狀態
            this.cleanupExpiredStates();
            
            console.log(`[OAuth] 準備狀態: ${state} (IP: ${clientIP})`);
            
            res.json({
                success: true,
                state: state,
                message: '準備完成，即將跳轉到 LINE 授權頁面'
            });
            
        } catch (error) {
            console.error('[OAuth] 準備流程錯誤:', error);
            res.status(500).json({
                success: false,
                error: 'server_error',
                message: '伺服器錯誤，請稍後再試'
            });
        }
    }
    
    // 2. 處理 LINE OAuth Callback
    static async handleCallback(req, res) {
        try {
            const { code, state, error, error_description } = req.query;
            const clientIP = req.ip || req.connection.remoteAddress;
            
            console.log(`[OAuth] 回調處理: code=${!!code}, state=${state}, error=${error}`);
            
            // 檢查是否有錯誤
            if (error) {
                console.error(`[OAuth] LINE 授權錯誤: ${error} - ${error_description}`);
                return res.redirect(`/line-register?error=${error}&message=${encodeURIComponent(error_description || '授權失敗')}`);
            }
            
            // 驗證必要參數
            if (!code || !state) {
                console.error('[OAuth] 缺少必要參數: code或state');
                return res.redirect('/line-register?error=invalid_request&message=缺少必要參數');
            }
            
            // 驗證狀態參數
            const stateData = oauthStates.get(state);
            if (!stateData) {
                console.error(`[OAuth] 無效或過期的狀態: ${state}`);
                return res.redirect('/line-register?error=invalid_state&message=無效或過期的授權狀態');
            }
            
            if (stateData.isUsed) {
                console.error(`[OAuth] 狀態已被使用: ${state}`);
                return res.redirect('/line-register?error=state_used&message=授權狀態已被使用');
            }
            
            if (new Date() > stateData.expiresAt) {
                console.error(`[OAuth] 狀態已過期: ${state}`);
                oauthStates.delete(state);
                return res.redirect('/line-register?error=state_expired&message=授權狀態已過期');
            }
            
            // 標記狀態為已使用
            stateData.isUsed = true;
            oauthStates.set(state, stateData);
            
            // 步驟1: 用 code 交換 access token
            console.log('[OAuth] 交換 access token...');
            const tokenResponse = await this.exchangeCodeForToken(code);
            
            if (!tokenResponse.success) {
                console.error('[OAuth] Token 交換失敗:', tokenResponse.error);
                return res.redirect(`/line-register?error=token_exchange&message=${encodeURIComponent(tokenResponse.message)}`);
            }
            
            // 步驟2: 用 access token 取得用戶資訊
            console.log('[OAuth] 取得用戶資訊...');
            const profileResponse = await this.getUserProfile(tokenResponse.accessToken);
            
            if (!profileResponse.success) {
                console.error('[OAuth] 取得用戶資訊失敗:', profileResponse.error);
                return res.redirect(`/line-register?error=profile_fetch&message=${encodeURIComponent(profileResponse.message)}`);
            }
            
            const lineProfile = profileResponse.profile;
            console.log(`[OAuth] 用戶資訊: ${lineProfile.displayName} (${lineProfile.userId})`);
            
            // 步驟3: 檢查是否為現有用戶或建立新用戶
            const userResult = await this.findOrCreateUser(lineProfile, tokenResponse);
            
            if (!userResult.success) {
                console.error('[OAuth] 用戶處理失敗:', userResult.error);
                return res.redirect(`/line-register?error=user_process&message=${encodeURIComponent(userResult.message)}`);
            }
            
            // 步驟4: 建立用戶 session
            const sessionToken = this.createUserSession(userResult.user, stateData);
            
            // 步驟5: 嘗試自動加為好友並發送歡迎訊息
            console.log('[OAuth] 發送好友邀請和歡迎訊息...');
            this.sendWelcomeMessage(lineProfile.userId, userResult.isNewUser)
                .catch(error => console.error('[OAuth] 發送歡迎訊息失敗:', error));
            
            // 步驟6: 記錄系統日誌
            this.logUserAction(userResult.user.id, lineProfile.userId, 
                userResult.isNewUser ? 'register' : 'login', 
                { ip: clientIP, userAgent: req.headers['user-agent'] });
            
            // 清理已使用的狀態
            oauthStates.delete(state);
            
            console.log(`[OAuth] 用戶 ${lineProfile.displayName} ${userResult.isNewUser ? '註冊' : '登入'}成功`);
            
            // 重定向到成功頁面，帶上 session token
            res.redirect(`/auth/success?token=${sessionToken}&userId=${userResult.user.id}&isNew=${userResult.isNewUser}`);
            
        } catch (error) {
            console.error('[OAuth] Callback 處理錯誤:', error);
            res.redirect('/line-register?error=server_error&message=系統錯誤，請稍後再試');
        }
    }
    
    // 3. 用 authorization code 交換 access token
    static async exchangeCodeForToken(code) {
        try {
            const tokenUrl = 'https://api.line.me/oauth2/v2.1/token';
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: LINE_CONFIG.LOGIN_CALLBACK_URL,
                client_id: LINE_CONFIG.CHANNEL_ID,
                client_secret: LINE_CONFIG.CHANNEL_SECRET
            });
            
            const response = await axios.post(tokenUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });
            
            const data = response.data;
            
            return {
                success: true,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                tokenType: data.token_type,
                scope: data.scope,
                idToken: data.id_token
            };
            
        } catch (error) {
            console.error('[Token Exchange] 錯誤:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error || 'token_exchange_failed',
                message: error.response?.data?.error_description || 'Token 交換失敗'
            };
        }
    }
    
    // 4. 用 access token 取得用戶個人資訊
    static async getUserProfile(accessToken) {
        try {
            const profileUrl = 'https://api.line.me/v2/profile';
            
            const response = await axios.get(profileUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                timeout: 10000
            });
            
            return {
                success: true,
                profile: response.data
            };
            
        } catch (error) {
            console.error('[Profile Fetch] 錯誤:', error.response?.data || error.message);
            
            return {
                success: false,
                error: 'profile_fetch_failed',
                message: '取得用戶資訊失敗'
            };
        }
    }
    
    // 5. 找到現有用戶或建立新用戶
    static async findOrCreateUser(lineProfile, tokenData) {
        try {
            const { userId: lineUserId, displayName, pictureUrl, statusMessage } = lineProfile;
            
            // 檢查是否已經綁定過此 LINE 帳號
            let existingBinding = lineBindings.get(lineUserId);
            
            if (existingBinding) {
                // 現有用戶登入
                console.log(`[用戶] 現有用戶登入: ${displayName}`);
                
                // 更新 token 和最後登入時間
                existingBinding.accessToken = tokenData.accessToken;
                existingBinding.refreshToken = tokenData.refreshToken;
                existingBinding.tokenExpiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);
                existingBinding.lastLoginAt = new Date();
                existingBinding.lineDisplayName = displayName;
                existingBinding.linePictureUrl = pictureUrl;
                
                lineBindings.set(lineUserId, existingBinding);
                
                // 取得用戶資料
                const user = users.get(existingBinding.userId);
                
                return {
                    success: true,
                    user: user,
                    isNewUser: false
                };
            } else {
                // 新用戶註冊
                console.log(`[用戶] 新用戶註冊: ${displayName}`);
                
                // 建立新用戶
                const userId = crypto.randomUUID();
                const newUser = {
                    id: userId,
                    uuid: userId,
                    displayName: displayName,
                    avatarUrl: pictureUrl,
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    settings: {
                        chatMode: 'smart',
                        notifications: true,
                        theme: 'default'
                    },
                    profile: {
                        bio: statusMessage || '',
                        timezone: 'Asia/Taipei'
                    }
                };
                
                users.set(userId, newUser);
                
                // 建立 LINE 綁定
                const binding = {
                    id: crypto.randomUUID(),
                    userId: userId,
                    lineUserId: lineUserId,
                    lineDisplayName: displayName,
                    linePictureUrl: pictureUrl,
                    accessToken: tokenData.accessToken,
                    refreshToken: tokenData.refreshToken,
                    tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
                    firstBindingAt: new Date(),
                    lastLoginAt: new Date(),
                    isFriend: false,
                    friendAddedAt: null
                };
                
                lineBindings.set(lineUserId, binding);
                
                return {
                    success: true,
                    user: newUser,
                    isNewUser: true
                };
            }
            
        } catch (error) {
            console.error('[用戶處理] 錯誤:', error);
            return {
                success: false,
                error: 'user_process_failed',
                message: '用戶處理失敗'
            };
        }
    }
    
    // 6. 建立用戶 session
    static createUserSession(user, stateData) {
        try {
            const sessionId = crypto.randomUUID();
            const sessionData = {
                sessionId: sessionId,
                userId: user.id,
                lineUserId: user.lineUserId,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天
                ipAddress: stateData.ipAddress,
                userAgent: stateData.userAgent,
                isActive: true
            };
            
            userSessions.set(sessionId, sessionData);
            
            // 建立 JWT token
            const jwtPayload = {
                sub: user.id,
                sessionId: sessionId,
                displayName: user.displayName,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000)
            };
            
            const token = jwt.sign(jwtPayload, JWT_SECRET);
            
            console.log(`[Session] 建立 session: ${sessionId} for user: ${user.displayName}`);
            
            return token;
            
        } catch (error) {
            console.error('[Session] 建立失敗:', error);
            throw error;
        }
    }
    
    // 7. 發送歡迎訊息並嘗試成為好友
    static async sendWelcomeMessage(lineUserId, isNewUser) {
        try {
            if (!LINE_CONFIG.ACCESS_TOKEN) {
                console.warn('[歡迎訊息] 缺少 LINE Access Token');
                return;
            }
            
            const welcomeMessage = {
                type: 'flex',
                altText: isNewUser ? '🎉 歡迎加入記事機器人！' : '👋 歡迎回來！',
                contents: {
                    type: 'bubble',
                    hero: {
                        type: 'image',
                        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                        size: 'full',
                        aspectRatio: '20:13',
                        aspectMode: 'cover'
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: isNewUser ? '🎉 註冊成功！' : '👋 歡迎回來！',
                                weight: 'bold',
                                size: 'xl',
                                color: '#00B900'
                            },
                            {
                                type: 'text',
                                text: isNewUser 
                                    ? '您已成功註冊並綁定記事機器人！現在可以開始使用智能任務管理功能。'
                                    : '歡迎回到記事機器人！您的任務資料已同步完成。',
                                wrap: true,
                                margin: 'md',
                                size: 'sm',
                                color: '#666666'
                            },
                            {
                                type: 'separator',
                                margin: 'lg'
                            },
                            {
                                type: 'text',
                                text: '💡 快速開始',
                                weight: 'bold',
                                margin: 'lg',
                                size: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 直接輸入任務，如：「17:00小美約會」\n• 輸入「今天我的任務有哪些？」查看清單\n• 輸入「幫助」了解更多功能',
                                wrap: true,
                                margin: 'sm',
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                color: '#00B900',
                                action: {
                                    type: 'message',
                                    label: '開始使用',
                                    text: '幫助'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '個人資料設定',
                                    uri: `${process.env.BASE_URL || 'http://localhost:3000'}/profile/${lineUserId}`
                                }
                            }
                        ]
                    }
                }
            };
            
            // 發送訊息
            const response = await axios.post('https://api.line.me/v2/bot/message/push', {
                to: lineUserId,
                messages: [welcomeMessage]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_CONFIG.ACCESS_TOKEN}`
                },
                timeout: 10000
            });
            
            console.log(`[歡迎訊息] 發送成功到 ${lineUserId}`);
            
            // 更新好友狀態
            const binding = lineBindings.get(lineUserId);
            if (binding) {
                binding.isFriend = true;
                binding.friendAddedAt = new Date();
                lineBindings.set(lineUserId, binding);
            }
            
        } catch (error) {
            // 這裡不拋出錯誤，因為歡迎訊息失敗不應該影響整個註冊流程
            console.error('[歡迎訊息] 發送失敗:', error.response?.data || error.message);
            
            // 如果是因為不是好友而失敗，記錄但不視為錯誤
            if (error.response?.status === 403) {
                console.log('[歡迎訊息] 用戶尚未成為好友，無法發送訊息');
            }
        }
    }
    
    // 8. 記錄系統日誌
    static logUserAction(userId, lineUserId, action, details = {}) {
        try {
            const logEntry = {
                id: crypto.randomUUID(),
                userId: userId,
                lineUserId: lineUserId,
                action: action,
                details: details,
                createdAt: new Date()
            };
            
            console.log(`[日誌] ${action}: ${userId} (LINE: ${lineUserId})`, details);
            
            // 這裡可以擴展到寫入資料庫或日誌檔案
            
        } catch (error) {
            console.error('[日誌] 記錄失敗:', error);
        }
    }
    
    // 9. 清理過期狀態
    static cleanupExpiredStates() {
        try {
            const now = new Date();
            let cleanedCount = 0;
            
            for (const [state, data] of oauthStates.entries()) {
                if (now > data.expiresAt) {
                    oauthStates.delete(state);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`[清理] 清除了 ${cleanedCount} 個過期狀態`);
            }
            
        } catch (error) {
            console.error('[清理] 清理狀態失敗:', error);
        }
    }
    
    // 10. 驗證 JWT Token
    static verifyJWT(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const sessionData = userSessions.get(decoded.sessionId);
            
            if (!sessionData || !sessionData.isActive) {
                return { success: false, error: 'session_not_found' };
            }
            
            if (new Date() > sessionData.expiresAt) {
                userSessions.delete(decoded.sessionId);
                return { success: false, error: 'session_expired' };
            }
            
            return {
                success: true,
                user: {
                    id: decoded.sub,
                    sessionId: decoded.sessionId,
                    displayName: decoded.displayName
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'invalid_token',
                message: error.message
            };
        }
    }
    
    // 11. 取得統計資訊
    static getStats() {
        return {
            totalUsers: users.size,
            totalBindings: lineBindings.size,
            activeSessions: userSessions.size,
            pendingOAuthStates: oauthStates.size
        };
    }
}

module.exports = {
    LineOAuthSystem,
    LINE_CONFIG,
    users,
    lineBindings,
    userSessions
};