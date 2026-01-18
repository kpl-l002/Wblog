// db/database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// 配置为Amazon Aurora PostgreSQL
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

// 初始化评论表
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id VARCHAR(255) NOT NULL,
        author VARCHAR(50) NOT NULL,
        email VARCHAR(100),
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        parent_id INTEGER,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('评论表初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

initDatabase().catch(console.error);

export const commentDB = {
  // 获取指定文章的评论
  async getCommentsByPostId(postId, includePending = false) {
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, post_id as "postId", author, email, content, 
               status, parent_id as "parentId", ip_address as "ipAddress",
               user_agent as "userAgent", created_at as "createdAt"
        FROM comments 
        WHERE post_id = $1
      `;
      
      if (!includePending) {
        query += ` AND status = 'approved'`;
      }
      
      query += ` ORDER BY created_at ASC`;
      
      const result = await client.query(query, [postId]);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // 添加新评论
  async addComment(commentData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO comments 
         (post_id, author, email, content, status, parent_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, post_id as "postId", author, email, content, 
                  status, parent_id as "parentId", ip_address as "ipAddress",
                  user_agent as "userAgent", created_at as "createdAt"`,
        [
          commentData.postId,
          commentData.author,
          commentData.email,
          commentData.content,
          'pending', // 默认待审核
          commentData.parentId || null,
          commentData.ipAddress,
          commentData.userAgent
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  // 更新评论状态
  async updateCommentStatus(commentId, status) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE comments 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, post_id as "postId", author, email, content, 
                  status, parent_id as "parentId", ip_address as "ipAddress",
                  user_agent as "userAgent", created_at as "createdAt"`,
        [status, commentId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  // 删除评论
  async deleteComment(commentId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM comments WHERE id = $1 RETURNING id',
        [commentId]
      );
      return {
        success: result.rowCount > 0,
        message: result.rowCount > 0 ? '评论删除成功' : '评论不存在'
      };
    } finally {
      client.release();
    }
  }
};

export default { commentDB };
// db/aurora-database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// 配置为Amazon Aurora PostgreSQL
const auroraPool = new Pool({
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

// 初始化评论表 - 在Aurora中可能已经存在，但仍需检查
async function initDatabase() {
  try {
    const { auroraPool } = await import('../db/aurora-database.js');
    const client = await auroraPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          post_id VARCHAR(255) NOT NULL,
          author VARCHAR(50) NOT NULL,
          email VARCHAR(100),
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          parent_id INTEGER,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('评论表初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('数据库初始化过程中出现错误:', error);
  }
}

initDatabase().catch(console.error);

export const auroraCommentDB = {
  // 获取指定文章的评论
  async getCommentsByPostId(postId, includePending = false) {
    const client = await auroraPool.connect();
    try {
      let query = `
        SELECT id, post_id as "postId", author, email, content, 
               status, parent_id as "parentId", ip_address as "ipAddress",
               user_agent as "userAgent", created_at as "createdAt"
        FROM comments 
        WHERE post_id = $1
      `;
      
      if (!includePending) {
        query += ` AND status = 'approved'`;
      }
      
      query += ` ORDER BY created_at ASC`;
      
      const result = await client.query(query, [postId]);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // 添加新评论
  async addComment(commentData) {
    const client = await auroraPool.connect();
    try {
      const result = await client.query(
        `INSERT INTO comments 
         (post_id, author, email, content, status, parent_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, post_id as "postId", author, email, content, 
                  status, parent_id as "parentId", ip_address as "ipAddress",
                  user_agent as "userAgent", created_at as "createdAt"`,
        [
          commentData.postId,
          commentData.author,
          commentData.email,
          commentData.content,
          'pending', // 默认待审核
          commentData.parentId || null,
          commentData.ipAddress,
          commentData.userAgent
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  // 更新评论状态
  async updateCommentStatus(commentId, status) {
    const client = await auroraPool.connect();
    try {
      const result = await client.query(
        `UPDATE comments 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, post_id as "postId", author, email, content, 
                  status, parent_id as "parentId", ip_address as "ipAddress",
                  user_agent as "userAgent", created_at as "createdAt"`,
        [status, commentId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  // 删除评论
  async deleteComment(commentId) {
    const client = await auroraPool.connect();
    try {
      const result = await client.query(
        'DELETE FROM comments WHERE id = $1 RETURNING id',
        [commentId]
      );
      return {
        success: result.rowCount > 0,
        message: result.rowCount > 0 ? '评论删除成功' : '评论不存在'
      };
    } finally {
      client.release();
    }
  }
};

export default { auroraPool };
// api/comments.js
import { NextResponse } from 'next/server';
import { commentDB } from '../db/database.js';

// 安全验证函数
function validateCommentData(commentData) {
    const errors = [];
    
    if (!commentData.postId || typeof commentData.postId !== 'string') {
        errors.push('文章ID不能为空');
    }
    
    if (!commentData.author || commentData.author.trim().length === 0) {
        errors.push('昵称不能为空');
    } else if (commentData.author.length > 50) {
        errors.push('昵称长度不能超过50个字符');
    }
    
    if (!commentData.content || commentData.content.trim().length === 0) {
        errors.push('评论内容不能为空');
    } else if (commentData.content.length > 1000) {
        errors.push('评论内容长度不能超过1000个字符');
    }
    
    if (commentData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(commentData.email)) {
        errors.push('邮箱格式不正确');
    }
    
    return errors;
}

// 检查是否为管理员（从token获取）
function isAdminFromToken(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    
    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
    
    // 在实际应用中，应该解析和验证JWT token
    try {
        // 模拟解码token
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.role === 'admin'; // 假设token中有role字段
    } catch (e) {
        return false;
    }
}

export async function OPTIONS(request) {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        status: 200
    });
}

// 获取评论
// GET /api/comments?postId=1&admin=true
// GET /api/comments?postId=1 (普通用户只能看到已审核的评论)
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const postId = url.searchParams.get('postId');
        const isAdmin = isAdminFromToken(request);
        
        if (!postId) {
            return NextResponse.json({
                error: '缺少文章ID参数',
                message: '请提供postId参数'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 管理员可以查看所有评论，普通用户只能查看已审核的评论
        const comments = await commentDB.getCommentsByPostId(postId, isAdmin);
        
        return NextResponse.json({
            success: true,
            postId: postId,
            comments: comments,
            isAdmin: isAdmin,
            total: comments.length
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('GET comments error:', error);
        return NextResponse.json({
            error: '获取评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

// 添加评论
// POST /api/comments
export async function POST(request) {
    try {
        const commentData = await request.json();
        const errors = validateCommentData(commentData);
        
        if (errors.length > 0) {
            return NextResponse.json({
                success: false,
                error: '数据验证失败',
                details: errors
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 获取客户端IP地址
        const clientIP = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         request.connection.remoteAddress || 
                         'UNKNOWN';
        
        // 获取User Agent
        const userAgent = request.headers.get('user-agent') || '';
        
        // 添加评论到数据库
        const newComment = await commentDB.addComment({
            postId: commentData.postId,
            author: commentData.author,
            email: commentData.email,
            content: commentData.content,
            ipAddress: clientIP,
            userAgent: userAgent
        });
        
        return NextResponse.json({
            success: true,
            comment: newComment,
            message: '评论添加成功'
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 201
        });
    } catch (error) {
        console.error('POST comments error:', error);
        return NextResponse.json({
            error: '添加评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

// 更新评论状态（仅管理员）
// PUT /api/comments/{id}/status
export async function PUT(request) {
    try {
        const isAdmin = isAdminFromToken(request);
        
        if (!isAdmin) {
            return NextResponse.json({
                success: false,
                error: '需要管理员权限'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 401
            });
        }
        
        // 从URL路径获取评论ID和动作
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const commentId = pathParts[pathParts.length - 2]; // /api/comments/{id}/status
        const action = pathParts[pathParts.length - 1]; // status value
        
        if (!commentId || !action) {
            return NextResponse.json({
                success: false,
                error: '缺少评论ID或操作'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 验证状态值
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(action)) {
            return NextResponse.json({
                success: false,
                error: '无效的状态值'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 更新评论状态
        const updatedComment = await commentDB.updateCommentStatus(commentId, action);
        
        return NextResponse.json({
            success: true,
            comment: updatedComment,
            message: '评论状态更新成功'
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('PUT comments error:', error);
        return NextResponse.json({
            error: '更新评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

// 删除评论（仅管理员）
// DELETE /api/comments/{id}
export async function DELETE(request) {
    try {
        const isAdmin = isAdminFromToken(request);
        
        if (!isAdmin) {
            return NextResponse.json({
                success: false,
                error: '需要管理员权限'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 401
            });
        }
        
        // 从URL路径获取评论ID
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const commentId = pathParts[pathParts.length - 1]; // /api/comments/{id}
        
        if (!commentId) {
            return NextResponse.json({
                success: false,
                error: '缺少评论ID'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 删除评论
        const result = await commentDB.deleteComment(commentId);
        
        return NextResponse.json({
            success: true,
            message: result.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('DELETE comments error:', error);
        return NextResponse.json({
            error: '删除评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}
