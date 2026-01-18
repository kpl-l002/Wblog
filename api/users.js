// api/users.js - 用户API端点
import { auroraPool } from '../db/aurora-database.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// User数据库操作类
class UserDB {
  // 创建用户
  async createUser(userData) {
    try {
      const { username, email, password, fullName } = userData;
      // 加密密码
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const client = await auroraPool.connect();
      try {
        const result = await client.query(
          `INSERT INTO users (username, email, password_hash, full_name) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id, username, email, full_name`,
          [username, email, hashedPassword, fullName]
        );
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }

  // 根据用户名查找用户
  async findUserByUsername(username) {
    try {
      const client = await auroraPool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM users WHERE username = $1',
          [username]
        );
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }

  // 验证用户凭据
  async validateCredentials(username, password) {
    try {
      const user = await this.findUserByUsername(username);
      
      if (!user) {
        // 即使用户不存在也要执行hash比较以防止时序攻击
        await bcrypt.hash(password, 10);
        return null;
      }
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      return isValid ? user : null;
    } catch (error) {
      console.error('验证凭据失败:', error);
      throw error;
    }
  }

  // 更新用户信息
  async updateUser(userId, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        throw new Error('没有有效的字段需要更新');
      }

      values.push(userId);

      const client = await auroraPool.connect();
      try {
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await client.query(query, values);
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  }

  // 删除用户
  async deleteUser(userId) {
    try {
      const client = await auroraPool.connect();
      try {
        const result = await client.query(
          'DELETE FROM users WHERE id = $1 RETURNING id',
          [userId]
        );
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }
}

export const userDB = new UserDB();

// 安全中间件 - 防止暴力破解
const loginAttempts = new Map(); // 在生产环境应使用Redis等外部存储
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15分钟锁定时间
const REGISTRATION_LOCKOUT = new Map(); // 注册尝试限制
const MAX_REG_ATTEMPTS = 3;
const REG_LOCKOUT_TIME = 60 * 60 * 1000; // 1小时注册锁定时间

// 请求验证函数
function validateRequest(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.headers['x-real-ip'])?.split(',')[0]?.trim() || 
               'UNKNOWN';
    
    return ip;
}

// 检查登录是否被锁定
function isLoginLockedOut(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const timeDiff = Date.now() - attempts.lastAttempt;
        return timeDiff < LOCKOUT_TIME;
    }
    
    return false;
}

// 检查注册是否被锁定
function isRegLockedOut(ip) {
    const attempts = REGISTRATION_LOCKOUT.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= MAX_REG_ATTEMPTS) {
        const timeDiff = Date.now() - attempts.lastAttempt;
        return timeDiff < REG_LOCKOUT_TIME;
    }
    
    return false;
}

// 更新登录尝试次数
function updateLoginAttempts(ip, success = false) {
    if (success) {
        loginAttempts.delete(ip);
        return;
    }
    
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
}

// 更新注册尝试次数
function updateRegAttempts(ip, success = false) {
    if (success) {
        REGISTRATION_LOCKOUT.delete(ip);
        return;
    }
    
    const attempts = REGISTRATION_LOCKOUT.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    REGISTRATION_LOCKOUT.set(ip, attempts);
}

// 响应处理函数
function sendResponse(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
}

// OPTIONS预检请求处理
export async function OPTIONS(req, res) {
    sendResponse(res, 200, {});
}

// POST请求处理（注册或登录）
export async function POST(req, res) {
    try {
        // 设置CORS头部
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // 处理预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // 获取客户端IP地址
        const clientIp = validateRequest(req);
        
        // 解析请求URL以确定操作类型
        const url = new URL(req.url, `http://${req.headers.host}`);
        const action = url.pathname.split('/').pop();

        if (action === 'register') {
            // 检查注册是否被锁定
            if (isRegLockedOut(clientIp)) {
                const attempts = REGISTRATION_LOCKOUT.get(clientIp);
                const timeLeft = Math.ceil((REG_LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 60000);
                sendResponse(res, 429, { 
                    success: false, 
                    error: '注册尝试次数过多，请稍后再试', 
                    timeLeft: `${timeLeft}分钟`
                });
                return;
            }
            
            await handleRegister(req, res, clientIp);
        } else if (action === 'login') {
            // 检查登录是否被锁定
            if (isLoginLockedOut(clientIp)) {
                const attempts = loginAttempts.get(clientIp);
                const timeLeft = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 60000);
                sendResponse(res, 429, { 
                    success: false, 
                    error: '登录尝试次数过多，请稍后再试', 
                    timeLeft: `${timeLeft}分钟`
                });
                return;
            }
            
            await handleLogin(req, res, clientIp);
        } else {
            sendResponse(res, 400, { success: false, error: '未知操作' });
        }
    } catch (error) {
        console.error('用户API错误:', error);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// 处理注册请求
async function handleRegister(req, res, clientIp) {
    // 解析请求体
    let body = '';
    for await (const chunk of req) {
        body += chunk.toString();
    }

    let requestData;
    try {
        requestData = JSON.parse(body);
    } catch (parseError) {
        updateRegAttempts(clientIp, false);
        sendResponse(res, 400, { success: false, error: '无效的JSON数据' });
        return;
    }

    const { username, email, password, fullName } = requestData;

    // 验证输入
    if (!username || !email || !password) {
        updateRegAttempts(clientIp, false);
        sendResponse(res, 400, { success: false, error: '用户名、邮箱和密码不能为空' });
        return;
    }

    // 验证密码强度（至少8位，包含字母和数字）
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        updateRegAttempts(clientIp, false);
        sendResponse(res, 400, { 
            success: false, 
            error: '密码必须至少8位，且包含字母和数字' 
        });
        return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        updateRegAttempts(clientIp, false);
        sendResponse(res, 400, { success: false, error: '邮箱格式不正确' });
        return;
    }

    try {
        // 检查用户是否已存在
        const existingUser = await userDB.findByEmailOrUsername(username);
        if (existingUser) {
            updateRegAttempts(clientIp, false);
            sendResponse(res, 409, { success: false, error: '用户名已被占用' });
            return;
        }
        
        const existingEmail = await userDB.findByEmailOrUsername(email);
        if (existingEmail) {
            updateRegAttempts(clientIp, false);
            sendResponse(res, 409, { success: false, error: '邮箱已被注册' });
            return;
        }

        // 创建新用户
        const newUser = await userDB.createUser({
            username,
            email,
            password,
            fullName: fullName || username
        });
        
        // 注册成功，重置尝试次数
        updateRegAttempts(clientIp, true);
        
        // 生成JWT令牌
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                username: newUser.username,
                email: newUser.email,
                role: 'user',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
            },
            process.env.JWT_SECRET || 'fallback_secret_for_dev'
        );
        
        sendResponse(res, 200, { 
            success: true, 
            token: token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                fullName: newUser.full_name
            },
            message: '注册成功'
        });
    } catch (dbError) {
        console.error('数据库错误:', dbError);
        updateRegAttempts(clientIp, false);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// 处理登录请求
async function handleLogin(req, res, clientIp) {
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

    const { identifier, password } = requestData; // identifier可以是用户名或邮箱

    // 验证输入
    if (!identifier || !password) {
        updateLoginAttempts(clientIp, false);
        sendResponse(res, 400, { success: false, error: '账号和密码不能为空' });
        return;
    }

    try {
        // 验证凭据
        const user = await userDB.validateCredentials(identifier, password);
        
        if (user) {
            // 登录成功，重置尝试次数
            updateLoginAttempts(clientIp, true);
            
            // 生成JWT令牌
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username,
                    email: user.email,
                    role: 'user',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
                },
                process.env.JWT_SECRET || 'fallback_secret_for_dev'
            );
            
            sendResponse(res, 200, { 
                success: true, 
                token: token,
                user: user,
                message: '登录成功'
            });
        } else {
            // 登录失败
            updateLoginAttempts(clientIp, false);
            sendResponse(res, 401, { success: false, error: '账号或密码错误' });
        }
    } catch (dbError) {
        console.error('数据库错误:', dbError);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// GET请求处理（获取用户信息）
export async function GET(req, res) {
    try {
        // 设置CORS头部
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // 从Authorization header中提取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendResponse(res, 401, { success: false, error: '未提供有效的认证令牌' });
            return;
        }
        
        const token = authHeader.substring(7); // 移除 "Bearer " 前缀
        
        // 验证JWT令牌
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev');
        } catch (err) {
            sendResponse(res, 401, { success: false, error: '认证令牌无效或已过期' });
            return;
        }
        
        // 获取用户信息
        const user = await userDB.getUserById(decoded.userId);
        if (!user) {
            sendResponse(res, 404, { success: false, error: '用户不存在' });
            return;
        }
        
        sendResponse(res, 200, { 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                avatar_url: user.avatar_url,
                bio: user.bio,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// PUT请求处理（更新用户资料）
export async function PUT(req, res) {
    try {
        // 设置CORS头部
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // 处理预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // 从Authorization header中提取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendResponse(res, 401, { success: false, error: '未提供有效的认证令牌' });
            return;
        }
        
        const token = authHeader.substring(7); // 移除 "Bearer " 前缀
        
        // 验证JWT令牌
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev');
        } catch (err) {
            sendResponse(res, 401, { success: false, error: '认证令牌无效或已过期' });
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
        
        // 更新用户资料
        const updatedUser = await userDB.updateUserProfile(decoded.userId, requestData);
        if (!updatedUser) {
            sendResponse(res, 400, { success: false, error: '没有提供有效的更新字段' });
            return;
        }
        
        sendResponse(res, 200, { 
            success: true, 
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                fullName: updatedUser.full_name,
                avatar_url: updatedUser.avatar_url,
                bio: updatedUser.bio,
                updatedAt: updatedUser.updated_at
            },
            message: '资料更新成功'
        });
    } catch (error) {
        console.error('更新用户资料错误:', error);
        sendResponse(res, 500, { success: false, error: '服务器内部错误' });
    }
}

// 默认导出以支持不同导入方式
export default async function handler(req, res) {
    if (req.method === 'POST') {
        await POST(req, res);
    } else if (req.method === 'GET') {
        await GET(req, res);
    } else if (req.method === 'PUT') {
        await PUT(req, res);
    } else if (req.method === 'OPTIONS') {
        await OPTIONS(req, res);
    } else {
        sendResponse(res, 405, { success: false, error: '方法不允许' });
    }
}