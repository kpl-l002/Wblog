// IP检测和管理页面提示脚本

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否已经显示过提示（使用localStorage避免重复提示）
  const hasShownPrompt = localStorage.getItem('adminPromptShown') === 'true';
  if (!hasShownPrompt) {
    // 调用IP检测函数
    checkUserIP();
  }
});

// 检测当前环境是否为Vercel
function isVercelEnvironment() {
  return typeof window !== 'undefined' && 
         (window.location.hostname.includes('vercel.app') || 
          window.location.hostname === 'wblog.vercel.app'); // 替换为你的Vercel自定义域名
}

// 调用IP检测API并处理结果
async function checkUserIP() {
  try {
    let data = null;
    
    // 检查是否在本地开发环境
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      // 本地开发环境：模拟管理员IP检测结果
      // 这样可以在本地测试弹窗功能
      data = {
        isAdminIp: true,
        detectedIp: '127.0.0.1',
        message: '本地开发环境 - 模拟管理员IP'
      };
      console.log('本地开发环境模式：模拟管理员IP检测');
    } else {
      // 生产环境：调用API检查IP（Vercel兼容）
      const isVercel = isVercelEnvironment();
      console.log(`环境检测: ${isVercel ? 'Vercel' : '其他平台'}`);
      
      const apiUrl = '/api/check-ip';
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'omit', // 对于公共API，不发送凭证
        cache: 'no-store' // 确保每次都获取最新结果
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      data = await response.json();
      console.log('IP检测结果:', data);
    }

    // 如果是管理员IP，显示提示弹窗
    if (data.isAdminIp) {
      showAdminPrompt();
    }
  } catch (error) {
    console.error('IP检测失败:', error);
    // 错误情况下不影响用户体验
  }
}

// 显示管理员页面提示弹窗
function showAdminPrompt() {
  // 创建弹窗元素
  const modal = document.createElement('div');
  modal.className = 'admin-prompt-modal';
  modal.innerHTML = `
    <div class="admin-prompt-content">
      <h3>管理员检测</h3>
      <p>检测到您可能是网站管理员，是否需要前往管理页面？</p>
      <div class="admin-prompt-buttons">
        <button id="go-to-admin" class="admin-prompt-btn primary telegram-button telegram-ripple">前往管理页面</button>
        <button id="close-prompt" class="admin-prompt-btn secondary telegram-button telegram-ripple">稍后再说</button>
      </div>
    </div>
  `;

  // 添加到页面
  document.body.appendChild(modal);

  // 添加样式
  addModalStyles();

  // 添加事件监听器
  document.getElementById('go-to-admin').addEventListener('click', () => {
    // 标记已显示提示
    localStorage.setItem('adminPromptShown', 'true');
    // 跳转到管理页面
    window.location.href = '/admin.html';
  });

  document.getElementById('close-prompt').addEventListener('click', () => {
    // 关闭弹窗但不标记已显示（下次访问仍会提示）
    document.body.removeChild(modal);
  });

  // 点击遮罩层关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// 添加弹窗样式
function addModalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .admin-prompt-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .admin-prompt-content {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    
    .admin-prompt-content h3 {
      margin-top: 0;
      color: #333;
    }
    
    .admin-prompt-content p {
      color: #666;
      margin-bottom: 25px;
    }
    
    .admin-prompt-buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
    }
    
    .admin-prompt-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    
    .admin-prompt-btn.primary {
      background-color: #007bff;
      color: white;
    }
    
    .admin-prompt-btn.primary:hover {
      background-color: #0056b3;
    }
    
    .admin-prompt-btn.secondary {
      background-color: #6c757d;
      color: white;
    }
    
    .admin-prompt-btn.secondary:hover {
      background-color: #545b62;
    }
  `;
  document.head.appendChild(style);
}
