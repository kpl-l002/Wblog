#!/usr/bin/env node

/**
 * 功能验证脚本
 * 用于验证项目的功能完整性和兼容性
 * 包括API端点检查、构建验证、环境变量检查等
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// 日志工具
class Logger {
  constructor() {
    this.successCount = 0;
    this.failedCount = 0;
    this.warningCount = 0;
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '\x1b[36m',  // 青色
      success: '\x1b[32m', // 绿色
      warning: '\x1b[33m', // 黄色
      error: '\x1b[31m'    // 红色
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[type]}[${type.toUpperCase()}]${reset}`;
    console.log(`${prefix} ${timestamp} - ${message}`);
  }

  success(message) {
    this.log(message, 'success');
    this.successCount++;
  }

  warning(message) {
    this.log(message, 'warning');
    this.warningCount++;
  }

  error(message) {
    this.log(message, 'error');
    this.failedCount++;
  }

  info(message) {
    this.log(message, 'info');
  }

  summary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    console.log('\n========================================');
    console.log('验证完成');
    console.log(`总耗时: ${duration} 秒`);
    console.log(`成功: ${this.successCount}, 警告: ${this.warningCount}, 失败: ${this.failedCount}`);
    console.log('========================================');
    return {
      success: this.failedCount === 0,
      summary: {
        success: this.successCount,
        warning: this.warningCount,
        failed: this.failedCount,
        duration
      }
    };
  }
}

const logger = new Logger();

// 验证工具类
class FeatureValidator {
  constructor() {
    this.baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
    this.apiEndpoints = [
      { path: '/api/health', required: true },
      { path: '/api/deploy-status', required: true }
    ];
    this.requiredFiles = [
      'package.json',
      'vercel.json',
      '.env.example',
      'build.js',
      'api/health.js',
      'api/deploy-status.js'
    ];
    this.requiredScripts = [
      'build',
      'dev',
      'deploy',
      'validate-env',
      'prebuild'
    ];
  }

  // 检查项目文件是否存在
  async validateProjectFiles() {
    logger.info('开始验证项目文件结构...');
    
    for (const filePath of this.requiredFiles) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
          logger.success(`文件存在: ${filePath}`);
        } else {
          logger.error(`文件不存在: ${filePath}`);
        }
      } catch (error) {
        logger.error(`检查文件 ${filePath} 时出错: ${error.message}`);
      }
    }
  }

  // 验证package.json中的脚本命令
  async validatePackageScripts() {
    logger.info('开始验证package.json脚本命令...');
    
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        logger.error('package.json文件不存在');
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};

      for (const scriptName of this.requiredScripts) {
        if (scripts[scriptName]) {
          logger.success(`脚本命令存在: ${scriptName}`);
        } else {
          logger.warning(`脚本命令不存在: ${scriptName}`);
        }
      }
    } catch (error) {
      logger.error(`验证package.json脚本时出错: ${error.message}`);
    }
  }

  // 验证API端点
  async validateApiEndpoints() {
    logger.info(`开始验证API端点 (基础URL: ${this.baseUrl})...`);
    
    // 如果是本地环境，检查是否在dev模式
    if (this.baseUrl.includes('localhost')) {
      try {
        // 尝试ping本地服务
        await axios.get(`${this.baseUrl}/api/health`, { timeout: 3000 });
      } catch (error) {
        logger.warning('本地服务似乎未运行。请确保使用 npm run dev 启动服务后再运行验证');
        return;
      }
    }

    for (const endpoint of this.apiEndpoints) {
      try {
        logger.info(`正在测试API: ${endpoint.path}`);
        const response = await axios.get(`${this.baseUrl}${endpoint.path}`, { 
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.status >= 200 && response.status < 300) {
          const isJson = this.isValidJson(response.data);
          if (isJson) {
            logger.success(`API端点响应正常: ${endpoint.path} (状态码: ${response.status})`);
          } else {
            logger.error(`API端点返回非JSON数据: ${endpoint.path}`);
          }
        } else {
          logger.error(`API端点响应异常: ${endpoint.path} (状态码: ${response.status})`);
        }
      } catch (error) {
        if (endpoint.required) {
          logger.error(`API端点不可访问: ${endpoint.path} - ${error.message}`);
        } else {
          logger.warning(`API端点不可访问: ${endpoint.path} - ${error.message}`);
        }
      }
    }
  }

  // 验证构建脚本
  async validateBuildScript() {
    logger.info('开始验证构建脚本...');
    
    try {
      // 先验证构建脚本是否可执行
      const buildScriptPath = path.join(process.cwd(), 'build.js');
      if (!fs.existsSync(buildScriptPath)) {
        logger.error('构建脚本不存在: build.js');
        return;
      }

      // 尝试运行预构建验证
      logger.info('运行预构建验证...');
      try {
        execSync('npm run prebuild', { stdio: 'inherit' });
        logger.success('预构建验证通过');
      } catch (error) {
        logger.error('预构建验证失败');
      }

      // 检查是否可以运行构建（不实际执行完整构建）
      logger.info('验证构建命令...');
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const buildCommand = packageJson.scripts?.build;
      
      if (buildCommand) {
        logger.success(`构建命令已配置: ${buildCommand}`);
      } else {
        logger.error('未找到构建命令');
      }
    } catch (error) {
      logger.error(`验证构建脚本时出错: ${error.message}`);
    }
  }

  // 验证环境变量配置
  async validateEnvironmentVariables() {
    logger.info('开始验证环境变量配置...');
    
    try {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      if (!fs.existsSync(envExamplePath)) {
        logger.error('.env.example 文件不存在');
        return;
      }

      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      const requiredEnvVars = [
        'NODE_ENV',
        'SITE_URL',
        'VERCEL_PROJECT_ID'
      ];

      let allFound = true;
      for (const varName of requiredEnvVars) {
        if (envExample.includes(varName)) {
          logger.success(`环境变量模板中包含: ${varName}`);
        } else {
          logger.error(`环境变量模板中缺少: ${varName}`);
          allFound = false;
        }
      }

      // 检查实际环境变量（开发环境）
      if (process.env.NODE_ENV !== 'production') {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          logger.success('.env 文件存在');
          
          // 尝试运行环境变量验证脚本
          try {
            logger.info('运行环境变量验证脚本...');
            execSync('npm run validate-env', { stdio: 'inherit' });
            logger.success('环境变量验证通过');
          } catch (error) {
            logger.warning('环境变量验证失败，请检查.env文件配置');
          }
        } else {
          logger.warning('.env 文件不存在，请根据.env.example创建');
        }
      }
    } catch (error) {
      logger.error(`验证环境变量时出错: ${error.message}`);
    }
  }

  // 验证Vercel配置
  async validateVercelConfig() {
    logger.info('开始验证Vercel配置...');
    
    try {
      const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
      if (!fs.existsSync(vercelJsonPath)) {
        logger.error('vercel.json 文件不存在');
        return;
      }

      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      
      // 检查关键配置项
      const requiredConfigs = [
        { key: 'version', message: '缺少版本配置' },
        { key: 'routes', message: '缺少路由配置' },
        { key: 'builds', message: '缺少构建配置' },
        { key: 'functions', message: '缺少函数配置' },
        { key: 'cleanUrls', message: '缺少URL清理配置' }
      ];

      for (const { key, message } of requiredConfigs) {
        if (vercelConfig.hasOwnProperty(key)) {
          logger.success(`Vercel配置包含: ${key}`);
        } else {
          logger.warning(`Vercel配置中${message}`);
        }
      }

      // 验证API目录配置
      const apiDirectoryConfig = vercelConfig.routes?.find(route => 
        route.src?.includes('/api/')
      );
      
      if (apiDirectoryConfig) {
        logger.success('API目录配置正确');
      } else {
        logger.warning('未找到API目录路由配置');
      }
    } catch (error) {
      logger.error(`验证Vercel配置时出错: ${error.message}`);
    }
  }

  // 验证部署脚本
  async validateDeploymentScript() {
    logger.info('开始验证部署脚本...');
    
    try {
      const deployScriptPath = path.join(process.cwd(), 'scripts', 'deploy.js');
      if (fs.existsSync(deployScriptPath)) {
        logger.success('部署脚本存在: scripts/deploy.js');
        
        // 检查部署相关脚本命令
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deployScripts = [
          'deploy',
          'deploy:preview',
          'deploy:staging',
          'deploy:production'
        ];

        for (const scriptName of deployScripts) {
          if (packageJson.scripts?.[scriptName]) {
            logger.success(`部署脚本命令存在: ${scriptName}`);
          }
        }
      } else {
        logger.warning('部署脚本不存在: scripts/deploy.js');
      }
    } catch (error) {
      logger.error(`验证部署脚本时出错: ${error.message}`);
    }
  }

  // 执行浏览器兼容性检查
  async validateBrowserCompatibility() {
    logger.info('开始验证浏览器兼容性配置...');
    
    try {
      // 检查index.html中的meta标签
      const indexHtmlPath = path.join(process.cwd(), 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        
        // 检查viewport配置
        if (indexHtml.includes('<meta name="viewport"')) {
          logger.success('发现viewport配置');
        } else {
          logger.warning('缺少viewport配置');
        }
        
        // 检查charset配置
        if (indexHtml.includes('<meta charset="utf-8"')) {
          logger.success('发现charset配置');
        } else {
          logger.warning('缺少charset配置');
        }
      } else {
        logger.warning('index.html 文件不存在');
      }
    } catch (error) {
      logger.error(`验证浏览器兼容性时出错: ${error.message}`);
    }
  }

  // 辅助函数：检查是否为有效JSON
  isValidJson(data) {
    try {
      return typeof data === 'object' && data !== null;
    } catch (error) {
      return false;
    }
  }

  // 运行所有验证
  async runAllValidations() {
    logger.info('开始执行功能完整性和兼容性验证...');
    
    await this.validateProjectFiles();
    await this.validatePackageScripts();
    await this.validateEnvironmentVariables();
    await this.validateVercelConfig();
    await this.validateBuildScript();
    await this.validateDeploymentScript();
    await this.validateApiEndpoints();
    await this.validateBrowserCompatibility();
    
    return logger.summary();
  }
}

// 运行验证
async function runValidation() {
  try {
    const validator = new FeatureValidator();
    const result = await validator.runAllValidations();
    
    // 根据验证结果设置退出码
    if (result.success) {
      logger.success('所有验证通过！项目功能完整性和兼容性检查完成。');
      process.exit(0);
    } else {
      logger.error('验证未全部通过，请修复问题后重新运行验证。');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`验证过程中发生错误: ${error.message}`);
    process.exit(1);
  }
}

// 主程序
try {
  // 检查是否安装了必要的依赖
  try {
    require('axios');
  } catch (error) {
    logger.warning('缺少依赖包axios，正在尝试安装...');
    execSync('npm install axios --no-save', { stdio: 'inherit' });
    logger.success('axios已安装');
  }

  // 运行验证
  runValidation();
} catch (error) {
  console.error('启动验证脚本失败:', error.message);
  process.exit(1);
}