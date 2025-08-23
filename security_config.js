// 安全性配置與驗證機制
// LINE OAuth 2.0 安全性最佳實踐

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// 安全性配置
const SECURITY_CONFIG = {
    // CSRF 保護
    CSRF: {
        STATE_LENGTH: 64,           // OAuth state 參數長度
        STATE_EXPIRES_MINUTES: 15,  // 狀態過期時間
        NONCE_LENGTH: 32            // Nonce 長度
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        OAUTH_WINDOW_MS: 15 * 60 * 1000,    // 15分鐘
        OAUTH_MAX_REQUESTS: 5,               // 每15分鐘最多5次 OAuth 嘗試
        API_WINDOW_MS: 1 * 60 * 1000,       // 1分鐘
        API_MAX_REQUESTS: 60                 // 每分鐘最多60次 API 請求
    },
    
    // JWT 設定
    JWT: {
        SECRET_MIN_LENGTH: 32,
        EXPIRES_IN: '7d',
        ALGORITHM: 'HS256'
    },
    
    // 允許的域名（CORS）
    ALLOWED_ORIGINS: [
        'http://localhost:3000',
        'https://your-domain.com',
        // 生產環境請添加實際域名
    ],
    
    // 安全標頭
    SECURITY_HEADERS: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.line.me https://access.line.me;"
    }
};

class SecurityManager {
    
    // 1. 生成安全的隨機狀態
    static generateSecureState() {
        return crypto.randomBytes(SECURITY_CONFIG.CSRF.STATE_LENGTH / 2).toString('hex');
    }
    
    // 2. 生成安全的 Nonce
    static generateSecureNonce() {
        return crypto.randomBytes(SECURITY_CONFIG.CSRF.NONCE_LENGTH / 2).toString('hex');
    }
    
    // 3. 驗證 LINE Channel Signature
    static verifyLineSignature(body, signature, channelSecret) {
        try {
            if (!signature || !channelSecret) {
                return false;
            }
            
            const expectedSignature = crypto
                .createHmac('sha256', channelSecret)
                .update(body, 'utf8')
                .digest('base64');
            
            const actualSignature = signature.replace('sha256=', '');
            
            // 使用時間安全的比較防止時序攻擊
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(actualSignature)
            );
            
        } catch (error) {
            console.error('[安全性] LINE 簽章驗證錯誤:', error);
            return false;
        }
    }
    
    // 4. 驗證 OAuth State 參數
    static validateOAuthState(state, storedStates) {
        try {
            if (!state || typeof state !== 'string') {
                return { valid: false, error: 'invalid_format' };
            }
            
            if (state.length !== SECURITY_CONFIG.CSRF.STATE_LENGTH) {
                return { valid: false, error: 'invalid_length' };
            }
            
            const stateData = storedStates.get(state);
            if (!stateData) {
                return { valid: false, error: 'state_not_found' };
            }
            
            if (stateData.isUsed) {
                return { valid: false, error: 'state_already_used' };
            }
            
            if (new Date() > stateData.expiresAt) {
                storedStates.delete(state);
                return { valid: false, error: 'state_expired' };
            }
            
            return { valid: true, stateData: stateData };
            
        } catch (error) {
            console.error('[安全性] State 驗證錯誤:', error);
            return { valid: false, error: 'validation_error' };
        }
    }
    
    // 5. 驗證 IP 地址
    static validateClientIP(req) {
        try {
            const forwarded = req.headers['x-forwarded-for'];
            const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress;
            
            // 檢查是否為私有 IP（開發環境）
            const isPrivateIP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
            
            return {
                ip: ip,
                isPrivate: isPrivateIP,
                isValid: true
            };
            
        } catch (error) {
            console.error('[安全性] IP 驗證錯誤:', error);
            return {
                ip: 'unknown',
                isPrivate: false,
                isValid: false
            };
        }
    }
    
    // 6. 清理輸入資料
    static sanitizeInput(input, maxLength = 1000) {
        try {
            if (typeof input !== 'string') {
                return '';
            }
            
            return input
                .trim()
                .slice(0, maxLength)
                .replace(/[<>\"'&]/g, match => {
                    const entities = {
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#x27;',
                        '&': '&amp;'
                    };
                    return entities[match];
                });
                
        } catch (error) {
            console.error('[安全性] 輸入清理錯誤:', error);
            return '';
        }
    }
    
    // 7. 驗證 USER AGENT
    static validateUserAgent(userAgent) {
        try {
            if (!userAgent || typeof userAgent !== 'string') {
                return { valid: false, risk: 'high', reason: 'missing_user_agent' };
            }
            
            // 檢查是否為合法的瀏覽器 User Agent
            const validPatterns = [
                /Mozilla\/5\.0/,
                /Chrome\/\d+/,
                /Safari\/\d+/,
                /Firefox\/\d+/,
                /Edge\/\d+/,
                /LINE\/\d+/
            ];
            
            const isValid = validPatterns.some(pattern => pattern.test(userAgent));
            
            // 檢查是否為可疑的 User Agent
            const suspiciousPatterns = [
                /curl/i,
                /wget/i,
                /python/i,
                /postman/i,
                /bot/i,
                /crawler/i
            ];
            
            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
            
            return {
                valid: isValid && !isSuspicious,
                risk: isSuspicious ? 'high' : isValid ? 'low' : 'medium',
                reason: isSuspicious ? 'suspicious_pattern' : !isValid ? 'invalid_format' : 'valid'
            };
            
        } catch (error) {
            console.error('[安全性] User Agent 驗證錯誤:', error);
            return { valid: false, risk: 'high', reason: 'validation_error' };
        }
    }
    
    // 8. 建立安全的 Session ID
    static generateSecureSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    // 9. 建立 Rate Limiter 中介軟體
    static createRateLimiter(windowMs, maxRequests, message = '請求過於頻繁，請稍後再試') {
        return rateLimit({
            windowMs: windowMs,
            max: maxRequests,
            message: {
                success: false,
                error: 'rate_limit_exceeded',
                message: message
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                console.warn(`[安全性] Rate limit 觸發: ${req.ip} - ${req.originalUrl}`);
                res.status(429).json({
                    success: false,
                    error: 'rate_limit_exceeded',
                    message: message,
                    retryAfter: Math.round(windowMs / 1000)
                });
            }
        });
    }
    
    // 10. CORS 中介軟體
    static corsMiddleware(req, res, next) {
        try {
            const origin = req.headers.origin;
            
            if (SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin) || 
                process.env.NODE_ENV === 'development') {
                res.setHeader('Access-Control-Allow-Origin', origin || '*');
            }
            
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24小時
            
            if (req.method === 'OPTIONS') {
                return res.status(200).end();
            }
            
            next();
            
        } catch (error) {
            console.error('[安全性] CORS 處理錯誤:', error);
            next(error);
        }
    }
    
    // 11. 安全標頭中介軟體
    static securityHeadersMiddleware(req, res, next) {
        try {
            Object.entries(SECURITY_CONFIG.SECURITY_HEADERS).forEach(([header, value]) => {
                res.setHeader(header, value);
            });
            
            next();
            
        } catch (error) {
            console.error('[安全性] 安全標頭設定錯誤:', error);
            next(error);
        }
    }
    
    // 12. 驗證環境變數
    static validateEnvironment() {
        const requiredVars = [
            'LINE_CHANNEL_ID',
            'LINE_CHANNEL_SECRET',
            'LINE_CHANNEL_ACCESS_TOKEN',
            'JWT_SECRET'
        ];
        
        const missing = requiredVars.filter(varName => !process.env[varName]);
        
        if (missing.length > 0) {
            console.error('[安全性] 缺少必要環境變數:', missing.join(', '));
            return false;
        }
        
        // 檢查 JWT Secret 長度
        if (process.env.JWT_SECRET.length < SECURITY_CONFIG.JWT.SECRET_MIN_LENGTH) {
            console.error('[安全性] JWT_SECRET 長度不足，建議至少 32 字符');
            return false;
        }
        
        console.log('[安全性] 環境變數驗證通過');
        return true;
    }
    
    // 13. 安全性檢查報告
    static generateSecurityReport(req) {
        const ip = this.validateClientIP(req);
        const userAgent = this.validateUserAgent(req.headers['user-agent']);
        
        return {
            timestamp: new Date().toISOString(),
            ip: ip,
            userAgent: userAgent,
            headers: {
                origin: req.headers.origin,
                referer: req.headers.referer,
                'x-forwarded-for': req.headers['x-forwarded-for']
            },
            riskLevel: userAgent.risk === 'high' ? 'high' : 'low'
        };
    }
}

// 預定義的 Rate Limiters
const rateLimiters = {
    // OAuth 流程限制
    oauth: SecurityManager.createRateLimiter(
        SECURITY_CONFIG.RATE_LIMIT.OAUTH_WINDOW_MS,
        SECURITY_CONFIG.RATE_LIMIT.OAUTH_MAX_REQUESTS,
        'OAuth 請求過於頻繁，請稍後再試'
    ),
    
    // 一般 API 限制
    api: SecurityManager.createRateLimiter(
        SECURITY_CONFIG.RATE_LIMIT.API_WINDOW_MS,
        SECURITY_CONFIG.RATE_LIMIT.API_MAX_REQUESTS,
        'API 請求過於頻繁，請稍後再試'
    )
};

module.exports = {
    SecurityManager,
    SECURITY_CONFIG,
    rateLimiters
};