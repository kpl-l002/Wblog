const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 日志函数
function log(message, level = 'info') {
  if (process.env.NODE_ENV !== 'production' || level === 'error') {
    console[level === 'error' ? 'error' : 'log'](`[API Deploy Status] ${message}`);
  }
}

// 缓存管理
const cache = {
  data: null,
  timestamp: null,
  ttl: 60 * 1000 // 1分钟缓存
};

// 检查缓存是否有效
function isCacheValid() {
  return cache.data && cache.timestamp && 
         (Date.now() - cache.timestamp) < cache.ttl;
}

// 本地部署记录存储（用于离线环境）
const getLocalDeploymentsPath = () => {
  return path.join(process.cwd(), '.vercel', 'local-deployments.json');
};

// 读取本地部署记录
function readLocalDeployments() {
  try {
    const deploymentsPath = getLocalDeploymentsPath();
    if (fs.existsSync(deploymentsPath)) {
      const data = fs.readFileSync(deploymentsPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    log(`读取本地部署记录失败: ${error.message}`, 'error');
    return [];
  }
}

// 保存本地部署记录
function saveLocalDeployment(deployment) {
  try {
    const deploymentsPath = getLocalDeploymentsPath();
    const dirPath = path.dirname(deploymentsPath);
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const deployments = readLocalDeployments();
    deployments.unshift(deployment);
    
    // 保留最近20条记录
    if (deployments.length > 20) {
      deployments.splice(20);
    }
    
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  } catch (error) {
    log(`保存本地部署记录失败: ${error.message}`, 'error');
  }
}

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    log(`不允许的方法: ${req.method}`, 'error');
    return res.status(405).json({ 
      success: false, 
      error: { 
        code: 405, 
        message: 'Method not allowed' 
      } 
    });
  }
  
  // 检查缓存
  if (isCacheValid() && process.env.NODE_ENV === 'production') {
    log('使用缓存的部署状态数据', 'info');
    return res.status(200).json(cache.data);
  }

  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const forceRefresh = req.query.refresh === 'true';
    
    log(`获取部署状态，刷新模式: ${forceRefresh}`, 'info');
    
    // 检查必要的环境变量
    if (!vercelToken || !projectId) {
      log('缺少必要的Vercel环境变量', 'error');
      return res.status(500).json({ 
        success: false, 
        error: { 
          code: 500, 
          message: 'Vercel配置不完整，请检查环境变量',
          missing: {
            vercelToken: !vercelToken,
            projectId: !projectId
          }
        } 
      });
    }

    // 获取部署列表，支持自定义限制
    const limit = parseInt(req.query.limit) || 10;
    const deploymentsResponse = await axios.get(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      }
    );

    const deployments = deploymentsResponse.data.deployments || [];
    log(`成功获取 ${deployments.length} 个部署记录`, 'info');
    
    // 异步获取团队信息，不阻塞主流程
    let team = null;
    try {
      const teamResponse = await axios.get(
        'https://api.vercel.com/v2/teams',
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`
          },
          timeout: 5000 // 5秒超时
        }
      );
      team = teamResponse.data.teams?.[0];
      log('成功获取团队信息', 'info');
    } catch (teamError) {
      log(`获取团队信息失败: ${teamError.message}`, 'warn');
      // 团队信息不是必需的，继续处理
    }

    // 处理部署数据
    const processedDeployments = deployments.map(deployment => {
      const processed = {
        id: deployment.uid,
        url: deployment.url,
        state: deployment.state,
        target: deployment.target,
        createdAt: deployment.createdAt,
        buildingAt: deployment.buildingAt,
        ready: deployment.ready,
        completedAt: deployment.completedAt || null,
        errorCode: deployment.errorCode || null,
        errorMessage: deployment.errorMessage || null,
        commit: {
          message: deployment.meta?.gitCommitMessage || '手动部署',
          sha: deployment.meta?.gitCommitSha || 'N/A',
          author: deployment.meta?.gitCommitAuthorName || '未知作者',
          branch: deployment.meta?.gitCommitRef || 'unknown'
        },
        creator: {
          username: deployment.creator?.username || '未知用户',
          email: deployment.creator?.email || '未知邮箱'
        },
        regions: deployment.regions || [],
        instanceCount: deployment.instanceCount || 1
      };
      
      // 记录本地部署信息（用于离线环境）
      if (deployment.state === 'READY') {
        saveLocalDeployment({
          id: deployment.uid,
          url: deployment.url,
          state: deployment.state,
          target: deployment.target,
          createdAt: deployment.createdAt,
          commit: {
            message: deployment.meta?.gitCommitMessage || '手动部署',
            sha: deployment.meta?.gitCommitSha || 'N/A'
          }
        });
      }
      
      return processed;
    });

    // 分类部署
    const status = {
      production: processedDeployments.find(d => d.target === 'production' && d.state === 'READY'),
      preview: processedDeployments.filter(d => d.target === 'preview' && d.state === 'READY'),
      staging: processedDeployments.find(d => d.target === 'staging' && d.state === 'READY'),
      building: processedDeployments.filter(d => d.state === 'BUILDING' || d.state === 'INITIALIZING'),
      error: processedDeployments.filter(d => d.state === 'ERROR' || d.state === 'CANCELED'),
      canceled: processedDeployments.filter(d => d.state === 'CANCELED'),
      latest: processedDeployments[0],
      total: processedDeployments.length,
      // 当前部署信息
      current: {
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
        environment: process.env.NODE_ENV || 'development',
        region: process.env.VERCEL_REGION || 'unknown'
      }
    };

    // 计算部署统计
    const successful = processedDeployments.filter(d => d.state === 'READY').length;
    const failed = processedDeployments.filter(d => d.state === 'ERROR').length;
    const canceled = processedDeployments.filter(d => d.state === 'CANCELED').length;
    const total = processedDeployments.length;
    
    const stats = {
      successful,
      failed,
      canceled,
      building: status.building.length,
      ready: processedDeployments.filter(d => d.state === 'READY').length,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      environments: {
        production: processedDeployments.filter(d => d.target === 'production').length,
        staging: processedDeployments.filter(d => d.target === 'staging').length,
        preview: processedDeployments.filter(d => d.target === 'preview').length
      },
      // 计算平均部署时间
      averageDeploymentTime: calculateAverageDeploymentTime(processedDeployments)
    };

    // 检查API访问统计
    const apiStats = {
      requestCount: parseInt(process.env.DEPLOY_STATUS_API_COUNT || 0) + 1,
      lastRequest: new Date().toISOString()
    };
    
    // 构建响应数据
    const response = {
      success: true,
      data: {
        deployments: processedDeployments,
        status,
        stats,
        project: {
          id: projectId,
          name: process.env.SITE_NAME || '个人博客',
          team: team ? {
            id: team.id,
            name: team.name,
            slug: team.slug
          } : null,
          // Vercel项目配置信息
          config: {
            framework: process.env.VERCEL_FRAMEWORK || 'unknown',
            outputDirectory: process.env.VERCEL_OUTPUT_DIR || 'out',
            buildCommand: process.env.VERCEL_BUILD_COMMAND || 'npm run build'
          }
        },
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        api: apiStats,
        // 缓存信息
        cache: {
          enabled: process.env.NODE_ENV === 'production',
          ttl: cache.ttl
        }
      }
    };
    
    // 更新缓存
    if (process.env.NODE_ENV === 'production' && !forceRefresh) {
      cache.data = response;
      cache.timestamp = Date.now();
    }

    log('部署状态API调用成功', 'info');
    res.status(200).json(response);

  } catch (error) {
    // 分类错误类型
    let errorType = 'unknown';
    let errorCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorType = 'timeout';
      errorCode = 408;
      log(`Vercel API请求超时: ${error.message}`, 'error');
    } else if (error.response) {
      errorType = 'api_error';
      errorCode = error.response.status || 500;
      log(`Vercel API错误 (${errorCode}): ${error.response.data?.error?.message || error.message}`, 'error');
    } else {
      log(`部署状态检查错误: ${error.message}`, 'error');
    }
    
    // 尝试使用本地部署记录作为备份
    const localDeployments = readLocalDeployments();
    const fallbackResponse = localDeployments.length > 0 ? {
      success: true,
      data: {
        deployments: localDeployments.slice(0, 5),
        status: {
          production: localDeployments.find(d => d.target === 'production' && d.state === 'READY') || null,
          latest: localDeployments[0] || null,
          total: localDeployments.length,
          current: {
            deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
            environment: process.env.NODE_ENV || 'development'
          }
        },
        warning: '使用本地缓存的部署记录，可能不是最新的',
        timestamp: new Date().toISOString()
      }
    } : null;
    
    // 返回错误响应或降级响应
    if (fallbackResponse && process.env.NODE_ENV === 'production') {
      log('使用本地缓存的部署记录作为降级响应', 'warn');
      return res.status(200).json(fallbackResponse);
    }
    
    return res.status(errorCode).json({
      success: false,
      error: {
        code: errorCode,
        type: errorType,
        message: errorType === 'timeout' ? 'Vercel API请求超时' : '无法获取部署状态',
        details: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// 计算平均部署时间（秒）
function calculateAverageDeploymentTime(deployments) {
  const completedDeployments = deployments.filter(d => 
    d.state === 'READY' && d.createdAt && d.completedAt
  );
  
  if (completedDeployments.length === 0) return 0;
  
  const totalTime = completedDeployments.reduce((sum, deployment) => {
    const startTime = new Date(deployment.createdAt).getTime();
    const endTime = new Date(deployment.completedAt).getTime();
    return sum + (endTime - startTime);
  }, 0);
  
  return Math.round(totalTime / completedDeployments.length / 1000);
}

// 导出缓存清理函数（用于测试）
module.exports.clearCache = () => {
  cache.data = null;
  cache.timestamp = null;
};

// 配置信息
module.exports.config = {
  runtime: 'nodejs18.x',
  regions: ['iad1', 'sfo1', 'bru1', 'sin1']
};