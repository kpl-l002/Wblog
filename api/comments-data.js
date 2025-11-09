// 评论数据模型和存储管理

// 评论数据结构
class Comment {
    constructor(id, postId, author, content, email = '', status = 'pending', createdAt = new Date(), parentId = null) {
        this.id = id;
        this.postId = postId;
        this.author = author;
        this.content = content;
        this.email = email;
        this.status = status; // pending, approved, rejected
        this.createdAt = createdAt;
        this.parentId = parentId; // 用于回复评论
        this.ip = ''; // 用户IP地址
        this.userAgent = ''; // 用户浏览器信息
    }
}

// 评论存储管理类
class CommentStore {
    constructor() {
        // 使用内存存储作为备用方案
        this.comments = new Map();
        this.nextId = 1;
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // 添加评论
    async addComment(commentData) {
        try {
            const id = this.generateId();
            const comment = new Comment(
                id,
                commentData.postId,
                commentData.author,
                commentData.content,
                commentData.email,
                commentData.status || 'pending',
                new Date(),
                commentData.parentId
            );

            // 设置用户信息
            comment.ip = commentData.ip || '';
            comment.userAgent = commentData.userAgent || '';

            // 保存到内存
            this.comments.set(id, comment);

            // 如果配置了Vercel KV，则保存到Redis
            if (process.env.KV_REST_API_URL) {
                await this.saveToKV(id, comment);
            }

            return comment;
        } catch (error) {
            console.error('添加评论失败:', error);
            throw error;
        }
    }

    // 保存到Vercel KV
    async saveToKV(id, comment) {
        try {
            // 这里需要安装 @vercel/kv 包
            // const kv = require('@vercel/kv');
            // await kv.set(`comment:${id}`, JSON.stringify(comment));
            // await kv.lpush(`comments:${comment.postId}`, id);
            console.log('Vercel KV 存储功能需要安装 @vercel/kv 包');
        } catch (error) {
            console.error('保存到KV失败:', error);
        }
    }

    // 获取文章的所有评论
    async getCommentsByPostId(postId, includePending = false) {
        try {
            const comments = [];
            
            // 从内存中获取
            for (const [id, comment] of this.comments.entries()) {
                if (comment.postId === postId && (includePending || comment.status === 'approved')) {
                    comments.push(comment);
                }
            }

            // 按时间排序
            comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            return comments;
        } catch (error) {
            console.error('获取评论失败:', error);
            throw error;
        }
    }

    // 获取所有评论（管理员用）
    async getAllComments() {
        try {
            const comments = Array.from(this.comments.values());
            comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return comments;
        } catch (error) {
            console.error('获取所有评论失败:', error);
            throw error;
        }
    }

    // 更新评论状态
    async updateCommentStatus(id, status) {
        try {
            const comment = this.comments.get(id);
            if (comment) {
                comment.status = status;
                this.comments.set(id, comment);
                
                // 更新KV存储
                if (process.env.KV_REST_API_URL) {
                    await this.saveToKV(id, comment);
                }
                
                return comment;
            }
            return null;
        } catch (error) {
            console.error('更新评论状态失败:', error);
            throw error;
        }
    }

    // 删除评论
    async deleteComment(id) {
        try {
            const deleted = this.comments.delete(id);
            
            // 从KV删除
            if (process.env.KV_REST_API_URL && deleted) {
                // const kv = require('@vercel/kv');
                // await kv.del(`comment:${id}`);
                console.log('从KV删除评论功能需要安装 @vercel/kv 包');
            }
            
            return deleted;
        } catch (error) {
            console.error('删除评论失败:', error);
            throw error;
        }
    }

    // 获取评论统计
    async getCommentStats() {
        try {
            const comments = Array.from(this.comments.values());
            const stats = {
                total: comments.length,
                approved: comments.filter(c => c.status === 'approved').length,
                pending: comments.filter(c => c.status === 'pending').length,
                rejected: comments.filter(c => c.status === 'rejected').length
            };
            return stats;
        } catch (error) {
            console.error('获取评论统计失败:', error);
            throw error;
        }
    }
}

// 创建全局存储实例
const commentStore = new CommentStore();

module.exports = {
    Comment,
    CommentStore,
    commentStore
};