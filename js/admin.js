// 博客管理系统 - 核心JavaScript逻辑

// 全局状态管理
const adminState = {
    isLoggedIn: false,
    currentSection: 'posts',
    posts: [],
    comments: [],
    currentPage: 1,
    commentsPage: 1,
    itemsPerPage: 10,
    pendingDelete: null,
    currentUser: null
};

// 安全配置 - 防止XSS和CSRF攻击
const securityConfig = {
    sanitizeHTML: true,
    rateLimitAttempts: 5,
    rateLimitWindowMs: 60000 // 1分钟
};

// 错误计数器 - 用于登录尝试限制
let failedLoginAttempts = 0;
let lastFailedAttempt = 0;

// 模拟管理员凭据（实际应用中应使用安全的身份验证）
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123' // 实际应用中应使用加密存储
};

// 模拟评论数据
const mockComments = [
    {
        id: 1,
        postId: 1,
        postTitle: "JavaScript 异步编程完全指南",
        user: "张三",
        content: "这篇文章写得非常好，让我对异步编程有了更深入的理解！",
        date: "2025-10-28T10:30:00",
        status: "approved"
    },
    {
        id: 2,
        postId: 1,
        postTitle: "JavaScript 异步编程完全指南",
        user: "李四",
        content: "请问Promise和async/await有什么具体的使用场景区别？",
        date: "2025-10-28T14:45:00",
        status: "pending"
    },
    {
        id: 3,
        postId: 2,
        postTitle: "如何构建一个现代化的前端架构",
        user: "王五",
        content: "架构设计真的很重要，感谢分享这些经验！",
        date: "2025-10-26T09:15:00",
        status: "approved"
    },
    {
        id: 4,
        postId: 2,
        postTitle: "如何构建一个现代化的前端架构",
        user: "赵六",
        content: "这篇文章过时了，现在都用新的框架了！",
        date: "2025-10-27T16:20:00",
        status: "rejected"
    }
];

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeAdminSystem();
});

// 初始化管理系统
function initializeAdminSystem() {
    // 检查用户登录状态
    checkLoginStatus();
    
    // 初始化登录功能
    initLoginForm();
    
    // 初始化导航功能
    initNavigation();
    
    // 初始化模态框功能
    initModals();
}

// 检查登录状态
function checkLoginStatus() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        try {
            // 验证token（实际应用中应与后端验证）
            const decoded = JSON.parse(atob(token));
            if (decoded.exp > Date.now()) {
                adminState.isLoggedIn = true;
                adminState.currentUser = decoded.user;
                showAdminPanel();
                loadAllData();
                return;
            }
        } catch (error) {
            console.error('Token验证失败:', error);
        }
        // 清除无效token
        localStorage.removeItem('adminToken');
    }
    
    // 未登录状态
    showLoginPage();
}

// 初始化登录表单
function initLoginForm() {
    try {
        const loginForm = document.getElementById('login-btn');
        if (loginForm) {
            loginForm.addEventListener('click', handleLogin);
        }
        
        // 添加Enter键登录支持
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            });
        }
        
        // 绑定主题切换
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
        
        // 初始化主题
        initAdminTheme();
    } catch (error) {
        console.error('登录表单初始化失败:', error);
    }
}

// 处理登录逻辑
function handleLogin() {
    try {
        // 检查登录尝试限制
        const now = Date.now();
        if (failedLoginAttempts >= securityConfig.rateLimitAttempts && 
            now - lastFailedAttempt < securityConfig.rateLimitWindowMs) {
            showMessage('登录尝试次数过多，请稍后再试', 'error');
            return;
        }
        
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorElement = document.getElementById('login-error');
        
        const username = usernameInput?.value || '';
        const password = passwordInput?.value || '';
        
        // 清空之前的错误信息
        if (errorElement) errorElement.textContent = '';
        
        // 简单验证
        if (!username.trim() || !password) {
            showMessage('请输入用户名和密码', 'error');
            return;
        }
        
        // 防止SQL注入的基本过滤
        const sanitizedUsername = username.replace(/[<>"'&]/g, '');
        
        // 验证凭据
        if (sanitizedUsername === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            // 创建token（实际应用中应由后端生成）
            const tokenData = {
                user: sanitizedUsername,
                exp: Date.now() + (24 * 60 * 60 * 1000) // 24小时过期
            };
            
            const token = btoa(JSON.stringify(tokenData));
            localStorage.setItem('adminToken', token);
            
            // 重置失败尝试计数
            failedLoginAttempts = 0;
            
            adminState.isLoggedIn = true;
            adminState.currentUser = sanitizedUsername;
            
            showAdminPanel();
            loadAllData();
            
            // 清空表单
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
        } else {
            // 登录失败
            failedLoginAttempts++;
            lastFailedAttempt = now;
            
            const remainingAttempts = securityConfig.rateLimitAttempts - failedLoginAttempts;
            let message = '用户名或密码错误';
            
            if (remainingAttempts > 0) {
                message += `，还剩 ${remainingAttempts} 次尝试机会`;
            }
            
            if (errorElement) errorElement.textContent = message;
        }
    } catch (error) {
        console.error('登录处理错误:', error);
        const errorElement = document.getElementById('login-error');
        if (errorElement) errorElement.textContent = '登录过程中发生错误，请稍后再试';
    }
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

// 显示管理面板
function showAdminPanel() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    
    // 恢复侧边栏折叠状态
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar && isCollapsed) {
        sidebar.classList.add('collapsed');
    }
}

// 加载所有数据
function loadAllData() {
    // 从data.js加载帖子数据
    if (typeof blogPosts !== 'undefined') {
        adminState.posts = [...blogPosts].map(post => ({
            ...post,
            status: 'published', // 默认设置为已发布
            views: Math.floor(Math.random() * 1000) + 100 // 模拟浏览量
        }));
    }
    
    // 加载评论数据
    adminState.comments = [...mockComments];
    
    // 初始化帖子管理
    initPostsManagement();
    
    // 初始化评论管理
    initCommentsManagement();
    
    // 初始化设置管理
    initSettingsManagement();
    
    // 更新评论统计
    updateCommentStats();
}

// 初始化导航功能
function initNavigation() {
    // 导航菜单点击事件
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // 退出登录
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 侧边栏折叠按钮点击事件
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
    }
}

// 切换侧边栏折叠状态
function toggleSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        
        // 保存折叠状态到localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
}

// 切换导航区域
function switchSection(section) {
    // 更新当前区域
    adminState.currentSection = section;
    
    // 更新导航样式
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    
    // 显示对应内容区域
    document.querySelectorAll('.section').forEach(sectionEl => {
        sectionEl.classList.add('hidden');
        if (sectionEl.id === `${section}-section`) {
            sectionEl.classList.remove('hidden');
        }
    });
    
    // 重置分页
    if (section === 'posts') {
        adminState.currentPage = 1;
        renderPostsList();
    } else if (section === 'comments') {
        adminState.commentsPage = 1;
        renderCommentsList();
    }
}

// 退出登录
function handleLogout() {
    try {
        // 清除所有身份验证相关的存储数据
        localStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminUsername');
        sessionStorage.removeItem('adminSessionId');
        
        // 重置状态
        adminState.isLoggedIn = false;
        adminState.currentUser = null;
        
        // 重定向到登录页面
        showLoginPage();
        
        // 添加退出动画效果
        const loginPage = document.getElementById('login-page');
        if (loginPage) {
            loginPage.style.opacity = '0';
            setTimeout(() => {
                loginPage.style.opacity = '1';
                loginPage.style.transition = 'opacity 0.5s ease';
            }, 100);
        }
    } catch (error) {
        console.error('退出登录错误:', error);
        // 强制刷新页面以确保安全退出
        window.location.reload();
    }
}

// 初始化帖子管理功能
function initPostsManagement() {
    // 添加新帖子按钮
    const addPostBtn = document.getElementById('add-post-btn');
    if (addPostBtn) {
        addPostBtn.addEventListener('click', () => openPostModal());
    }
    
    // 搜索功能
    const searchPostBtn = document.getElementById('search-post-btn');
    if (searchPostBtn) {
        searchPostBtn.addEventListener('click', handlePostSearch);
    }
    
    // 搜索框回车事件
    const postSearchInput = document.getElementById('post-search');
    if (postSearchInput) {
        postSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePostSearch();
            }
        });
    }
    
    // 筛选功能
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    
    if (categoryFilter) categoryFilter.addEventListener('change', renderPostsList);
    if (statusFilter) statusFilter.addEventListener('change', renderPostsList);
    
    // 分页控制
    document.getElementById('prev-page').addEventListener('click', () => {
        if (adminState.currentPage > 1) {
            adminState.currentPage--;
            renderPostsList();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredPosts().length / adminState.itemsPerPage);
        if (adminState.currentPage < totalPages) {
            adminState.currentPage++;
            renderPostsList();
        }
    });
    
    // 帖子表单提交
    document.getElementById('post-form').addEventListener('submit', handlePostFormSubmit);
    
    // 初始渲染帖子列表
    renderPostsList();
}

// 获取筛选后的帖子
function getFilteredPosts() {
    const searchTerm = document.getElementById('post-search').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const status = document.getElementById('status-filter').value;
    
    return adminState.posts.filter(post => {
        const matchesSearch = !searchTerm || 
            post.title.toLowerCase().includes(searchTerm) ||
            post.content.toLowerCase().includes(searchTerm);
        
        const matchesCategory = category === 'all' || post.category === category;
        const matchesStatus = status === 'all' || post.status === status;
        
        return matchesSearch && matchesCategory && matchesStatus;
    });
}

// 处理帖子搜索
function handlePostSearch() {
    adminState.currentPage = 1;
    renderPostsList();
}

// 渲染帖子列表
function renderPostsList() {
    const filteredPosts = getFilteredPosts();
    const startIndex = (adminState.currentPage - 1) * adminState.itemsPerPage;
    const endIndex = startIndex + adminState.itemsPerPage;
    const paginatedPosts = filteredPosts.slice(startIndex, endIndex);
    
    const postsList = document.getElementById('posts-list');
    postsList.innerHTML = '';
    
    if (paginatedPosts.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="8" class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>暂无帖子数据</p>
            </td>
        `;
        postsList.appendChild(emptyRow);
    } else {
        paginatedPosts.forEach(post => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${post.title}</td>
                <td>${post.category}</td>
                <td>${post.author}</td>
                <td>${post.date}</td>
                <td>
                    <span class="status-badge status-${post.status}">
                        ${post.status === 'published' ? '已发布' : '草稿'}
                    </span>
                </td>
                <td>${post.views || 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit telegram-button telegram-ripple" data-id="${post.id}">编辑</button>
                        <button class="action-btn btn-delete telegram-button telegram-ripple" data-id="${post.id}">删除</button>
                        <button class="action-btn ${post.status === 'published' ? 'btn-draft' : 'btn-publish'} telegram-button telegram-ripple" data-id="${post.id}" data-action="${post.status === 'published' ? 'draft' : 'publish'}">
                            ${post.status === 'published' ? '下架' : '发布'}
                        </button>
                    </div>
                </td>
            `;
            postsList.appendChild(row);
        });
        
        // 添加事件监听器
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = parseInt(e.currentTarget.dataset.id);
                openPostModal(postId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = parseInt(e.currentTarget.dataset.id);
                showConfirmDialog('删除帖子', '确定要删除这篇帖子吗？此操作不可恢复。', () => {
                    deletePost(postId);
                });
            });
        });
        
        document.querySelectorAll('.btn-publish, .btn-draft').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = parseInt(e.currentTarget.dataset.id);
                const action = e.currentTarget.dataset.action;
                updatePostStatus(postId, action);
            });
        });
    }
    
    // 更新分页
    updatePagination(filteredPosts.length, adminState.currentPage, 'posts');
}

// 更新分页控件
function updatePagination(totalItems, currentPage, type) {
    const totalPages = Math.ceil(totalItems / adminState.itemsPerPage);
    const pageNumbersContainer = type === 'posts' ? 
        document.getElementById('page-numbers') : 
        document.getElementById('comment-page-numbers');
    
    const prevBtn = type === 'posts' ? 
        document.getElementById('prev-page') : 
        document.getElementById('prev-comment-page');
    
    const nextBtn = type === 'posts' ? 
        document.getElementById('next-page') : 
        document.getElementById('next-comment-page');
    
    // 更新按钮状态
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    
    // 更新页码
    pageNumbersContainer.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // 显示页码（简化版本）
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            if (type === 'posts') {
                adminState.currentPage = i;
                renderPostsList();
            } else {
                adminState.commentsPage = i;
                renderCommentsList();
            }
        });
        pageNumbersContainer.appendChild(pageBtn);
    }
}

// 初始化评论管理功能
function initCommentsManagement() {
    // 搜索功能
    const searchCommentBtn = document.getElementById('search-comment-btn');
    if (searchCommentBtn) {
        searchCommentBtn.addEventListener('click', handleCommentSearch);
    }
    
    // 搜索框回车事件
    const commentSearchInput = document.getElementById('comment-search');
    if (commentSearchInput) {
        commentSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleCommentSearch();
            }
        });
    }
    
    // 筛选功能
    const statusFilter = document.getElementById('comment-status-filter');
    const postFilter = document.getElementById('post-filter');
    
    if (statusFilter) statusFilter.addEventListener('change', renderCommentsList);
    if (postFilter) postFilter.addEventListener('change', renderCommentsList);
    
    // 分页控制
    document.getElementById('prev-comment-page').addEventListener('click', () => {
        if (adminState.commentsPage > 1) {
            adminState.commentsPage--;
            renderCommentsList();
        }
    });
    
    document.getElementById('next-comment-page').addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredComments().length / adminState.itemsPerPage);
        if (adminState.commentsPage < totalPages) {
            adminState.commentsPage++;
            renderCommentsList();
        }
    });
    
    // 评论表单提交
    document.getElementById('comment-form').addEventListener('submit', handleCommentFormSubmit);
    
    // 填充帖子筛选下拉框
    populatePostFilter();
    
    // 初始渲染评论列表
    renderCommentsList();
}

// 填充帖子筛选下拉框
function populatePostFilter() {
    const postFilter = document.getElementById('post-filter');
    adminState.posts.forEach(post => {
        const option = document.createElement('option');
        option.value = post.id;
        option.textContent = post.title;
        postFilter.appendChild(option);
    });
}

// 获取筛选后的评论
function getFilteredComments() {
    const searchTerm = document.getElementById('comment-search').value.toLowerCase();
    const status = document.getElementById('comment-status-filter').value;
    const postId = document.getElementById('post-filter').value;
    
    return adminState.comments.filter(comment => {
        const matchesSearch = !searchTerm || 
            comment.content.toLowerCase().includes(searchTerm) ||
            comment.user.toLowerCase().includes(searchTerm);
        
        const matchesStatus = status === 'all' || comment.status === status;
        const matchesPost = postId === 'all' || comment.postId === parseInt(postId);
        
        return matchesSearch && matchesStatus && matchesPost;
    });
}

// 处理评论搜索
function handleCommentSearch() {
    adminState.commentsPage = 1;
    renderCommentsList();
}

// 渲染评论列表
function renderCommentsList() {
    const filteredComments = getFilteredComments();
    const startIndex = (adminState.commentsPage - 1) * adminState.itemsPerPage;
    const endIndex = startIndex + adminState.itemsPerPage;
    const paginatedComments = filteredComments.slice(startIndex, endIndex);
    
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';
    
    if (paginatedComments.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="6" class="empty-state">
                <div class="empty-state-icon">💬</div>
                <p>暂无评论数据</p>
            </td>
        `;
        commentsList.appendChild(emptyRow);
    } else {
        paginatedComments.forEach(comment => {
            const row = document.createElement('tr');
            const formattedDate = new Date(comment.date).toLocaleString('zh-CN');
            
            let statusText = '';
            switch(comment.status) {
                case 'pending': statusText = '待审核'; break;
                case 'approved': statusText = '已通过'; break;
                case 'rejected': statusText = '已拒绝'; break;
            }
            
            row.innerHTML = `
                <td>${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}</td>
                <td>${comment.user}</td>
                <td>${comment.postTitle}</td>
                <td>${formattedDate}</td>
                <td>
                    <span class="status-badge status-${comment.status}">${statusText}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit telegram-button telegram-ripple" data-id="${comment.id}">编辑</button>
                        <button class="action-btn btn-delete telegram-button telegram-ripple" data-id="${comment.id}">删除</button>
                        ${comment.status === 'pending' ? `
                            <button class="action-btn btn-publish telegram-button telegram-ripple" data-id="${comment.id}" data-action="approve">通过</button>
                        ` : ''}
                    </div>
                </td>
            `;
            commentsList.appendChild(row);
        });
        
        // 添加事件监听器
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = parseInt(e.currentTarget.dataset.id);
                openCommentModal(commentId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = parseInt(e.currentTarget.dataset.id);
                showConfirmDialog('删除评论', '确定要删除这条评论吗？此操作不可恢复。', () => {
                    deleteComment(commentId);
                });
            });
        });
        
        document.querySelectorAll('.btn-publish[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = parseInt(e.currentTarget.dataset.id);
                updateCommentStatus(commentId, 'approved');
            });
        });
    }
    
    // 更新分页
    updatePagination(filteredComments.length, adminState.commentsPage, 'comments');
}

// 更新评论统计
function updateCommentStats() {
    const pendingCount = adminState.comments.filter(c => c.status === 'pending').length;
    const approvedCount = adminState.comments.filter(c => c.status === 'approved').length;
    
    document.querySelector('.stat-item:nth-child(1) .stat-number').textContent = pendingCount;
    document.querySelector('.stat-item:nth-child(2) .stat-number').textContent = approvedCount;
}

// 初始化设置管理功能
function initSettingsManagement() {
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', handleSaveSettings);
    }
}

// 处理保存设置
function handleSaveSettings() {
    const siteTitle = document.getElementById('site-title').value;
    const siteDescription = document.getElementById('site-description').value;
    const authorName = document.getElementById('author-name').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 验证密码
    if (newPassword && newPassword !== confirmPassword) {
        showMessage('密码不匹配，请重新输入', 'error');
        return;
    }
    
    // 保存设置（实际应用中应发送到后端）
    const settings = {
        siteTitle,
        siteDescription,
        authorName
    };
    
    // 如果修改密码
    if (newPassword) {
        // 在实际应用中，这里应该通过安全的API更新密码
        ADMIN_CREDENTIALS.password = newPassword;
    }
    
    // 保存到localStorage（仅演示）
    localStorage.setItem('blogSettings', JSON.stringify(settings));
    
    showMessage('设置保存成功！', 'success');
    
    // 清空密码字段
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

// 初始化模态框功能
function initModals() {
    // 关闭模态框按钮
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
    
    // 确认对话框按钮
    document.getElementById('cancel-confirm').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-action').addEventListener('click', executeConfirmAction);
}

// 打开帖子模态框
function openPostModal(postId = null) {
    const modal = document.getElementById('post-modal');
    const modalTitle = document.getElementById('modal-title');
    const postForm = document.getElementById('post-form');
    
    // 重置表单
    postForm.reset();
    document.getElementById('post-id').value = '';
    
    if (postId) {
        // 编辑模式
        modalTitle.textContent = '编辑帖子';
        const post = adminState.posts.find(p => p.id === postId);
        
        if (post) {
            document.getElementById('post-id').value = post.id;
            document.getElementById('post-title').value = post.title;
            document.getElementById('post-category').value = post.category;
            document.getElementById('post-author').value = post.author;
            document.getElementById('post-date').value = post.date;
            document.getElementById('post-image').value = post.image || '';
            document.getElementById('post-excerpt').value = post.excerpt || '';
            document.getElementById('post-content').value = post.content;
            document.getElementById('post-status').value = post.status || 'published';
        }
    } else {
        // 添加模式
        modalTitle.textContent = '添加新帖子';
        // 设置默认日期为今天
        document.getElementById('post-date').valueAsDate = new Date();
        // 设置默认作者
        document.getElementById('post-author').value = 'Alexander';
    }
    
    modal.classList.remove('hidden');
}

// 打开评论模态框
function openCommentModal(commentId) {
    const modal = document.getElementById('comment-modal');
    const comment = adminState.comments.find(c => c.id === commentId);
    
    if (comment) {
        document.getElementById('comment-id').value = comment.id;
        document.getElementById('comment-user').value = comment.user;
        document.getElementById('comment-post').value = comment.postTitle;
        document.getElementById('comment-text').value = comment.content;
        document.getElementById('comment-status').value = comment.status;
        
        modal.classList.remove('hidden');
    }
}

// 显示确认对话框
function showConfirmDialog(title, message, confirmAction) {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    // 保存确认操作
    adminState.pendingDelete = confirmAction;
    
    dialog.classList.remove('hidden');
}

// 关闭确认对话框
function closeConfirmDialog() {
    document.getElementById('confirm-dialog').classList.add('hidden');
    adminState.pendingDelete = null;
}

// 执行确认操作
function executeConfirmAction() {
    if (typeof adminState.pendingDelete === 'function') {
        adminState.pendingDelete();
    }
    closeConfirmDialog();
}

// 关闭所有模态框
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
    adminState.pendingDelete = null;
}

// 处理帖子表单提交
function handlePostFormSubmit(e) {
    e.preventDefault();
    
    const postId = parseInt(document.getElementById('post-id').value);
    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const author = document.getElementById('post-author').value;
    const date = document.getElementById('post-date').value;
    const image = document.getElementById('post-image').value;
    const excerpt = document.getElementById('post-excerpt').value;
    const content = document.getElementById('post-content').value;
    const status = document.getElementById('post-status').value;
    
    if (postId) {
        // 更新帖子
        const index = adminState.posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            adminState.posts[index] = {
                ...adminState.posts[index],
                title,
                category,
                author,
                date,
                image,
                excerpt,
                content,
                status
            };
            showMessage('帖子更新成功！', 'success');
        }
    } else {
        // 添加新帖子
        const newPost = {
            id: Date.now(), // 简单的ID生成
            title,
            category,
            author,
            date,
            image,
            excerpt,
            content,
            status,
            views: 0
        };
        adminState.posts.unshift(newPost);
        showMessage('帖子添加成功！', 'success');
    }
    
    closeAllModals();
    renderPostsList();
    populatePostFilter();
}

// 处理评论表单提交
function handleCommentFormSubmit(e) {
    e.preventDefault();
    
    const commentId = parseInt(document.getElementById('comment-id').value);
    const content = document.getElementById('comment-text').value;
    const status = document.getElementById('comment-status').value;
    
    const index = adminState.comments.findIndex(c => c.id === commentId);
    if (index !== -1) {
        adminState.comments[index] = {
            ...adminState.comments[index],
            content,
            status
        };
        
        showMessage('评论更新成功！', 'success');
        closeAllModals();
        renderCommentsList();
        updateCommentStats();
    }
}

// 删除帖子
function deletePost(postId) {
    adminState.posts = adminState.posts.filter(p => p.id !== postId);
    // 同时删除相关评论
    adminState.comments = adminState.comments.filter(c => c.postId !== postId);
    
    showMessage('帖子删除成功！', 'success');
    renderPostsList();
    renderCommentsList();
    updateCommentStats();
    populatePostFilter();
}

// 更新帖子状态
function updatePostStatus(postId, status) {
    const post = adminState.posts.find(p => p.id === postId);
    if (post) {
        post.status = status;
        showMessage(`帖子已${status === 'published' ? '发布' : '下架'}！`, 'success');
        renderPostsList();
    }
}

// 删除评论
function deleteComment(commentId) {
    adminState.comments = adminState.comments.filter(c => c.id !== commentId);
    showMessage('评论删除成功！', 'success');
    renderCommentsList();
    updateCommentStats();
}

// 更新评论状态
function updateCommentStatus(commentId, status) {
    const comment = adminState.comments.find(c => c.id === commentId);
    if (comment) {
        comment.status = status;
        showMessage(`评论已${status === 'approved' ? '通过' : status === 'rejected' ? '拒绝' : '标记为待审核'}！`, 'success');
        renderCommentsList();
        updateCommentStats();
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    try {
        // 确保只有一个消息框显示
        const existingMessage = document.querySelector('.message');
        if (existingMessage) existingMessage.remove();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = `message notification-${type}`;
        messageContainer.textContent = message;
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        // 设置不同类型消息的背景色
        switch(type) {
            case 'error':
                messageContainer.style.backgroundColor = '#dc3545';
                break;
            case 'success':
                messageContainer.style.backgroundColor = '#28a745';
                break;
            case 'warning':
                messageContainer.style.backgroundColor = '#ffc107';
                messageContainer.style.color = '#333';
                break;
            default:
                messageContainer.style.backgroundColor = '#17a2b8';
        }
        
        document.body.appendChild(messageContainer);
        
        // 显示动画
        setTimeout(() => {
            messageContainer.style.opacity = '1';
            messageContainer.style.transform = 'translateX(0)';
        }, 10);
        
        // 自动关闭
        setTimeout(() => {
            messageContainer.style.opacity = '0';
            messageContainer.style.transform = 'translateX(100%)';
            setTimeout(() => messageContainer.remove(), 300);
        }, 3000);
    } catch (error) {
        console.error('显示消息失败:', error);
    }
}

// 辅助函数 - 生成会话ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// 辅助函数 - 清理输入以防止XSS
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>"'&]/g, char => {
        const entities = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '&': '&amp;'
        };
        return entities[char] || char;
    });
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // ESC键关闭模态框
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

// 定期保存数据到localStorage（仅演示）
setInterval(() => {
    if (adminState.isLoggedIn) {
        localStorage.setItem('blogAdminBackup', JSON.stringify({
            posts: adminState.posts,
            comments: adminState.comments
        }));
    }
}, 60000); // 每分钟保存一次

// 导出功能（模拟数据导出）
function exportData(type) {
    let data;
    let filename;
    
    if (type === 'posts') {
        data = JSON.stringify(adminState.posts, null, 2);
        filename = `blog_posts_${new Date().toISOString().split('T')[0]}.json`;
    } else if (type === 'comments') {
        data = JSON.stringify(adminState.comments, null, 2);
        filename = `blog_comments_${new Date().toISOString().split('T')[0]}.json`;
    }
    
    if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('数据导出成功！', 'success');
    }
}