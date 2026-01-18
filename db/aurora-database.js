// Amazon Aurora PostgreSQL 数据库连接和操作类
import { Pool } from 'pg'; // PostgreSQL客户端
import bcrypt from 'bcrypt';

// Aurora PostgreSQL 连接池配置
const auroraPool = new Pool({
  connectionString: process.env.AURORA_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  // Aurora特定配置
  max: 20, // 最大连接数
  min: 5,  // 最小连接数
  acquireTimeoutMillis: 60000, // 获取连接的超时时间
  idleTimeoutMillis: 30000,    // 空闲连接超时时间
  connectionTimeoutMillis: 5000, // 连接超时时间
  keepAlive: true,             // 启用keep-alive
  // Aurora读写分离配置
  application_name: 'wzz-blog-app' // 应用程序名称，有助于Aurora监控
});

// 测试连接
auroraPool.on('connect', () => {
  console.log('成功连接到Aurora PostgreSQL数据库');
});

auroraPool.on('error', (err) => {
  console.error('Aurora PostgreSQL数据库连接错误:', err);
});

// 帖子数据操作类
class AuroraPostDB {
  // 获取帖子列表
  async getAllPosts(options = {}) {
    const { category, status = 'published', page = 1, limit = 10, search = '' } = options;
    
    let query = `
      SELECT id, title, category, date, author, image, excerpt, content, status, created_at 
      FROM posts 
      WHERE 1=1
    `;
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR excerpt ILIKE $${params.length})`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);
    
    try {
      const result = await auroraPool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('获取帖子列表失败:', err);
      throw err;
    }
  }

  // 根据ID获取单个帖子
  async getPostById(id) {
    try {
      const result = await auroraPool.query(
        'SELECT id, title, category, date, author, image, excerpt, content, status, created_at FROM posts WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (err) {
      console.error('获取帖子详情失败:', err);
      throw err;
    }
  }

  // 创建新帖子
  async createPost(postData) {
    try {
      const { title, category, author, image, excerpt, content, status } = postData;
      const result = await auroraPool.query(`
        INSERT INTO posts (title, category, author, image, excerpt, content, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, title, category, date, author, image, excerpt, content, status, created_at
      `, [title, category, author, image, excerpt, content, status]);
      
      return result.rows[0];
    } catch (err) {
      console.error('创建帖子失败:', err);
      throw err;
    }
  }

  // 更新帖子
  async updatePost(id, postData) {
    try {
      const { title, category, author, image, excerpt, content, status } = postData;
      const result = await auroraPool.query(`
        UPDATE posts 
        SET title = $1, category = $2, author = $3, image = $4, excerpt = $5, content = $6, status = $7
        WHERE id = $8
        RETURNING id, title, category, date, author, image, excerpt, content, status, created_at
      `, [title, category, author, image, excerpt, content, status, id]);
      
      return result.rows[0];
    } catch (err) {
      console.error('更新帖子失败:', err);
      throw err;
    }
  }

  // 删除帖子
  async deletePost(id) {
    try {
      const result = await auroraPool.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);
      return result.rows[0];
    } catch (err) {
      console.error('删除帖子失败:', err);
      throw err;
    }
  }
}

// 评论数据操作类
class AuroraCommentDB {
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
  }

  // 添加评论
  async addComment(commentData) {
    try {
      const { postId, author, email, content, parentId, ipAddress, userAgent } = commentData;
      const result = await auroraPool.query(`
        INSERT INTO comments (post_id, author, email, content, parent_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, post_id as "postId", author, email, content, status,
               parent_id as "parentId", ip_address as "ipAddress",
               user_agent as "userAgent", created_at as "createdAt"
      `, [postId, author, email, content, parentId, ipAddress, userAgent]);
      
      return result.rows[0];
    } catch (err) {
      console.error('添加评论失败:', err);
      throw err;
    }
  }

  // 更新评论状态
  async updateCommentStatus(commentId, status) {
    try {
      const result = await auroraPool.query(
        'UPDATE comments SET status = $1 WHERE id = $2 RETURNING id',
        [status, commentId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('更新评论状态失败:', err);
      throw err;
    }
  }

  // 删除评论
  async deleteComment(commentId) {
    try {
      const result = await auroraPool.query(
        'DELETE FROM comments WHERE id = $1 RETURNING id',
        [commentId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('删除评论失败:', err);
      throw err;
    }
  }
}

// 导出数据库操作类
export const auroraPostDB = new AuroraPostDB();
export const auroraCommentDB = new AuroraCommentDB();

// 导出池连接以供其他模块使用
export { auroraPool };