/**
 * Telegram风格动画库
 * 为个人博客网站提供Telegram风格的动画效果
 * 包括页面切换、按钮反馈、模态框过渡等动画
 */

class TelegramAnimations {
    constructor() {
        this.isAnimating = false;
        this.init();
    }

    init() {
        // 初始化页面切换动画
        this.initPageTransitions();
        
        // 初始化按钮点击反馈
        this.initButtonAnimations();
        
        // 初始化列表项动画
        this.initListAnimations();
        
        // 初始化模态框动画
        this.initModalAnimations();
        
        console.log('Telegram动画库初始化完成');
    }

    /**
     * 页面切换动画 - 模仿Telegram的页面切换效果
     */
    initPageTransitions() {
        // 监听所有内部链接点击
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link || !link.href || link.target === '_blank' || link.href.includes('#')) {
                return;
            }

            // 检查是否是内部链接
            const url = new URL(link.href);
            if (url.origin !== window.location.origin) {
                return;
            }

            e.preventDefault();
            this.navigateToPage(link.href);
        });

        // 监听浏览器前进后退
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });
    }

    /**
     * 导航到新页面
     */
    async navigateToPage(url) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        try {
            // 创建页面切换动画
            await this.animatePageTransition('out');
            
            // 加载新页面内容
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const newDocument = parser.parseFromString(html, 'text/html');
            
            // 更新页面内容
            this.updatePageContent(newDocument);
            
            // 更新浏览器历史记录
            window.history.pushState({}, '', url);
            
            // 执行进入动画
            await this.animatePageTransition('in');
            
        } catch (error) {
            console.error('页面切换失败:', error);
            window.location.href = url; // 降级到传统导航
        } finally {
            this.isAnimating = false;
        }
    }

    /**
     * 处理浏览器前进后退
     */
    async handlePopState(e) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        try {
            // 执行离开动画
            await this.animatePageTransition('out');
            
            // 重新加载页面内容
            const response = await fetch(window.location.href);
            const html = await response.text();
            const parser = new DOMParser();
            const newDocument = parser.parseFromString(html, 'text/html');
            
            // 更新页面内容
            this.updatePageContent(newDocument);
            
            // 执行进入动画
            await this.animatePageTransition('in');
            
        } catch (error) {
            console.error('历史记录导航失败:', error);
            window.location.reload(); // 降级到页面刷新
        } finally {
            this.isAnimating = false;
        }
    }

    /**
     * 页面切换动画
     */
    animatePageTransition(direction) {
        return new Promise((resolve) => {
            const mainContent = document.querySelector('.main-content');
            if (!mainContent) {
                resolve();
                return;
            }

            if (direction === 'out') {
                // 离开动画 - 向右滑动
                mainContent.style.transform = 'translateX(-100%)';
                mainContent.style.opacity = '0';
                mainContent.style.transition = `transform ${getComputedStyle(document.documentElement).getPropertyValue('--transition-page')} cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${getComputedStyle(document.documentElement).getPropertyValue('--transition-page')} cubic-bezier(0.34, 1.56, 0.64, 1)`;
                
                setTimeout(() => {
                    mainContent.style.display = 'none';
                    resolve();
                }, 300);
            } else {
                // 进入动画 - 从右侧滑入
                mainContent.style.display = 'block';
                mainContent.style.transform = 'translateX(100%)';
                mainContent.style.opacity = '0';
                
                // 强制重绘
                mainContent.offsetHeight;
                
                mainContent.style.transform = 'translateX(0)';
                mainContent.style.opacity = '1';
                mainContent.style.transition = `transform ${getComputedStyle(document.documentElement).getPropertyValue('--transition-page')} cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${getComputedStyle(document.documentElement).getPropertyValue('--transition-page')} cubic-bezier(0.34, 1.56, 0.64, 1)`;
                
                setTimeout(resolve, 300);
            }
        });
    }

    /**
     * 更新页面内容
     */
    updatePageContent(newDocument) {
        const mainContent = document.querySelector('.main-content');
        const newMainContent = newDocument.querySelector('.main-content');
        
        if (mainContent && newMainContent) {
            mainContent.innerHTML = newMainContent.innerHTML;
        }
        
        // 更新页面标题
        document.title = newDocument.title;
        
        // 重新初始化页面脚本
        this.reinitializePageScripts();
    }

    /**
     * 重新初始化页面脚本
     */
    reinitializePageScripts() {
        // 重新初始化主题
        if (typeof initTheme === 'function') {
            initTheme();
        }
        
        // 重新初始化导航
        if (typeof initNavigation === 'function') {
            initNavigation();
        }
        
        // 重新初始化其他必要的脚本
        if (typeof loadBlogPosts === 'function') {
            loadBlogPosts();
        }
    }

    /**
     * 初始化按钮动画
     */
    initButtonAnimations() {
        try {
            // 使用事件委托减少事件监听器数量，提高性能
            document.body.addEventListener('click', (event) => {
                const button = event.target.closest('button, .btn, .telegram-button, [data-ripple="true"]');
                if (button) {
                    // 防止事件冒泡导致多个涟漪
                    event.stopPropagation();
                    this.animateButtonPress(button);
                    this.createRipple(event, button);
                }
            });
        } catch (error) {
            console.error('初始化按钮动画失败:', error);
        }
    }

    /**
     * 按钮按下动画
     */
    animateButtonPress(button) {
        // 添加按下类
        button.classList.add('telegram-button-press');
        
        // 移除按下类
        setTimeout(() => {
            button.classList.remove('telegram-button-press');
        }, 100);
    }

    /**
     * 初始化列表项动画
     */
    initListAnimations() {
        try {
            // 使用Intersection Observer代替MutationObserver，性能更好
            this.listObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateListItem(entry.target);
                        this.listObserver.unobserve(entry.target); // 只观察一次
                    }
                });
            }, {
                threshold: 0.1, // 当10%的元素可见时触发
                rootMargin: '50px' // 提前50px开始动画
            });

            // 观察所有现有列表项
            this.observeAllListItems();
        } catch (error) {
            console.error('初始化列表项动画失败:', error);
        }
    }

    /**
     * 观察所有列表项
     */
    observeAllListItems() {
        document.querySelectorAll('.blog-post, .list-item, .card, .blog-card, li, .article-preview').forEach(item => {
            // 检查元素是否已有动画类
            if (!item.classList.contains('animated')) {
                this.listObserver.observe(item);
            }
        });
    }

    /**
     * 动画列表项
     */
    animateListItem(element) {
        if (!element) return;
        
        try {
            // 设置初始状态
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            
            // 使用requestAnimationFrame确保流畅动画
            requestAnimationFrame(() => {
                // 设置最终状态
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
                element.classList.add('animated'); // 标记为已动画
                element.classList.add('telegram-fade-in'); // 保持原有类名以兼容CSS
            });
        } catch (error) {
            console.error('动画列表项失败:', error);
        }
    }

    /**
     * 模态框动画
     */
    initModalAnimations() {
        try {
            // 使用事件委托处理模态框触发
            document.addEventListener('click', (event) => {
                const trigger = event.target.closest('[data-modal]');
                if (trigger) {
                    event.preventDefault();
                    const modalId = trigger.dataset.modal;
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        this.openModal(modal);
                    }
                }
                
                // 处理关闭按钮
                const closeButton = event.target.closest('.modal-close, .modal-backdrop');
                if (closeButton) {
                    const modal = closeButton.closest('.modal');
                    if (modal) {
                        this.closeModal(modal);
                    }
                }
            });
            
            // ESC键关闭模态框
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    const openModal = document.querySelector('.modal.show');
                    if (openModal) {
                        this.closeModal(openModal);
                    }
                }
            });
        } catch (error) {
            console.error('初始化模态框动画失败:', error);
        }
    }

    /**
     * 打开模态框
     */
    openModal(modal) {
        if (!modal) return;
        
        try {
            // 检查是否已有模态框打开，避免堆叠
            const openModal = document.querySelector('.modal.show');
            if (openModal && openModal !== modal) {
                this.closeModal(openModal);
            }
            
            // 存储模态框原始位置
            modal._originalStyle = modal.style.cssText;
            
            // 添加背景
            let backdrop = document.querySelector('.modal-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop telegram-fade-in';
                backdrop.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(2px);
                `;
                document.body.appendChild(backdrop);
            }
            
            // 将模态框添加到背景中
            if (modal.parentNode !== backdrop) {
                backdrop.appendChild(modal);
            }
            
            // 设置模态框样式
            modal.style.cssText = `
                position: relative;
                background: var(--modal-bg, #fff);
                border-radius: 10px;
                padding: 20px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                transform: scale(0.95);
                opacity: 0;
                outline: none;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            `;
            
            // 处理深色主题
            if (document.body.classList.contains('dark-theme')) {
                modal.style.setProperty('--modal-bg', '#2d2d2d');
            }
            
            document.body.style.overflow = 'hidden'; // 防止背景滚动
            modal.classList.add('show');
            
            // 使用requestAnimationFrame确保流畅动画
            requestAnimationFrame(() => {
                modal.style.transform = 'scale(1)';
                modal.style.opacity = '1';
                modal.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                modal.classList.add('telegram-scale-in');
            });
            
            modal.dataset.backdrop = 'true';
        } catch (error) {
            console.error('显示模态框失败:', error);
        }
    }

    /**
     * 关闭模态框
     */
    closeModal(modal) {
        if (!modal) return;
        
        try {
            const backdrop = modal.closest('.modal-backdrop');
            if (backdrop) {
                // 动画隐藏
                modal.classList.remove('telegram-scale-in');
                modal.classList.add('telegram-scale-out');
                
                setTimeout(() => {
                    // 恢复原始样式
                    if (modal._originalStyle) {
                        modal.style.cssText = modal._originalStyle;
                        delete modal._originalStyle;
                    }
                    
                    backdrop.remove();
                    document.body.style.overflow = '';
                    modal.classList.remove('show');
                    delete modal.dataset.backdrop;
                }, 300);
            }
        } catch (error) {
            console.error('隐藏模态框失败:', error);
        }
    }

    /**
     * 显示加载动画
     */
    showLoading(message = '加载中...') {
        try {
            // 检查是否已有加载动画
            let loading = document.querySelector('.telegram-loading');
            if (loading) {
                loading.remove();
            }
            
            // 创建加载动画元素
            loading = document.createElement('div');
            loading.className = 'telegram-loading telegram-fade-in';
            
            // 使用CSS变量和主题
            const isDark = document.body.classList.contains('dark-theme');
            const bgColor = isDark ? 'rgba(45, 45, 45, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            const textColor = isDark ? '#fff' : '#000';
            
            loading.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                background: ${bgColor};
                color: ${textColor};
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(4px);
            `;
            
            loading.innerHTML = `
                <div class="loading-spinner telegram-spin" style="border-top-color: var(--primary-color, #3498db);"></div>
                <div class="loading-text">${message}</div>
            `;
            
            document.body.appendChild(loading);
            
            return loading;
        } catch (error) {
            console.error('显示加载动画失败:', error);
            return null;
        }
    }

    /**
     * 隐藏加载动画
     */
    hideLoading(loading) {
        if (!loading || !loading.parentNode) return;
        
        try {
            loading.classList.remove('telegram-fade-in');
            loading.classList.add('telegram-fade-out');
            
            setTimeout(() => {
                if (loading && loading.parentNode) {
                    loading.remove();
                }
            }, 300);
        } catch (error) {
            console.error('隐藏加载动画失败:', error);
        }
    }
    
    /**
     * 销毁动画库实例
     */
    destroy() {
        try {
            // 清理观察者
            if (this.listObserver) {
                this.listObserver.disconnect();
            }
            
            // 清理状态
            this.isAnimating = false;
            
            console.log('Telegram动画库已销毁');
        } catch (error) {
            console.error('销毁动画库失败:', error);
        }
    }

    /**
 * 创建波纹效果
 */
createRipple(event, element) {
    if (!element || !this.supported) return;
    
    try {
        // 检查元素是否已经有涟漪动画在进行中
        const existingRipple = element.querySelector('.ripple-effect');
        if (existingRipple) {
            existingRipple.remove(); // 移除旧的涟漪
        }
        
        // 创建涟漪元素
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        
        // 获取按钮尺寸
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        // 使用CSS变量设置涟漪颜色
        const bgColor = getComputedStyle(element).getPropertyValue('--ripple-color') || 'rgba(255, 255, 255, 0.5)';
        
        // 设置涟漪样式
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: ${bgColor};
            border-radius: 50%;
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
            z-index: 1;
        `;
        
        // 确保元素有相对定位
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        // 添加涟漪到元素
        element.appendChild(ripple);
        
        // 动画结束后移除涟漪
        setTimeout(() => {
            if (ripple && ripple.parentNode) {
                ripple.remove();
            }
        }, 600);
    } catch (error) {
        console.error('创建涟漪效果失败:', error);
    }
}
}

// 添加全局动画样式
const style = document.createElement('style');
style.textContent = `
    /* 涟漪效果样式 */
    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
        z-index: 1;
    }
    
    /* 深色主题下的涟漪效果 */
    body.dark-theme .ripple-effect {
        background: rgba(255, 255, 255, 0.3);
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    /* 优化动画性能 */
    .ripple-effect,
    .telegram-button,
    .main-content {
        will-change: transform, opacity;
    }
    
    /* 禁用动画的媒体查询 - 用于性能模式或减少运动偏好 */
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
        }
    }
`;
document.head.appendChild(style);

let telegramAnimations;

document.addEventListener('DOMContentLoaded', () => {
    try {
        telegramAnimations = new TelegramAnimations();
    } catch (error) {
        console.error('创建Telegram动画实例失败:', error);
    }
});

// 安全的全局访问接口
window.TelegramAnimations = {
    showLoading: () => telegramAnimations?.showLoading(),
    hideLoading: (loading) => telegramAnimations?.hideLoading(loading),
    createRipple: (event, element) => {
        try {
            if (telegramAnimations && typeof telegramAnimations.createRipple === 'function') {
                telegramAnimations.createRipple(event, element);
            }
        } catch (error) {
            console.error('调用涟漪效果失败:', error);
        }
    },
    isSupported: () => {
        return telegramAnimations && telegramAnimations.supported;
    }
};

// 添加动画队列处理功能
TelegramAnimations.queueAnimation = (animationFn) => {
    if (telegramAnimations) {
        telegramAnimations.animationQueue.push(animationFn);
        if (!telegramAnimations.isAnimating) {
            telegramAnimations.processNextAnimation();
        }
    }
};

TelegramAnimations.prototype.processNextAnimation = function() {
    if (this.animationQueue.length === 0) {
        this.isAnimating = false;
        return;
    }
    
    this.isAnimating = true;
    const animationFn = this.animationQueue.shift();
    
    Promise.resolve(animationFn())
        .then(() => {
            this.isAnimating = false;
            this.processNextAnimation();
        })
        .catch((error) => {
            console.error('动画队列处理失败:', error);
            this.isAnimating = false;
            this.processNextAnimation();
        });
}