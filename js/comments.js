// 评论系统功能
class CommentSystem {
    constructor() {
        this.currentPostId = null;
        this.isAdmin = false;
        this.comments = [];
        this.init();
    }

    async init() {
        // 检查是否为管理员
        await this.checkAdminStatus();
        
        // 监听文章详情页面的显示
        this.observeArticlePage();
        
        console.log('评论系统初始化完成', { isAdmin: this.isAdmin });
    }

    // 检查管理员状态
    async checkAdminStatus() {
        try {
            const response = await fetch('/api/check-ip');
            if (response.ok) {
                const data = await response.json();
                this.isAdmin = data.isAdminIp;
                console.log('管理员状态检查:', data);
            }
        } catch (error) {
            console.warn('检查管理员状态失败:', error);
            this.isAdmin = false;
        }
    }

    // 监听文章详情页面
    observeArticlePage() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const articleDetail = document.getElementById('article-detail');
                    if (articleDetail && articleDetail.style.display !== 'none') {
                        // 获取文章ID
                        const postId = this.extractPostId();
                        if (postId && postId !== this.currentPostId) {
                            this.currentPostId = postId;
                            this.loadComments();
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 从URL或页面内容提取文章ID
    extractPostId() {
        // 从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        let postId = urlParams.get('postId');
        
        if (!postId) {
            // 从页面内容获取（假设文章详情页有文章ID）
            const articleDetail = document.getElementById('article-detail');
            if (articleDetail) {
                const postIdAttr = articleDetail.getAttribute('data-post-id');
                if (postIdAttr) {
                    postId = postIdAttr;
                }
            }
        }
        
        return postId;
    }

    // 加载评论
    async loadComments() {
        if (!this.currentPostId) return;

        try {
            const url = `/api/comments?postId=${this.currentPostId}${this.isAdmin ? '&admin=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.comments = data.comments;
                this.renderComments();
            } else {
                throw new Error(data.message || '加载评论失败');
            }
        } catch (error) {
            console.error('加载评论失败:', error);
            this.showError('加载评论失败，请刷新页面重试');
        }
    }

    // 渲染评论界面
    renderComments() {
        const articleDetail = document.getElementById('article-detail');
        if (!articleDetail) return;

        // 移除现有的评论区域
        const existingComments = articleDetail.querySelector('.comments-section');
        if (existingComments) {
            existingComments.remove();
        }

        // 创建评论区域
        const commentsSection = document.createElement('div');
        commentsSection.className = 'comments-section';
        commentsSection.innerHTML = this.generateCommentsHTML();
        
        // 添加到文章详情页
        articleDetail.appendChild(commentsSection);

        // 绑定事件
        this.bindEvents();
    }

    // 生成评论HTML
    generateCommentsHTML() {
        return `
            <div class="comments-header">
                <h2 class="comments-title">评论</h2>
                <span class="comments-count">${this.comments.length} 条评论</span>
            </div>
            
            <div class="comment-form">
                <h3>发表评论</h3>
                <form id="comment-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="comment-author">昵称 *</label>
                            <input type="text" id="comment-author" name="author" required maxlength="50">
                        </div>
                        <div class="form-group">
                            <label for="comment-email">邮箱</label>
                            <input type="email" id="comment-email" name="email" maxlength="100">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="comment-content">评论内容 *</label>
                        <textarea id="comment-content" name="content" required maxlength="1000" placeholder="请输入您的评论..."></textarea>
                    </div>
                    <button type="submit" class="submit-btn telegram-button telegram-ripple">发表评论</button>
                </form>
                <div id="comment-message"></div>
            </div>
            
            <div class="comments-list" id="comments-list">
                ${this.generateCommentsListHTML()}
            </div>
        `;
    }

    // 生成评论列表HTML
    generateCommentsListHTML() {
        if (this.comments.length === 0) {
            return `
                <div class="comments-empty">
                    <h3>暂无评论</h3>
                    <p>成为第一个发表评论的人吧！</p>
                </div>
            `;
        }

        return this.comments.map(comment => this.generateCommentHTML(comment)).join('');
    }

    // 生成单个评论HTML
    generateCommentHTML(comment) {
        const date = new Date(comment.createdAt).toLocaleString('zh-CN');
        const avatarText = comment.author.charAt(0).toUpperCase();
        
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-author">
                        <div class="author-avatar">${avatarText}</div>
                        <div class="author-info">
                            <h4 class="author-name">${this.escapeHtml(comment.author)}</h4>
                            ${comment.email ? `<p class="author-email">${this.escapeHtml(comment.email)}</p>` : ''}
                        </div>
                    </div>
                    <div class="comment-meta">
                        <span class="comment-date">${date}</span>
                        ${comment.status !== 'approved' ? `<span class="comment-status status-${comment.status}">${this.getStatusText(comment.status)}</span>` : ''}
                    </div>
                </div>
                <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                ${this.isAdmin ? this.generateAdminActionsHTML(comment) : ''}
            </div>
        `;
    }

    // 生成管理员操作按钮
    generateAdminActionsHTML(comment) {
        return `
            <div class="comment-actions">
                ${comment.status !== 'approved' ? `<button class="action-btn approve-btn" data-action="approve" data-id="${comment.id}">通过</button>` : ''}
                ${comment.status !== 'rejected' ? `<button class="action-btn reject-btn" data-action="reject" data-id="${comment.id}">拒绝</button>` : ''}
                <button class="action-btn delete-btn" data-action="delete" data-id="${comment.id}">删除</button>
            </div>
        `;
    }

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            'pending': '待审核',
            'approved': '已通过',
            'rejected': '已拒绝'
        };
        return statusMap[status] || status;
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 绑定事件
    bindEvents() {
        // 评论表单提交
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            commentForm.addEventListener('submit', (e) => this.handleCommentSubmit(e));
        }

        // 管理员操作按钮
        if (this.isAdmin) {
            const actionButtons = document.querySelectorAll('.action-btn');
            actionButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.handleAdminAction(e));
            });
        }
    }

    // 处理评论提交
    async handleCommentSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('.submit-btn');
        const messageDiv = document.getElementById('comment-message');
        
        // 获取表单数据
        const formData = new FormData(form);
        const commentData = {
            postId: this.currentPostId,
            author: formData.get('author').trim(),
            content: formData.get('content').trim(),
            email: formData.get('email').trim()
        };

        // 验证数据
        if (!commentData.author || !commentData.content) {
            this.showMessage('请填写昵称和评论内容', 'error', messageDiv);
            return;
        }

        try {
            // 禁用提交按钮
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';

            // 提交评论
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commentData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage(data.message, 'success', messageDiv);
                form.reset();
                
                // 重新加载评论
                setTimeout(() => {
                    this.loadComments();
                }, 1000);
            } else {
                throw new Error(data.message || '提交失败');
            }
        } catch (error) {
            console.error('提交评论失败:', error);
            this.showMessage(error.message || '提交评论失败，请重试', 'error', messageDiv);
        } finally {
            // 恢复提交按钮
            submitBtn.disabled = false;
            submitBtn.textContent = '发表评论';
        }
    }

    // 处理管理员操作
    async handleAdminAction(e) {
        const button = e.target;
        const action = button.getAttribute('data-action');
        const commentId = button.getAttribute('data-id');
        
        if (!action || !commentId) return;

        // 确认操作
        const confirmMessage = this.getConfirmMessage(action);
        if (!confirm(confirmMessage)) return;

        try {
            button.disabled = true;
            button.textContent = '处理中...';

            const response = await fetch(`/api/comments?id=${commentId}&action=${action}`, {
                method: 'PUT'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // 重新加载评论
                await this.loadComments();
            } else {
                throw new Error(data.message || '操作失败');
            }
        } catch (error) {
            console.error('管理员操作失败:', error);
            alert('操作失败: ' + error.message);
        }
    }

    // 获取确认消息
    getConfirmMessage(action) {
        const messages = {
            'approve': '确定要通过这条评论吗？',
            'reject': '确定要拒绝这条评论吗？',
            'delete': '确定要删除这条评论吗？此操作不可撤销。'
        };
        return messages[action] || '确定要执行此操作吗？';
    }

    // 显示消息
    showMessage(message, type, container) {
        if (!container) return;
        
        container.innerHTML = `
            <div class="comment-${type}">
                ${message}
            </div>
        `;
        
        // 3秒后自动清除消息
        setTimeout(() => {
            container.innerHTML = '';
        }, 3000);
    }

    // 显示错误消息
    showError(message) {
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            commentsList.innerHTML = `
                <div class="comment-error">
                    ${message}
                </div>
            `;
        }
    }
}

// 初始化评论系统
document.addEventListener('DOMContentLoaded', () => {
    // 只在文章详情页面初始化评论系统
    const articleDetail = document.getElementById('article-detail');
    if (articleDetail) {
        window.commentSystem = new CommentSystem();
    }
});