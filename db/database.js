// 数据库连接和操作类
import { Pool } from 'pg'; // PostgreSQL客户端
import bcrypt from 'bcrypt';

// 创建连接池 - 配置为Amazon Aurora PostgreSQL
const pool = new Pool({
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
  keepAlive: true              // 启用keep-alive
});

// 帖子数据操作类
class PostDB {
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
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('获取帖子列表失败:', err);
      throw err;
    }
  }

  // 根据ID获取单个帖子
  async getPostById(id) {
    try {
      const result = await pool.query(
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
      const result = await pool.query(`
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
      const result = await pool.query(`
        UPDATE posts 
        SET title = $1, category = $2, author = $3, image = $4, excerpt = $5, content = $6, status = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING id, title, category, date, author, image, excerpt, content, status, updated_at
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
      await pool.query('DELETE FROM posts WHERE id = $1', [id]);
      return { success: true, message: '帖子删除成功' };
    } catch (err) {
      console.error('删除帖子失败:', err);
      throw err;
    }
  }

  // 获取帖子总数
  async getTotalPosts(options = {}) {
    const { category, status } = options;
    
    let query = 'SELECT COUNT(*) as count FROM posts WHERE 1=1';
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    try {
      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (err) {
      console.error('获取帖子总数失败:', err);
      throw err;
    }
  }
}

// 评论数据操作类
class CommentDB {
  // 获取帖子的评论
  async getCommentsByPostId(postId, includePending = false) {
    try {
      let query = 'SELECT id, post_id, author, email, content, status, created_at FROM comments WHERE post_id = $1';
      const params = [postId];
      
      if (!includePending) {
        query += ' AND status = \'approved\'';
      }
      
      query += ' ORDER BY created_at ASC';
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('获取评论失败:', err);
      throw err;
    }
  }

  // 添加评论
  async addComment(commentData) {
    try {
      const { postId, author, email, content, ipAddress, userAgent } = commentData;
      const result = await pool.query(`
        INSERT INTO comments (post_id, author, email, content, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, post_id, author, email, content, status, created_at
      `, [postId, author, email, content, ipAddress, userAgent]);
      
      return result.rows[0];
    } catch (err) {
      console.error('添加评论失败:', err);
      throw err;
    }
  }

  // 更新评论状态
  async updateCommentStatus(id, status) {
    try {
      const result = await pool.query(
        'UPDATE comments SET status = $1 WHERE id = $2 RETURNING id, status',
        [status, id]
      );
      return result.rows[0];
    } catch (err) {
      console.error('更新评论状态失败:', err);
      throw err;
    }
  }

  // 删除评论
  async deleteComment(id) {
    try {
      await pool.query('DELETE FROM comments WHERE id = $1', [id]);
      return { success: true, message: '评论删除成功' };
    } catch (err) {
      console.error('删除评论失败:', err);
      throw err;
    }
  }
}

// 管理员数据操作类
class AdminDB {
  // 根据用户名查找管理员
  async findByUsername(username) {
    try {
      const result = await pool.query(
        'SELECT id, username, password_hash FROM admins WHERE username = $1',
        [username]
      );
      return result.rows[0];
    } catch (err) {
      console.error('查找管理员失败:', err);
      throw err;
    }
  }

  // 验证管理员凭据
  async validateCredentials(username, password) {
    try {
      const admin = await this.findByUsername(username);
      if (!admin) {
        return null;
      }
      
      const isValid = await bcrypt.compare(password, admin.password_hash);
      if (isValid) {
        return { id: admin.id, username: admin.username };
      }
      
      return null;
    } catch (err) {
      console.error('验证管理员凭据失败:', err);
      throw err;
    }
  }
}

// 用户数据操作类
class UserDB {
  // 创建新用户
  async createUser(userData) {
    try {
      const { username, email, password, fullName } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, full_name, created_at
      `, [username, email, hashedPassword, fullName]);
      
      return result.rows[0];
    } catch (err) {
      console.error('创建用户失败:', err);
      throw err;
    }
  }

  // 根据邮箱或用户名查找用户
  async findByEmailOrUsername(identifier) {
    try {
      const result = await pool.query(`
        SELECT id, username, email, password_hash, full_name, avatar_url, bio, 
               is_active, email_verified, created_at, updated_at, last_login
        FROM users 
        WHERE email = $1 OR username = $1
      `, [identifier]);
      return result.rows[0];
    } catch (err) {
      console.error('查找用户失败:', err);
      throw err;
    }
  }

  // 验证用户凭据
  async validateCredentials(identifier, password) {
    try {
      const user = await this.findByEmailOrUsername(identifier);
      if (!user || !user.is_active) {
        return null;
      }
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (isValid) {
        // 更新最后登录时间
        await this.updateLastLogin(user.id);
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          avatar_url: user.avatar_url,
          bio: user.bio
        };
      }
      
      return null;
    } catch (err) {
      console.error('验证用户凭据失败:', err);
      throw err;
    }
  }

  // 更新最后登录时间
  async updateLastLogin(userId) {
    try {
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (err) {
      console.error('更新最后登录时间失败:', err);
      throw err;
    }
  }

  // 根据ID获取用户信息（不包含敏感信息）
  async getUserById(id) {
    try {
      const result = await pool.query(`
        SELECT id, username, email, full_name, avatar_url, bio, 
               is_active, email_verified, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `, [id]);
      return result.rows[0];
    } catch (err) {
      console.error('获取用户信息失败:', err);
      throw err;
    }
  }

  // 更新用户资料
  async updateUserProfile(userId, profileData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(profileData)) {
        if (['full_name', 'avatar_url', 'bio'].includes(key) && value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return null;
      }

      values.push(userId);
      const query = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id, username, email, full_name, avatar_url, bio, updated_at`;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (err) {
      console.error('更新用户资料失败:', err);
      throw err;
    }
  }
}

// 导出数据库实例
export const postDB = new PostDB();
export const commentDB = new CommentDB();
export const adminDB = new AdminDB();
export const userDB = new UserDB();
