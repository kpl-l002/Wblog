#!/usr/bin/env node

/**
 * Vercel自动化部署脚本
 * 实现完整的部署流程自动化，包括预构建检查、依赖安装优化、部署触发和状态监控
 */

import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import axios from 'axios';

// 日志工具函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  const prefixes = {
    info: 'ℹ️ ',
    success: '✅ ',
    warning: '⚠️ ',
    error: '❌ '
  };
  
  console.log(`${colors[type]}${prefixes[type]}${message}${colors.reset}`);
}

// 执行命令并返回输出
function runCommand(command, options = {}) {
  log(`执行命令: ${command}`, 'info');
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });
    return options.silent ? result.toString().trim() : true;
  } catch (error) {
    log(`命令执行失败: ${error.message}`, 'error');
    if (options.ignoreErrors) {
      return false;
    }
    throw error;
  }
}

// 异步执行命令
function runCommandAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    log(`异步执行命令: ${command}`, 'info');
    exec(command, {
      shell: true,
      ...options
    }, (error, stdout, stderr) => {
      if (error && !options.ignoreErrors) {
        log(`异步命令执行失败: ${error.message}`, 'error');
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// 检查Node.js版本
function checkNodeVersion() {
  log('检查Node.js版本...', 'info');
  const nodeVersion = runCommand('node -v', { silent: true });
  log(`当前Node.js版本: ${nodeVersion}`, 'info');
  
  const versionParts = nodeVersion.replace('v', '').split('.');
  const majorVersion = parseInt(versionParts[0]);
  
  if (majorVersion < 14) {
    log('警告: Node.js版本低于14，可能会导致兼容性问题', 'warning');
    log('建议升级到Node.js 16或更高版本', 'warning');
  }
}

// 检查npm版本
function checkNpmVersion() {
  log('检查npm版本...', 'info');
  const npmVersion = runCommand('npm -v', { silent: true });
  log(`当前npm版本: ${npmVersion}`, 'info');
}

// 检查git状态
function checkGitStatus() {
  log('检查Git状态...', 'info');
  try {
    const status = runCommand('git status --porcelain', { silent: true });
    if (status) {
      log('警告: 工作目录有未提交的更改', 'warning');
      log('建议在部署前提交或暂存所有更改', 'warning');
    } else {
      log('Git工作目录已清理', 'success');
    }
    
    const currentBranch = runCommand('git rev-parse --abbrev-ref HEAD', { silent: true });
    log(`当前分支: ${currentBranch}`, 'info');
    
    return {
      branch: currentBranch,
      hasChanges: !!status
    };
  } catch (error) {
    log('未检测到Git仓库，将继续执行部署', 'warning');
    return {
      branch: 'unknown',
      hasChanges: false
    };
  }
}

// 检查必要文件是否存在
function checkRequiredFiles() {
  log('检查必要文件...', 'info');
  
  const requiredFiles = [
    'package.json',
    'vercel.json',
    '.env.example',
    'README.md'
  ];
  
  let allFilesExist = true;
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`缺少必要文件: ${file}`, 'error');
      allFilesExist = false;
    } else {
      log(`找到文件: ${file}`, 'success');
    }
  }
  
  // 特别检查安全相关文件
  const securityFiles = [
    '.env'
  ];
  
  for (const file of securityFiles) {
    if (fs.existsSync(file)) {
      log(`发现安全配置文件: ${file}`, 'success');
      
      // 检查权限（仅在非Windows系统上）
      if (process.platform !== 'win32') {
        const stats = fs.statSync(file);
        if ((stats.mode & 0o777) !== 0o600) {
          log(`警告: ${file} 文件权限可能过于宽松，建议设置为 600`, 'warning');
        }
      }
    } else {
      log(`缺少安全配置文件: ${file} (这在部署时是正常的，但在本地开发时需要)`, 'info');
    }
  }
  
  return allFilesExist;
}

// 安装依赖
function installDependencies() {
  log('安装依赖...', 'info');
  
  try {
    // 检查是否存在package-lock.json
    const hasLockFile = fs.existsSync('package-lock.json');
    
    // 优化安装命令
    const installCommand = hasLockFile 
      ? 'npm ci --prefer-offline --no-audit' 
      : 'npm install --prefer-offline --no-audit';
    
    log(`使用命令: ${installCommand}`, 'info');
    runCommand(installCommand);
    log('依赖安装成功', 'success');
  } catch (error) {
    log('依赖安装失败，尝试重新安装...', 'warning');
    // 清除node_modules后重新安装
    try {
      runCommand('rm -rf node_modules', { ignoreErrors: true });
      runCommand('npm install --prefer-offline --no-audit');
      log('依赖重新安装成功', 'success');
    } catch (retryError) {
      log('依赖重新安装也失败，请检查网络连接或package.json配置', 'error');
      throw retryError;
    }
  }
}

// 运行验证脚本
function runValidations() {
  log('运行验证脚本...', 'info');
  runCommand('npm run validate-env');
  runCommand('npm run validate-config');
  log('验证通过', 'success');
}

// 运行安全环境变量检查
async function runSecurityCheck() {
  log('运行安全环境变量检查...', 'info');
  
  try {
    await runCommandAsync('npm run validate-secure-env');
    log('安全环境变量检查通过', 'success');
    return true;
  } catch (error) {
    log('安全环境变量检查失败', 'error');
    return false;
  }
}

// 构建项目
function buildProject() {
  log('构建项目...', 'info');
  runCommand('npm run build');
  log('项目构建成功', 'success');
}

// 创建构建信息文件
function createBuildInfo() {
  log('创建构建信息...', 'info');
  
  const buildInfo = {
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: runCommand('node -v', { silent: true })
  };
  
  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outDir, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );
  
  log('构建信息创建成功', 'info');
}

// 获取Vercel项目信息
async function getVercelProjectInfo() {
  log('获取Vercel项目信息...', 'info');
  
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_TOKEN;
  
  if (!projectId || !token) {
    log('未设置Vercel项目ID或Token，跳过项目信息获取', 'warning');
    return null;
  }
  
  try {
    const response = await axios.get(`https://api.vercel.com/v8/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    log(`项目名称: ${response.data.name}`, 'info');
    log(`项目URL: ${response.data.url}`, 'info');
    
    return response.data;
  } catch (error) {
    log(`获取项目信息失败: ${error.message}`, 'warning');
    return null;
  }
}

// 触发Vercel部署
async function triggerVercelDeployment(environment) {
  log(`触发${environment}环境部署...`, 'info');
  
  let deployCommand = 'vercel';
  
  switch (environment) {
    case 'production':
      deployCommand = 'vercel --prod';
      break;
    case 'staging':
      deployCommand = 'vercel --build-env NODE_ENV=staging';
      break;
    default:
      deployCommand = 'vercel --build-env NODE_ENV=preview';
  }
  
  try {
    // 确保vercel已登录
    try {
      runCommand('vercel whoami', { silent: true });
    } catch (error) {
      log('需要登录Vercel，请运行: vercel login', 'error');
      throw new Error('请先登录Vercel账户');
    }
    
    log(`执行部署命令: ${deployCommand}`, 'info');
    const deploymentResult = runCommand(deployCommand, { silent: false });
    
    // 提取部署URL
    const urlMatch = deploymentResult?.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : null;
    
    if (deploymentUrl) {
      log(`部署成功! 访问地址: ${deploymentUrl}`, 'success');
    } else {
      log('部署完成', 'success');
    }
    
    return {
      success: true,
      url: deploymentUrl
    };
  } catch (error) {
    log(`部署失败: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message
    };
  }
}

// 发送部署通知
async function sendDeploymentNotification(deploymentInfo) {
  log('发送部署通知...', 'info');
  
  const { success, url, environment } = deploymentInfo;
  
  // 从环境变量获取通知配置
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const notificationWebhook = process.env.DEPLOYMENT_NOTIFICATION_WEBHOOK;
  
  // 发送Telegram通知
  if (telegramBotToken && telegramChatId) {
    try {
      const statusText = success ? '✅ 部署成功' : '❌ 部署失败';
      const message = `${statusText}\n环境: ${environment}\n${url ? `访问地址: ${url}` : 'URL不可用'}\n时间: ${new Date().toLocaleString()}`;
      
      await axios.post(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        { chat_id: telegramChatId, text: message, parse_mode: 'Markdown' }
      );
      
      log('Telegram通知发送成功', 'success');
    } catch (error) {
      log(`Telegram通知发送失败: ${error.message}`, 'warning');
    }
  }
  
  // 发送Webhook通知
  if (notificationWebhook) {
    try {
      await axios.post(notificationWebhook, deploymentInfo);
      log('Webhook通知发送成功', 'success');
    } catch (error) {
      log(`Webhook通知发送失败: ${error.message}`, 'warning');
    }
  }
}

// 验证部署状态
async function verifyDeployment(url, timeout = 30000) {
  if (!url) {
    log('没有部署URL，跳过验证', 'warning');
    return { success: false, message: '无URL' };
  }
  
  log(`验证部署状态: ${url}`, 'info');
  
  try {
    // 等待部署完成
    log('等待部署完成...', 'info');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const response = await axios.get(url, {
      timeout: timeout,
      headers: { 'Accept': 'text/html' }
    });
    
    if (response.status >= 200 && response.status < 300) {
      log('部署验证通过', 'success');
      return { success: true, status: response.status };
    } else {
      log(`部署验证失败，HTTP状态码: ${response.status}`, 'error');
      return { success: false, status: response.status };
    }
  } catch (error) {
    log(`部署验证失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// 获取构建缓存状态
function getCacheStatus() {
  log('检查缓存状态...', 'info');
  
  // 检查node_modules缓存
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);
  
  log(`Node Modules缓存: ${hasNodeModules ? '存在' : '不存在'}`, 'info');
  
  return {
    nodeModules: hasNodeModules
  };
}

// 主函数
async function main() {
  log('======================================', 'info');
  log('Vercel自动化部署脚本', 'info');
  log('======================================', 'info');
  
  // 获取部署环境参数
  const args = process.argv.slice(2);
  const environment = args[0] || 'preview'; // 默认预览环境
  
  log(`部署环境: ${environment}`, 'info');
  
  try {
    // 1. 环境检查
    checkNodeVersion();
    checkNpmVersion();
    const gitInfo = checkGitStatus();
    
    // 2. 检查必要文件
    if (!checkRequiredFiles()) {
      log('必要文件检查失败，停止部署', 'error');
      return 1;
    }
    
    // 3. 安全检查
    if (!(await runSecurityCheck())) {
      log('安全检查失败，停止部署', 'error');
      return 1;
    }
    
    // 4. 获取缓存状态
    const cacheStatus = getCacheStatus();
    
    // 3. 安装依赖（如果没有缓存或强制更新）
    if (!cacheStatus.nodeModules || args.includes('--force')) {
      installDependencies();
    } else {
      log('使用缓存的依赖', 'info');
    }
    
    // 4. 运行验证
    runValidations();
    
    // 5. 构建项目
    buildProject();
    
    // 6. 创建构建信息
    createBuildInfo();
    
    // 7. 获取Vercel项目信息
    const projectInfo = await getVercelProjectInfo();
    
    // 8. 触发部署
    const deploymentResult = await triggerVercelDeployment(environment);
    
    // 9. 验证部署（如果部署成功）
    let verificationResult = { success: false };
    if (deploymentResult.success) {
      verificationResult = await verifyDeployment(deploymentResult.url);
    }
    
    // 10. 发送通知
    await sendDeploymentNotification({
      success: deploymentResult.success && verificationResult.success,
      url: deploymentResult.url,
      environment: environment,
      branch: gitInfo.branch,
      timestamp: new Date().toISOString()
    });
    
    log('======================================', 'info');
    if (deploymentResult.success && verificationResult.success) {
      log('🎉 部署流程完全成功！', 'success');
      log(`🚀 访问地址: ${deploymentResult.url}`, 'success');
      return 0;
    } else if (deploymentResult.success) {
      log('⚠️  部署触发成功，但验证失败，请手动检查', 'warning');
      log(`🚀 访问地址: ${deploymentResult.url}`, 'info');
      return 1;
    } else {
      log('❌ 部署流程失败', 'error');
      return 2;
    }
  } catch (error) {
    log(`部署过程中发生错误: ${error.message}`, 'error');
    console.error(error.stack);
    return 3;
  }
}

// 执行主函数
main().then(exitCode => {
  process.exit(exitCode);
});