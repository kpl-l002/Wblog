// db/database.js - 数据库连接和操作
import pg from 'pg';

const { Pool } = pg;

// 创建数据库连接池 - 配置为Amazon Aurora PostgreSQL
const pool = new Pool({
  connectionString: process.env.AURORA_POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Aurora特定配置
  max: 20, // 最大连接数
  min: 5,  // 最小连接数
  acquireTimeoutMillis: 60000, // 获取连接的超时时间
  idleTimeoutMillis: 30000,    // 空闲连接超时时间
  connectionTimeoutMillis: 5000, // 连接超时时间
  keepAlive: true              // 启用keep-alive
});

// Admin数据库操作类
class AdminDB {
  // 验证用户凭据
  async validateCredentials(username, password) {
    try {
      const client = await auroraPool.connect();
      try {
        const result = await client.query(
          'SELECT id, username, password_hash FROM admins WHERE username = $1',
          [username]
        );
        
        const user = result.rows[0];
        if (!user) return null;
        
        // 使用bcrypt验证密码
        const isValid = await bcrypt.compare(password, user.password_hash);
        return isValid ? user : null;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    }
  }
}

export const adminDB = new AdminDB();
// api/authenticate.js - 安全认证API
import { auroraPool } from '../db/aurora-database.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// 安全中间件 - 防止暴力破解
const loginAttempts = new Map(); // 在生产环境应使用Redis等外部存储
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15分钟锁定时间

// 请求验证函数
function validateRequest(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.headers['x-real-ip'])?.split(',')[0]?.trim() || 
               'UNKNOWN';
    
    return ip;
}

// 检查是否被锁定
function isLockedOut(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;
  
  // 检查是否仍在锁定时间内
  if (Date.now() - attempt.firstAttemptTime < LOCKOUT_TIME && attempt.failedAttempts >= MAX_ATTEMPTS) {
    return true;
  }
  
  // 如果超过锁定时间，清除尝试记录
  if (Date.now() - attempt.firstAttemptTime >= LOCKOUT_TIME) {
    loginAttempts.delete(ip);
  }
  
  return false;
}

// 记录失败的尝试
function recordFailedAttempt(ip) {
  const attempt = loginAttempts.get(ip);
  
  if (attempt) {
    // 如果是首次尝试或者超出锁定时间
    if (attempt.failedAttempts < MAX_ATTEMPTS) {
      loginAttempts.set(ip, {
        failedAttempts: attempt.failedAttempts + 1,
        firstAttemptTime: attempt.firstAttemptTime
      });
    }
  } else {
    loginAttempts.set(ip, {
      failedAttempts: 1,
      firstAttemptTime: Date.now()
    });
  }
}

// 清除成功登录的尝试记录
function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// 响应处理函数
function sendResponse(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
}

// OPTIONS预检请求处理
export async function OPTIONS(req, res) {
    sendResponse(res, 200, {});
}

// POST认证请求处理
export async function POST(req, res) {
    try {
        // 设置CORS头部
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // 处理预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // 获取客户端IP地址
        const clientIp = validateRequest(req);
        
        // 检查是否被锁定
        if (isLockedOut(clientIp)) {
            const attempt = loginAttempts.get(clientIp);
            const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempt.firstAttemptTime)) / 60000);
            sendResponse(res, 429, { 
                success: false, 
                error: '登录尝试次数过多，请稍后再试', 
                timeLeft: `${timeLeft}分钟`
            });
            return;
        }

        // 解析请求体
        let body = '';
        for await (const chunk of req) {
            body += chunk.toString();
        }

        let requestData;
        try {
            requestData = JSON.parse(body);
        } catch (parseError) {
            sendResponse(res, 400, { success: false, error: '无效的JSON数据' });
            return;
        }

        const { username, password } = requestData;

        // 验证输入
        if (!username || !password) {
            recordFailedAttempt(clientIp);
            sendResponse(res, 400, { success: false, error: '用户名和密码不能为空' });
            return;
        }

        try {
            // 验证凭据
            const user = await adminDB.validateCredentials(username, password);
            
            if (user) {
                // 认证成功，清除尝试记录
                clearAttempts(clientIp);
                
                // 生成JWT令牌
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        username: user.username,
                        role: 'admin',
                        iat: Math.floor(Date.now() / 1000),
                        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时过期
                    },
                    process.env.JWT_SECRET || 'fallback_secret_for_dev'
                );
                
                sendResponse(res, 200, { 
                    success: true, 
                    token: token,
                    user: { id: user.id, username: user.username },
                    message: '认证成功'
                });
            } else {
                // 认证失败
                recordFailedAttempt(clientIp);
                sendResponse(res, 401, { success: false, error: '用户名或密码错误' });
            }
        } catch (dbError) {
            console.error('数据库错误:', dbError);
            sendResponse(res, 500, { success: false, error: '服务器内部错误' });
        }
    } catch (error) {
        console.error('认证API错误:', error);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// 默认导出以支持不同导入方式
export default async function handler(req, res) {
    if (req.method === 'POST') {
        await POST(req, res);
    } else if (req.method === 'OPTIONS') {
        await OPTIONS(req, res);
    } else {
        sendResponse(res, 405, { success: false, error: '方法不允许' });
    }
}