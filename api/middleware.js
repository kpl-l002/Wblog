// api/middleware.js - API中间件，包含认证验证功能

import jwt from 'jsonwebtoken'; // 在实际应用中需要安装jsonwebtoken包

// 验证管理员权限的中间件
export function requireAdminAuth(handler) {
    return async (req, res) => {
        try {
            // 从请求头获取token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return sendAuthError(res, 401, '缺少认证令牌');
            }

            const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
            
            // 验证token（在实际应用中应使用真正的JWT验证）
            let decoded;
            try {
                // 在实际应用中应使用真实的密钥验证
                decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            } catch (verifyError) {
                if (verifyError instanceof jwt.TokenExpiredError) {
                    return sendAuthError(res, 401, '认证令牌已过期');
                } else if (verifyError instanceof jwt.JsonWebTokenError) {
                    return sendAuthError(res, 401, '无效的认证令牌');
                } else {
                    return sendAuthError(res, 401, '认证令牌验证失败');
                }
            }

            // 将用户信息附加到请求对象
            req.user = decoded;

            // 调用原始处理函数
            return await handler(req, res);
        } catch (error) {
            console.error('认证中间件错误:', error);
            return sendAuthError(res, 500, '服务器内部错误');
        }
    };
}

// 发送认证错误响应
function sendAuthError(res, statusCode, message) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.statusCode = statusCode;
    res.end(JSON.stringify({ 
        success: false, 
        error: message 
    }));
}

// 通用响应函数
export function sendResponse(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
}

// 输入验证函数
export function validateInputs(inputs) {
    const errors = [];
    
    for (const [key, value] of Object.entries(inputs)) {
        if (value === undefined || value === null || value === '') {
            errors.push(`${key} 不能为空`);
        } else if (typeof value === 'string' && value.trim() === '') {
            errors.push(`${key} 不能为空字符串`);
        }
    }
    
    return errors;
}

// XSS防护 - 清理用户输入
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// 验证IP地址格式
export function isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1?[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1?[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1?[0-9]){0,1}[0-9]))$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}