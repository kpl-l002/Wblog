// Vercel Serverless Function - 健康检查API端点

/**
 * 健康检查API
 * 用于监控应用健康状态、性能指标和部署信息
 * 支持部署后自动验证和持续监控
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 日志函数
function log(message, level = 'info') {
  if (process.env.NODE_ENV !== 'production' || level === 'error') {
    console[level === 'error' ? 'error' : 'log'](`[API Health] ${message}`);
  }
}

// 获取构建信息
function getBuildInfo() {
  try {
    const buildInfoPath = path.join(process.cwd(), 'out', 'build-info.json');
    if (fs.existsSync(buildInfoPath)) {
      const buildInfo = fs.readFileSync(buildInfoPath, 'utf8');
      return JSON.parse(buildInfo);
    }
    log('构建信息文件不存在', 'info');
    return null;
  } catch (error) {
    log(`获取构建信息失败: ${error.message}`, 'error');
    return null;
  }
}

// 获取部署信息
function getDeploymentInfo() {
  return {
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'local',
    projectId: process.env.VERCEL_PROJECT_ID || 'unknown',
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown'
  };
}

// 生成健康分数
function calculateHealthScore(healthChecks) {
  let totalScore = 100;
  let checkCount = healthChecks.length;
  
  if (checkCount === 0) return 100;
  
  // 计算健康检查的分数影响
  healthChecks.forEach(check => {
    if (check.status === 'unhealthy') {
      totalScore -= 20;
    } else if (check.status === 'degraded') {
      totalScore -= 10;
    }
  });
  
  // 特殊检查权重
  const envCheck = healthChecks.find(c => c.name === '环境变量');
  if (envCheck && envCheck.status === 'unhealthy') {
    totalScore -= 30;
  }
  
  // 静态资源检查权重
  const staticChecks = healthChecks.filter(c => c.name.includes('静态资源'));
  if (staticChecks.length > 0) {
    const failedStatic = staticChecks.filter(c => c.status === 'unhealthy').length;
    if (failedStatic > 0) {
      totalScore -= failedStatic * 5;
    }
  }
  
  return Math.max(0, Math.round(totalScore));
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const healthChecks = [];
  const startTime = Date.now();

  try {
    // 1. 检查基础服务状态
    healthChecks.push({
      name: '基础服务',
      status: 'healthy',
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    });

    // 2. 检查环境变量
    const requiredEnvVars = ['NODE_ENV', 'SITE_NAME', 'SITE_URL'];
    const recommendedEnvVars = ['JWT_SECRET', 'SESSION_SECRET', 'HEALTH_CHECK_ENDPOINT'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    const missingRecommended = recommendedEnvVars.filter(varName => !process.env[varName]);
    
    let envStatus = 'healthy';
    if (missingEnvVars.length > 0) {
      envStatus = 'unhealthy';
    } else if (missingRecommended.length > 0) {
      envStatus = 'degraded';
    }
    
    healthChecks.push({
      name: '环境变量',
      status: envStatus,
      details: {
        missing: missingEnvVars,
        missingRecommended: missingRecommended,
        totalRequired: requiredEnvVars.length,
        totalRecommended: recommendedEnvVars.length,
        present: requiredEnvVars.length - missingEnvVars.length
      }
    });

    // 3. 检查API端点
    const apiEndpoints = [
      { name: '评论API', path: '/api/comments', method: 'GET' },
      { name: 'IP检查API', path: '/api/check-ip', method: 'GET' },
      { name: '部署状态API', path: '/api/deploy-status', method: 'GET' }
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const checkStartTime = Date.now();
        const response = await axios.get(`https://${req.headers.host}${endpoint.path}`, {
          timeout: 5000,
          validateStatus: () => true // 接受所有状态码
        });
        const responseTime = Date.now() - checkStartTime;
        
        let status = 'healthy';
        if (response.status >= 500) status = 'unhealthy';
        else if (response.status >= 400) status = 'degraded';
        else if (responseTime > 1000) status = 'degraded';
        
        healthChecks.push({
          name: endpoint.name,
          status: status,
          details: {
            statusCode: response.status,
            responseTime: responseTime,
            url: endpoint.path
          }
        });
      } catch (error) {
        healthChecks.push({
          name: endpoint.name,
          status: 'unhealthy',
          details: {
            error: error.message,
            url: endpoint.path
          }
        });
      }
    }

    // 4. 检查静态资源
    const staticResources = [
      '/css/style.css',
      '/js/main.js',
      '/index.html'
    ];

    for (const resource of staticResources) {
      try {
        const checkStartTime = Date.now();
        const response = await axios.get(`https://${req.headers.host}${resource}`, {
          timeout: 5000,
          validateStatus: () => true
        });
        const responseTime = Date.now() - checkStartTime;
        
        let status = response.status === 200 ? 'healthy' : 'unhealthy';
        if (status === 'healthy' && responseTime > 500) status = 'degraded';
        
        healthChecks.push({
          name: `静态资源: ${resource}`,
          status: status,
          details: {
            statusCode: response.status,
            responseTime: responseTime,
            url: resource
          }
        });
      } catch (error) {
        healthChecks.push({
          name: `静态资源: ${resource}`,
          status: 'unhealthy',
          details: {
            error: error.message,
            url: resource
          }
        });
      }
    }

    // 5. 获取构建信息
    const buildInfo = getBuildInfo();
    healthChecks.push({
      name: '构建信息',
      status: buildInfo ? 'healthy' : 'degraded',
      details: buildInfo || { error: 'Build info not available' }
    });

    // 6. 获取部署信息
    const deploymentInfo = getDeploymentInfo();
    healthChecks.push({
      name: '部署信息',
      status: 'healthy',
      details: deploymentInfo
    });

    // 计算健康分数
    const healthScore = calculateHealthScore(healthChecks);
    
    // 确定整体状态
    let overallStatus = 'healthy';
    if (healthScore < 70) overallStatus = 'degraded';
    if (healthScore < 30) overallStatus = 'unhealthy';

    // 准备响应数据
    const responseData = {
      status: overallStatus,
      healthScore: healthScore,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      checks: healthChecks,
      summary: {
        totalChecks: healthChecks.length,
        healthyChecks: healthChecks.filter(c => c.status === 'healthy').length,
        degradedChecks: healthChecks.filter(c => c.status === 'degraded').length,
        unhealthyChecks: healthChecks.filter(c => c.status === 'unhealthy').length
      }
    };

    log(`健康检查完成: 状态=${overallStatus}, 分数=${healthScore}`, 'info');

    // 根据健康状态返回不同的HTTP状态码
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return res.status(statusCode).json(responseData);
  }
  catch (error) {
    log(`健康检查处理错误: ${error.message}`, 'error');
    
    return res.status(500).json({
      status: 'error',
      healthScore: 0,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error.message || 'Unknown error',
      checks: healthChecks
    });
  }
            contentLength: response.headers['content-length'] || 'N/A'
          }
        });
      } catch (error) {
        healthChecks.push({
          name: `静态资源: ${resource}`,
          status: 'unhealthy',
          details: {
            error: error.message
          }
        });
      }
    }

    // 5. 检查部署信息
    const deploymentInfo = {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'N/A',
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'N/A',
      gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'N/A',
      environment: process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown'
    };

    healthChecks.push({
      name: '部署信息',
      status: 'healthy',
      details: deploymentInfo
    });

    // 计算总体健康状态
    const unhealthyChecks = healthChecks.filter(check => check.status === 'unhealthy');
    const overallStatus = unhealthyChecks.length === 0 ? 'healthy' : 'unhealthy';
    
    const responseTime = Date.now() - startTime;

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: healthChecks,
      summary: {
        total: healthChecks.length,
        healthy: healthChecks.filter(c => c.status === 'healthy').length,
        unhealthy: unhealthyChecks.length,
        successRate: Math.round(((healthChecks.length - unhealthyChecks.length) / healthChecks.length) * 100)
      },
      deployment: deploymentInfo
    };

    // 根据健康状态设置HTTP状态码
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;
    
    res.status(httpStatus).json(response);

    // 如果健康检查失败，记录警告（可用于触发回滚）
    if (overallStatus === 'unhealthy') {
      console.warn('健康检查失败:', {
        unhealthyChecks: unhealthyChecks.map(c => c.name),
        deployment: deploymentInfo
      });
    }

  } catch (error) {
    console.error('健康检查执行错误:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: '健康检查执行失败',
        details: process.env.NODE_ENV === 'development' ? error.message : '内部错误'
      }
    });
  }
};