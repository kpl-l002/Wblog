/**
 * QQ头像API处理工具
 * 用于获取和处理QQ头像，支持缓存和错误处理
 */

class QQAvatarHandler {
  constructor() {
    // 从环境变量或默认值获取配置
    this.enabled = window.APP_ENV?.ENABLE_QQ_AVATAR !== 'false';
    this.avatarSize = parseInt(window.APP_ENV?.QQ_AVATAR_SIZE || '100');
    this.defaultQQNumber = window.APP_ENV?.DEFAULT_QQ_NUMBER || '123456789';
    this.cacheTTL = parseInt(window.APP_ENV?.QQ_AVATAR_CACHE_TTL || '86400');
    this.cache = {};
    
    // 有效尺寸
    this.validSizes = [40, 100, 140];
    
    // 如果指定的尺寸无效，使用默认尺寸
    if (!this.validSizes.includes(this.avatarSize)) {
      console.warn(`Invalid QQ avatar size: ${this.avatarSize}, using default size 100`);
      this.avatarSize = 100;
    }
  }
  
  /**
   * 获取QQ头像URL
   * @param {string|number} qqNumber - QQ号码
   * @returns {string} QQ头像URL
   */
  getAvatarUrl(qqNumber) {
    if (!qqNumber || typeof qqNumber !== 'string' && typeof qqNumber !== 'number') {
      qqNumber = this.defaultQQNumber;
      console.warn('Invalid QQ number provided, using default');
    }
    
    // 确保QQ号是字符串格式
    qqNumber = String(qqNumber).trim();
    
    // 验证QQ号格式（简单验证：数字且长度合理）
    if (!/^\d{5,13}$/.test(qqNumber)) {
      console.warn(`Invalid QQ number format: ${qqNumber}, using default`);
      qqNumber = this.defaultQQNumber;
    }
    
    // 根据尺寸选择不同的API
    let url;
    if (this.avatarSize === 40) {
      url = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=40`;
    } else if (this.avatarSize === 140) {
      url = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=140`;
    } else { // 默认100
      url = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
    }
    
    return url;
  }
  
  /**
   * 异步获取QQ头像，带缓存
   * @param {string|number} qqNumber - QQ号码
   * @returns {Promise<string>} 头像URL
   */
  async fetchAvatar(qqNumber) {
    if (!this.enabled) {
      throw new Error('QQ Avatar feature is disabled');
    }
    
    // 检查缓存
    const cacheKey = String(qqNumber);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
    
    // 获取头像URL
    const url = this.getAvatarUrl(qqNumber);
    
    // 验证头像是否存在（通过预加载图片）
    try {
      await this.validateImage(url);
      // 存入缓存
      this.setToCache(cacheKey, url);
      return url;
    } catch (error) {
      console.error(`Failed to fetch avatar for QQ ${qqNumber}:`, error);
      // 返回默认头像
      const defaultUrl = this.getAvatarUrl(this.defaultQQNumber);
      this.setToCache(cacheKey, defaultUrl);
      return defaultUrl;
    }
  }
  
  /**
   * 验证图片是否存在且可访问
   * @param {string} url - 图片URL
   * @returns {Promise<void>}
   */
  validateImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // 检查是否是QQ默认头像（通过尺寸简单判断）
        if (img.width === 40 && img.height === 40 && this.avatarSize !== 40) {
          reject(new Error('Default avatar detected'));
        } else {
          resolve();
        }
      };
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = url;
      
      // 设置超时
      setTimeout(() => reject(new Error('Image load timeout')), 5000);
    });
  }
  
  /**
   * 从缓存获取头像
   * @param {string} key - 缓存键
   * @returns {string|null} 缓存的头像URL或null
   */
  getFromCache(key) {
    const cached = this.cache[key];
    if (cached && Date.now() < cached.expiry) {
      return cached.url;
    }
    
    // 清理过期缓存
    if (cached) {
      delete this.cache[key];
    }
    
    return null;
  }
  
  /**
   * 设置头像到缓存
   * @param {string} key - 缓存键
   * @param {string} url - 头像URL
   */
  setToCache(key, url) {
    this.cache[key] = {
      url,
      expiry: Date.now() + (this.cacheTTL * 1000)
    };
  }
  
  /**
   * 清空缓存
   */
  clearCache() {
    this.cache = {};
    console.log('QQ avatar cache cleared');
  }
  
  /**
   * 获取缓存统计信息
   * @returns {object} 缓存统计
   */
  getCacheStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    
    Object.values(this.cache).forEach(item => {
      if (item.expiry > now) {
        validCount++;
      } else {
        expiredCount++;
      }
    });
    
    return {
      total: Object.keys(this.cache).length,
      valid: validCount,
      expired: expiredCount,
      ttl: this.cacheTTL
    };
  }
}

// 创建单例实例
const qqAvatarHandler = new QQAvatarHandler();

// 导出实例和类
window.QQAvatarHandler = QQAvatarHandler;
window.qqAvatarHandler = qqAvatarHandler;

export default qqAvatarHandler;
export { QQAvatarHandler };