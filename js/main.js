// 当前显示的分类
let currentCategory = 'all';
let allPosts = [];

// 分页相关变量
let currentPage = 1;
let postsPerPage = 6;
let totalPages = 1;
let currentSearchKeyword = '';

// 检测当前环境是否为Vercel
function isVercelEnvironment() {
    return typeof window !== 'undefined' && 
           (window.location.hostname.includes('vercel.app') || 
            window.location.hostname === 'wblog.vercel.app'); // 替换为你的Vercel自定义域名
}

// 初始化函数
function init() {
    try {
        // 加载Telegram动画库
        if (typeof TelegramAnimations !== 'undefined') {
            telegramAnimations = new TelegramAnimations();
        }
        
        // 检测环境
        const vercelEnv = isVercelEnvironment();
        console.log(`环境检测: ${vercelEnv ? 'Vercel' : '其他平台'}`);
        
        initTheme();
        initNavigation();
        initFilters();
        initBackButton();
        initContactForm();
        initSearch();
        initPagination();
        initNavbarScroll(); // 初始化导航栏滚动效果
        loadBlogPosts(); // 加载博客文章
        
        console.log('页面初始化完成');
    } catch (error) {
        console.error('初始化过程中发生错误:', error);
        // 显示友好的错误信息给用户
        showError('页面加载过程中发生错误，请刷新页面重试。');
        
        // 显示友好的错误信息
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ff6b6b; color: white; padding: 1rem; text-align: center; z-index: 10000;';
        errorDiv.textContent = '应用初始化失败，请刷新页面重试';
        document.body.appendChild(errorDiv);
        
        // 5秒后自动移除错误信息
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化主题
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // 应用保存的主题
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeIcon(true);
    }
    
    // 主题切换按钮事件
    themeToggle.addEventListener('click', (event) => {
        // 创建圆形扩散动画
        createThemeTransitionAnimation(event);
        
        // 延迟主题切换，等动画开始后再改变主题
        setTimeout(() => {
            const isDark = document.body.classList.toggle('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        }, 100);
        
        // 添加切换动画
        themeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            themeToggle.style.transform = '';
        }, 300);
    });
}

// 创建主题切换圆形扩散动画
function createThemeTransitionAnimation(event) {
    // 创建覆盖层元素
    const overlay = document.createElement('div');
    overlay.classList.add('theme-transition-overlay');
    
    // 设置覆盖层位置为点击位置
    const rect = event.target.getBoundingClientRect();
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    overlay.style.left = `${clickX}px`;
    overlay.style.top = `${clickY}px`;
    overlay.style.transform = 'translate(-50%, -50%)';
    
    // 添加到文档
    document.body.appendChild(overlay);
    
    // 触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
    
    // 动画结束后移除元素
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 600);
}

// 更新主题图标
function updateThemeIcon(isDark) {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
}

// 初始化导航栏滚动效果
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    let ticking = false;
    let isHidden = false;

    function updateNavbar() {
        const scrollY = window.scrollY;
        const scrollDelta = scrollY - lastScrollY;
        
        // 添加滚动类名
        if (scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // 优化滚动方向检测：只在向下滚动且超过阈值时隐藏，向上滚动时立即显示
        if (scrollY > 100 && scrollDelta > 5 && !isHidden) {
            // 向下滚动隐藏导航栏
            navbar.style.transform = 'translateY(-100%)';
            navbar.style.transition = 'transform 0.3s ease';
            isHidden = true;
        } else if (scrollDelta < -5 && isHidden) {
            // 向上滚动显示导航栏
            navbar.style.transform = 'translateY(0)';
            navbar.style.transition = 'transform 0.3s ease';
            isHidden = false;
        } else if (scrollY <= 100 && isHidden) {
            // 回到顶部时显示导航栏
            navbar.style.transform = 'translateY(0)';
            navbar.style.transition = 'transform 0.3s ease';
            isHidden = false;
        }

        lastScrollY = scrollY;
        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    
    // 初始状态检查
    updateNavbar();
}

// 加载博客文章
function loadBlogPosts(category = 'all') {
    try {
        const blogGrid = document.getElementById('blog-grid');
        if (!blogGrid) {
            console.warn('未找到博客文章网格容器');
            return;
        }
        
        // 显示加载状态
        blogGrid.innerHTML = '<div class="loading-spinner"></div>';
        
        // 使用setTimeout模拟异步加载，避免UI阻塞
        setTimeout(() => {
            if (typeof blogPosts !== 'undefined') {
                // 筛选文章
                if (category === 'all') {
                    allPosts = [...blogPosts];
                } else {
                    allPosts = blogPosts.filter(post => post.category === category);
                }
                
                updatePagination();
                updateDisplayedPosts();
            } else {
                blogGrid.innerHTML = '<div class="error-message">加载文章时出错</div>';
                showError('加载文章失败,请刷新页面重试');
            }
        }, 100); // 小延迟，让加载动画有机会显示
    } catch (error) {
        console.error('加载博客文章失败:', error);
        const blogGrid = document.getElementById('blog-grid');
        if (blogGrid) {
            blogGrid.innerHTML = '<div class="error-message">加载文章时出错</div>';
        }
        showError('加载文章失败,请刷新页面重试');
    }
}

// 更新分页信息
function updatePagination() {
    totalPages = Math.ceil(allPosts.length / postsPerPage);
    renderPagination();
}

// 渲染分页控件
function renderPagination() {
    const pageNumbers = document.getElementById('page-numbers');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // 更新按钮状态
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // 清空页码
    pageNumbers.innerHTML = '';
    
    // 显示页码
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // 调整起始页码
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // 添加页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            updateDisplayedPosts();
        });
        pageNumbers.appendChild(pageBtn);
    }
    
    // 显示分页信息
    const paginationInfo = document.createElement('span');
    paginationInfo.className = 'pagination-info';
    paginationInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    pageNumbers.appendChild(paginationInfo);
}

// 更新显示的文章
function updateDisplayedPosts() {
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const displayedPosts = allPosts.slice(startIndex, endIndex);
    
    renderBlogCards(displayedPosts);
    updatePagination();
}

// 渲染博客卡片
function renderBlogCards(posts) {
    const blogGrid = document.getElementById('blog-grid');
    
    if (posts.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'text-align: center; padding: 2rem; color: #666;';
        emptyMsg.textContent = '暂无文章';
        blogGrid.innerHTML = '';
        blogGrid.appendChild(emptyMsg);
        return;
    }
    
    blogGrid.innerHTML = '';
    
    posts.forEach(post => {
        const card = createBlogCard(post);
        blogGrid.appendChild(card);
    });
}

// 渲染博客文章列表
function renderBlogPosts(posts) {
    const blogList = document.getElementById('blog-list');
    if (!blogList) return;
    
    // 清空现有内容
    blogList.innerHTML = '';
    
    if (posts.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'text-align: center; padding: 2rem; color: #666;';
        emptyMsg.textContent = '暂无文章';
        blogList.appendChild(emptyMsg);
        return;
    }
    
    // 安全地创建和添加博客文章元素
    posts.forEach(post => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'blog-card';
        cardDiv.dataset.id = post.id;
        
        const imageDiv = document.createElement('div');
        imageDiv.className = 'blog-card-image';
        
        const img = document.createElement('img');
        img.src = post.image;
        img.alt = post.title;
        img.onerror = function() { this.src = 'images/placeholder.jpg'; };
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'blog-card-content';
        
        const titleH3 = document.createElement('h3');
        titleH3.textContent = post.title;
        
        const excerptP = document.createElement('p');
        excerptP.textContent = post.excerpt;
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'blog-meta';
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'blog-date';
        dateSpan.textContent = formatDate(post.date);
        
        const categorySpan = document.createElement('span');
        categorySpan.className = 'blog-category';
        categorySpan.textContent = post.category;
        
        // 组装元素
        imageDiv.appendChild(img);
        metaDiv.appendChild(dateSpan);
        metaDiv.appendChild(categorySpan);
        contentDiv.appendChild(titleH3);
        contentDiv.appendChild(excerptP);
        contentDiv.appendChild(metaDiv);
        cardDiv.appendChild(imageDiv);
        cardDiv.appendChild(contentDiv);
        
        blogList.appendChild(cardDiv);
    });
}

// 创建博客卡片
function createBlogCard(post) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    
    // 安全地创建图片元素
    const img = document.createElement('img');
    img.src = post.image;
    img.alt = post.title;
    img.onerror = function() { this.src = 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'; };
    
    // 安全地创建内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'blog-card-content';
    
    // 安全地创建标题
    const title = document.createElement('h3');
    title.textContent = post.title;
    
    // 安全地创建元信息
    const metaDiv = document.createElement('div');
    metaDiv.className = 'blog-meta';
    
    const categorySpan = document.createElement('span');
    categorySpan.className = 'blog-category';
    categorySpan.textContent = post.category;
    
    const dateSpan = document.createElement('span');
    dateSpan.textContent = post.date;
    
    const authorSpan = document.createElement('span');
    authorSpan.textContent = '作者: ' + post.author;
    
    // 安全地创建统计信息
    const statsDiv = document.createElement('div');
    statsDiv.className = 'blog-stats';
    
    const viewsSpan = document.createElement('span');
    viewsSpan.textContent = '👁️ ' + (post.views || 0);
    
    const likesSpan = document.createElement('span');
    likesSpan.textContent = '❤️ ' + (post.likes || 0);
    
    // 安全地创建摘要
    const excerptP = document.createElement('p');
    excerptP.className = 'blog-excerpt';
    excerptP.textContent = post.excerpt;
    
    // 安全地创建阅读全文链接
    const readMoreLink = document.createElement('a');
    readMoreLink.href = '#';
    readMoreLink.className = 'read-more telegram-button telegram-ripple';
    readMoreLink.textContent = '阅读全文 →';
    
    // 组装元素
    metaDiv.appendChild(categorySpan);
    metaDiv.appendChild(dateSpan);
    metaDiv.appendChild(authorSpan);
    
    statsDiv.appendChild(viewsSpan);
    statsDiv.appendChild(likesSpan);
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(metaDiv);
    contentDiv.appendChild(statsDiv);
    contentDiv.appendChild(excerptP);
    contentDiv.appendChild(readMoreLink);
    
    card.appendChild(img);
    card.appendChild(contentDiv);
    
    // 点击卡片查看详情
    card.addEventListener('click', (e) => {
        e.preventDefault();
        loadArticleDetail(post.id);
    });
    
    return card;
}

// 加载并显示文章详情
function loadArticleDetail(postId) {
    loadLocalArticle(postId);
}

// 从本地数据加载文章
function loadLocalArticle(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (post) {
        renderArticleDetail(post, true);
    } else {
        showError('文章不存在');
    }
}

// 渲染文章详情
function renderArticleDetail(post, isLocal = false) {
    const articleDetail = document.getElementById('article-detail');
    
    // 清空现有内容
    articleDetail.innerHTML = '';
    
    // 安全地创建文章标题
    const title = document.createElement('h2');
    title.textContent = post.title;
    
    // 安全地创建文章元信息
    const meta = document.createElement('div');
    meta.className = 'article-meta';
    
    const categorySpan = document.createElement('span');
    categorySpan.className = 'blog-category';
    categorySpan.textContent = post.category;
    
    const dateSpan = document.createElement('span');
    dateSpan.textContent = post.date;
    
    const authorSpan = document.createElement('span');
    authorSpan.textContent = '作者: ' + post.author;
    
    meta.appendChild(categorySpan);
    meta.appendChild(dateSpan);
    meta.appendChild(authorSpan);
    
    if (!isLocal) {
        const viewsSpan = document.createElement('span');
        viewsSpan.textContent = '👁️ ' + (post.views || 0) + ' 次浏览';
        meta.appendChild(viewsSpan);
    }
    
    // 安全地创建文章内容
    const content = document.createElement('div');
    content.className = 'article-content';
    content.innerHTML = post.content;
    
    // 安全地创建点赞按钮（仅非本地模式）
    let actionsDiv = null;
    if (!isLocal) {
        actionsDiv = document.createElement('div');
        actionsDiv.className = 'article-actions';
        
        const likeBtn = document.createElement('button');
        likeBtn.className = 'btn-like telegram-button telegram-ripple';
        likeBtn.onclick = function() { likePost(post.id); };
        
        const likeText = document.createTextNode('❤️ 点赞 (');
        const likeCountSpan = document.createElement('span');
        likeCountSpan.id = 'like-count';
        likeCountSpan.textContent = post.likes || 0;
        const likeTextEnd = document.createTextNode(')');
        
        likeBtn.appendChild(likeText);
        likeBtn.appendChild(likeCountSpan);
        likeBtn.appendChild(likeTextEnd);
        actionsDiv.appendChild(likeBtn);
    }
    
    // 安全地创建评论区域
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    
    const commentsTitle = document.createElement('h3');
    commentsTitle.textContent = '评论区';
    commentsSection.appendChild(commentsTitle);
    
    if (isLocal) {
        const warningP = document.createElement('p');
        warningP.style.cssText = 'color: #999; text-align: center; padding: 1rem; background: #f9f9f9; border-radius: 8px;';
        
        const warningText1 = document.createTextNode('⚠️ 评论功能需要启动后端服务器');
        const br = document.createElement('br');
        const warningText2 = document.createTextNode('请运行 ');
        const code = document.createElement('code');
        code.style.cssText = 'background: #e0e0e0; padding: 0.2rem 0.5rem; border-radius: 4px;';
        code.textContent = 'npm start';
        const warningText3 = document.createTextNode(' 启动服务器');
        
        warningP.appendChild(warningText1);
        warningP.appendChild(br);
        warningP.appendChild(warningText2);
        warningP.appendChild(code);
        warningP.appendChild(warningText3);
        
        commentsSection.appendChild(warningP);
    } else {
        const commentForm = document.createElement('form');
        commentForm.className = 'comment-form';
        commentForm.onsubmit = function(event) { submitComment(event, post.id); };
        
        const formGroup1 = document.createElement('div');
        formGroup1.className = 'form-group';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'comment-name';
        nameInput.placeholder = '姓名';
        nameInput.required = true;
        formGroup1.appendChild(nameInput);
        
        const formGroup2 = document.createElement('div');
        formGroup2.className = 'form-group';
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'comment-email';
        emailInput.placeholder = '邮箱(可选)';
        formGroup2.appendChild(emailInput);
        
        const formGroup3 = document.createElement('div');
        formGroup3.className = 'form-group';
        const contentTextarea = document.createElement('textarea');
        contentTextarea.id = 'comment-content';
        contentTextarea.placeholder = '写下你的评论...';
        contentTextarea.rows = 3;
        contentTextarea.required = true;
        formGroup3.appendChild(contentTextarea);
        
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn-submit-comment telegram-button telegram-ripple';
        submitBtn.textContent = '发表评论';
        
        commentForm.appendChild(formGroup1);
        commentForm.appendChild(formGroup2);
        commentForm.appendChild(formGroup3);
        commentForm.appendChild(submitBtn);
        
        const commentsList = document.createElement('div');
        commentsList.id = 'comments-list';
        commentsList.className = 'comments-list';
        
        commentsSection.appendChild(commentForm);
        commentsSection.appendChild(commentsList);
    }
    
    // 组装所有元素
    articleDetail.appendChild(title);
    articleDetail.appendChild(meta);
    if (actionsDiv) {
        articleDetail.appendChild(actionsDiv);
    }
    articleDetail.appendChild(content);
    articleDetail.appendChild(commentsSection);
    
    // 切换到文章页面
    document.getElementById('home-page').classList.remove('active');
    document.getElementById('article-page').classList.add('active');
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (!isLocal) {
        loadComments(post.id);
    }
}

// 初始化导航
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    const brandLink = document.querySelector('.brand-link');
    
    // 汉堡菜单功能
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
            const isActive = navMenu.classList.contains('active');
            navMenu.classList.toggle('active');
            hamburgerMenu.classList.toggle('active');
            hamburgerMenu.setAttribute('aria-expanded', !isActive);
            
            // 阻止滚动
            document.body.style.overflow = isActive ? '' : 'hidden';
        });
    }
    
    // 品牌链接导航
    if (brandLink) {
        brandLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 使用Telegram风格动画切换页面
            switchToPage('home', e);
        });
    }
    
    // 导航链接功能
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const page = link.dataset.page;
            switchToPage(page, e);
        });
        
        // 键盘导航支持
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const page = link.dataset.page;
                switchToPage(page, e);
            }
        });
    });
    
    // 关闭移动端菜单的函数
    function closeMobileMenu() {
        if (window.innerWidth <= 768) {
            navMenu.classList.remove('active');
            hamburgerMenu.classList.remove('active');
            hamburgerMenu.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    }
    
    // 窗口大小变化时重置菜单状态
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

// Telegram风格页面切换函数
function switchToPage(page, event) {
    try {
        // 如果Telegram动画库可用，使用动画切换
        if (typeof telegramAnimations !== 'undefined' && telegramAnimations.isAnimating) {
            return; // 如果正在动画中，忽略点击
        }
        
        const pageId = `${page}-page`;
        const currentPage = document.querySelector('.page.active');
        const targetPage = document.getElementById(pageId);
        const currentLink = document.querySelector('.nav-link.active');
        const targetLink = document.querySelector(`[data-page="${page}"]`);
        
        if (!targetPage || currentPage === targetPage) {
            return;
        }
        
        // 如果Telegram动画库可用，使用动画切换
        if (typeof telegramAnimations !== 'undefined') {
            // 使用Telegram动画库进行页面切换
            animatePageTransition(currentPage, targetPage, currentLink, targetLink, event);
        } else {
            // 降级到传统切换
            traditionalPageSwitch(currentPage, targetPage, currentLink, targetLink);
        }
        
        // 重置滚动位置
        window.scrollTo(0, 0);
        
        // 为新页面重新初始化必要的组件
        if (pageId === 'home-page') {
            loadBlogPosts();
            initPagination();
        } else if (pageId === 'article-page') {
            // 文章页面已在loadArticleDetail中处理
        }
    } catch (error) {
        console.error('页面切换失败:', error);
        showError('页面切换失败，请稍后再试。');
        // 降级到显示首页
        const homePage = document.getElementById('home-page');
        if (homePage) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            homePage.classList.add('active');
        }
    }
}

// 动画页面切换
function animatePageTransition(currentPage, targetPage, currentLink, targetLink, event) {
    // 添加Telegram风格动画类
    currentPage.classList.add('telegram-slide-out-left');
    targetPage.classList.add('telegram-slide-in-right');
    
    // 更新导航状态
    if (currentLink) currentLink.classList.remove('active');
    if (targetLink) targetLink.classList.add('active');
    
    // 延迟更新页面状态
    setTimeout(() => {
        currentPage.classList.remove('active', 'telegram-slide-out-left');
        targetPage.classList.add('active');
        targetPage.classList.remove('telegram-slide-in-right');
        
        // 关闭移动端菜单
        closeMobileMenu();
        
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // 触发页面切换完成事件
        const pageChangeEvent = new CustomEvent('pageChanged', {
            detail: { 
                fromPage: currentPage.id, 
                toPage: targetPage.id 
            }
        });
        document.dispatchEvent(pageChangeEvent);
    }, 300);
}

// 传统页面切换（降级方案）
function traditionalPageSwitch(currentPage, targetPage, currentLink, targetLink) {
    // 移除所有活动状态
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 添加当前活动状态
    if (targetLink) targetLink.classList.add('active');
    targetPage.classList.add('active');
    
    // 关闭移动端菜单
    closeMobileMenu();
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 关闭移动端菜单的函数
function closeMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    
    if (window.innerWidth <= 768 && navMenu && hamburgerMenu) {
        navMenu.classList.remove('active');
        hamburgerMenu.classList.remove('active');
        hamburgerMenu.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }
}

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    const performSearch = () => {
        const keyword = searchInput.value.trim();
        currentSearchKeyword = keyword;
        currentPage = 1;
        
        if (keyword) {
            // 前端搜索
            searchPosts(keyword);
        } else {
            // 清除搜索，显示所有文章
            loadBlogPosts(currentCategory);
        }
    };
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// 初始化筛选功能
function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新按钮状态
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 筛选文章
            const category = btn.dataset.category;
            currentCategory = category;
            currentPage = 1;
            currentSearchKeyword = '';
            document.getElementById('search-input').value = '';
            loadBlogPosts(category);
        });
    });
}

// 初始化分页功能
function initPagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateDisplayedPosts();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateDisplayedPosts();
        }
    });
}

// 初始化返回按钮
function initBackButton() {
    const btnBack = document.getElementById('btn-back');
    
    btnBack.addEventListener('click', () => {
        document.getElementById('article-page').classList.remove('active');
        document.getElementById('home-page').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 初始化联系表单
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        // 静态部署版本，只显示提交成功信息
        alert('感谢您的留言！由于当前为静态部署版本，您的留言已记录但不会发送到服务器。');
        contactForm.reset();
    });
}

// 点赞文章
function likePost(postId) {
    // 静态部署版本，只显示点赞成功信息
    showSuccess('点赞成功! (静态部署版本，点赞数据不会保存)');
}

// 加载评论
async function loadComments(postId) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    // 显示加载中状态
    commentsList.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 检查是否在Vercel环境
        const vercelEnv = isVercelEnvironment();
        let comments = [];
        
        if (vercelEnv) {
            // Vercel环境：调用API
            const response = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`);
            
            if (response.ok) {
                const data = await response.json();
                comments = data.comments || [];
                console.log('从API加载评论:', comments);
            } else {
                throw new Error(`API错误: ${response.status}`);
            }
        } else {
            // 非Vercel环境：使用本地存储
            comments = getCommentsFromStorage(postId);
        }
        
        // 按日期倒序排序
        comments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (comments.length > 0) {
            renderComments(comments);
        } else {
            commentsList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">暂无评论,快来抢沙发!</p>';
        }
    } catch (error) {
        console.error('加载评论出错:', error);
        // API失败时降级到本地存储
        const savedComments = getCommentsFromStorage(postId);
        savedComments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (savedComments.length > 0) {
            renderComments(savedComments);
        } else {
            commentsList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">暂无评论,快来抢沙发!</p>';
        }
        
        // 显示警告消息
        showWarning('使用本地缓存的评论数据');
    }
}

// 从本地存储获取评论
function getCommentsFromStorage(postId) {
    try {
        const commentsKey = `wblog_comments_${postId}`;
        const saved = localStorage.getItem(commentsKey);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.warn('读取评论数据失败:', error);
        return [];
    }
}

// 保存评论到本地存储
function saveCommentToStorage(postId, comment) {
    try {
        const commentsKey = `wblog_comments_${postId}`;
        const existingComments = getCommentsFromStorage(postId);
        const newComment = {
            ...comment,
            id: Date.now(),
            date: new Date().toISOString()
        };
        
        const updatedComments = [...existingComments, newComment];
        localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
        return true;
    } catch (error) {
        console.error('保存评论失败:', error);
        return false;
    }
}

// 渲染评论列表
function renderComments(comments) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    // 清空现有内容
    commentsList.innerHTML = '';
    
    if (comments.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'color: #999; text-align: center; padding: 1rem;';
        emptyMsg.textContent = '暂无评论,快来抢沙发!';
        commentsList.appendChild(emptyMsg);
        return;
    }
    
    // 安全地创建和添加评论元素
    comments.forEach(comment => {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        
        const commentHeader = document.createElement('div');
        commentHeader.className = 'comment-header';
        
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = comment.name;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'comment-date';
        dateSpan.textContent = new Date(comment.date).toLocaleString('zh-CN');
        
        const contentDiv = document.createElement('p');
        contentDiv.className = 'comment-content';
        contentDiv.textContent = comment.content;
        
        commentHeader.appendChild(nameSpan);
        commentHeader.appendChild(dateSpan);
        commentDiv.appendChild(commentHeader);
        commentDiv.appendChild(contentDiv);
        
        commentsList.appendChild(commentDiv);
    });
}

// 提交评论
async function submitComment(event, postId) {
    event.preventDefault();
    
    const nameInput = document.getElementById('comment-name');
    const emailInput = document.getElementById('comment-email');
    const contentInput = document.getElementById('comment-content');
    
    if (!nameInput || !emailInput || !contentInput) return;
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const content = contentInput.value.trim();
    
    // 验证表单
    if (!validateCommentForm(name, email, content)) return;
    
    // 创建评论对象
    const comment = {
        name: name,
        email: email,
        content: content,
        postId: postId
    };
    
    // 显示加载状态
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<div class="loading-spinner small"></div>';
    }
    
    try {
        // 检查是否在Vercel环境
        const vercelEnv = isVercelEnvironment();
        let success = false;
        
        if (vercelEnv) {
            // Vercel环境：调用API
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(comment)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('评论API响应:', result);
                success = true;
            } else {
                throw new Error(`API错误: ${response.status}`);
            }
        } else {
            // 非Vercel环境：使用本地存储
            success = saveCommentToStorage(postId, comment);
        }
        
        if (success) {
            showCommentSuccessMessage();
            
            // 清空表单
            nameInput.value = '';
            emailInput.value = '';
            contentInput.value = '';
            
            // 重新加载评论
            await loadComments(postId);
        } else {
            showCommentErrorMessage('评论提交失败，请重试');
        }
    } catch (error) {
        console.error('提交评论出错:', error);
        // API失败时降级到本地存储
        if (saveCommentToStorage(postId, comment)) {
            showCommentSuccessMessage();
            loadComments(postId);
        } else {
            showCommentErrorMessage('评论提交失败，请重试');
        }
    } finally {
        // 恢复按钮状态
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '提交评论';
        }
    }
}

// 验证评论表单
function validateCommentForm(name, email, content) {
    if (!name || !email || !content) {
        showCommentErrorMessage('请填写所有必填字段！');
        return false;
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showCommentErrorMessage('请输入有效的邮箱地址！');
        return false;
    }
    
    // 内容长度验证
    if (content.length < 5) {
        showCommentErrorMessage('评论内容至少需要5个字符！');
        return false;
    }
    
    if (content.length > 500) {
        showCommentErrorMessage('评论内容不能超过500个字符！');
        return false;
    }
    
    return true;
}

// 显示成功消息
function showCommentSuccessMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    messageDiv.textContent = '评论提交成功！';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// 显示错误消息
function showCommentErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// 前端搜索文章
function searchPosts(keyword) {
    if (typeof blogPosts !== 'undefined') {
        const filteredPosts = blogPosts.filter(post => 
            post.title.toLowerCase().includes(keyword.toLowerCase()) ||
            post.content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        allPosts = filteredPosts;
        updatePagination();
        updateDisplayedPosts();
        
        // 显示搜索结果信息
        const searchInfo = document.createElement('div');
        searchInfo.className = 'search-info';
        searchInfo.innerHTML = `搜索 "${keyword}" 的结果: ${filteredPosts.length} 篇文章`;
        
        const blogGrid = document.getElementById('blog-grid');
        blogGrid.parentNode.insertBefore(searchInfo, blogGrid);
    } else {
        showError('搜索功能暂时不可用');
    }
}

// 显示成功消息 - Telegram风格
function showSuccess(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 触发重排后显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // 移除元素
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 显示错误消息 - Telegram风格
function showError(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 触发重排后显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // 移除元素
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 显示警告消息 - Telegram风格
function showWarning(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning';
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 触发重排后显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // 移除元素
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// 显示模态框 - Telegram风格
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // 设置为flex布局
        modal.style.display = 'flex';
        // 强制重排
        modal.offsetHeight; // 触发重排
        // 添加active类启动动画
        modal.classList.add('active');
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '15px'; // 防止滚动条消失导致内容跳动
    }
}

// 隐藏模态框 - Telegram风格
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // 移除active类启动隐藏动画
        modal.classList.remove('active');
        // 等待动画完成后隐藏
        setTimeout(() => {
            modal.style.display = 'none';
            // 恢复背景滚动
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        }, 300);
    }
}
