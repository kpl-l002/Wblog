#!/usr/bin/env node

/**
 * 环境变量验证工具
 * 用于验证项目所需的环境变量是否正确配置
 * 支持本地开发和Vercel部署环境
 */

import fs from 'fs';
import path from 'path';

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

// 环境变量配置
const ENV_CONFIG = {
  // 必需的环境变量
  required: [
    'NODE_ENV',
    'SITE_NAME',
    'SITE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'VERCEL_PROJECT_ID',
    'VERCEL_TOKEN'
  ],
  
  // 推荐的环境变量
  recommended: [
    'APP_VERSION',
    'ADMIN_EMAIL',
    'CONTACT_EMAIL',
    'LOG_LEVEL',
    'HEALTH_CHECK_ENDPOINT',
    'CACHE_TTL'
  ],
  
  // 特定环境的必需变量
  byEnvironment: {
    production: [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID'
    ],
    development: [
      'DEBUG_ENABLED'
    ]
  },
  
  // 验证规则
  rules: {
    NODE_ENV: (value) => ['development', 'test', 'production'].includes(value),
    JWT_SECRET: (value) => value && value.length >= 32,
    SESSION_SECRET: (value) => value && value.length >= 16,
    SITE_URL: (value) => value && /^https?:\/\/.+/.test(value),
    ADMIN_EMAIL: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    CONTACT_EMAIL: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    LOG_LEVEL: (value) => !value || ['debug', 'info', 'warn', 'error'].includes(value),
    VERCEL_PROJECT_ID: (value) => value && value.startsWith('prj_'),
    DEBUG_ENABLED: (value) => ['true', 'false'].includes(value),
    AUTO_ROLLBACK_ENABLED: (value) => ['true', 'false'].includes(value),
    DEPLOYMENT_TIMEOUT: (value) => !value || !isNaN(parseInt(value))
  }
};

/**
 * 从.env文件加载环境变量
 * @param {string} envFile - .env文件路径
 * @returns {Object} 加载的环境变量
 */
function loadEnvFromFile(envFile) {
  try {
    if (!fs.existsSync(envFile)) {
      log(`环境文件不存在: ${envFile}`, 'warning');
      return {};
    }
    
    log(`从文件加载环境变量: ${envFile}`, 'info');
    const content = fs.readFileSync(envFile, 'utf8');
    const envVars = {};
    
    content.split('\n').forEach(line => {
      // 跳过注释和空行
      if (line.trim().startsWith('#') || line.trim() === '') {
        return;
      }
      
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
        envVars[key.trim()] = value;
      }
    });
    
    return envVars;
  } catch (error) {
    log(`读取环境文件失败: ${error.message}`, 'error');
    return {};
  }
}

/**
 * 验证单个环境变量
 * @param {string} key - 环境变量名
 * @param {string} value - 环境变量值
 * @returns {Object} 验证结果
 */
function validateEnvVar(key, value) {
  if (!value) {
    return {
      valid: false,
      message: `环境变量 ${key} 未设置`
    };
  }
  
  // 应用特定验证规则
  if (ENV_CONFIG.rules[key]) {
    const isValid = ENV_CONFIG.rules[key](value);
    if (!isValid) {
      return {
        valid: false,
        message: `环境变量 ${key} 值无效: ${value}`
      };
    }
  }
  
  // 检查敏感信息是否使用了默认值
  if (['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'VERCEL_TOKEN'].includes(key) && 
      (value.includes('your_') || value.includes('change_this'))) {
    return {
      valid: true,
      warning: `警告: 环境变量 ${key} 可能使用了默认值，生产环境必须更改！`
    };
  }
  
  return { valid: true };
}

/**
 * 验证环境变量配置
 * @param {Object} envVars - 环境变量对象
 * @returns {Object} 验证结果汇总
 */
function validateEnvironment(envVars) {
  const results = {
    required: { passed: 0, failed: 0, issues: [] },
    recommended: { passed: 0, failed: 0, issues: [] },
    warnings: [],
    allValid: true
  };
  
  const currentEnv = envVars.NODE_ENV || 'development';
  const allRequired = [...ENV_CONFIG.required];
  
  // 添加特定环境的必需变量
  if (ENV_CONFIG.byEnvironment[currentEnv]) {
    allRequired.push(...ENV_CONFIG.byEnvironment[currentEnv]);
  }
  
  // 验证必需的环境变量
  allRequired.forEach(key => {
    const result = validateEnvVar(key, envVars[key]);
    if (!result.valid) {
      results.required.failed++;
      results.required.issues.push(result.message);
      results.allValid = false;
    } else {
      results.required.passed++;
      if (result.warning) {
        results.warnings.push(result.warning);
      }
    }
  });
  
  // 验证推荐的环境变量
  ENV_CONFIG.recommended.forEach(key => {
    const result = validateEnvVar(key, envVars[key]);
    if (!result.valid) {
      results.recommended.failed++;
      results.recommended.issues.push(result.message);
    } else {
      results.recommended.passed++;
      if (result.warning) {
        results.warnings.push(result.warning);
      }
    }
  });
  
  return results;
}

/**
 * 生成环境变量报告
 * @param {Object} results - 验证结果
 */
function generateReport(results, envVars) {
  log('\n======================================', 'info');
  log('环境变量验证报告', 'info');
  log('======================================', 'info');
  log(`当前环境: ${envVars.NODE_ENV || 'development'}`, 'info');
  
  log(`\n必需变量: ${results.required.passed}/${results.required.passed + results.required.failed} 通过`, 
    results.required.failed > 0 ? 'error' : 'success');
  
  results.required.issues.forEach(issue => {
    log(issue, 'error');
  });
  
  log(`\n推荐变量: ${results.recommended.passed}/${results.recommended.passed + results.recommended.failed} 通过`, 
    results.recommended.failed > 0 ? 'warning' : 'success');
  
  results.recommended.issues.forEach(issue => {
    log(issue, 'warning');
  });
  
  if (results.warnings.length > 0) {
    log('\n警告信息:', 'warning');
    results.warnings.forEach(warning => {
      log(warning, 'warning');
    });
  }
  
  log('\n======================================', 'info');
  
  if (results.allValid) {
    log('环境变量验证通过！', 'success');
    
    // 提供Vercel环境变量设置建议
    log('\nVercel环境变量设置建议:', 'info');
    const allVars = { ...process.env, ...envVars };
    const allKeys = [...new Set([...ENV_CONFIG.required, ...ENV_CONFIG.recommended])];
    
    log('请在Vercel Dashboard中设置以下环境变量:', 'info');
    allKeys.forEach(key => {
      if (allVars[key] && !allVars[key].includes('your_')) {
        log(`- ${key}: [${allVars[key].length > 10 ? allVars[key].substring(0, 10) + '...' : allVars[key]}]`, 'info');
      }
    });
    
    return 0;
  } else {
    log('环境变量验证失败，请修复上述问题后再继续！', 'error');
    log('\n修复建议:', 'info');
    log('1. 对于本地开发: 复制 .env.example 为 .env.local 并填入正确值', 'info');
    log('2. 对于Vercel部署: 在项目设置 > 环境变量中添加缺失的变量', 'info');
    log('3. 确保敏感信息不使用默认值', 'info');
    
    return 1;
  }
}

/**
 * 主函数
 */
async function main() {
  log('开始验证环境变量配置...', 'info');
  
  // 确定环境文件路径
  const rootDir = path.resolve(process.cwd());
  const envExamplePath = path.join(rootDir, '.env.example');
  const envLocalPath = path.join(rootDir, '.env.local');
  
  // 加载环境变量
  const envExampleVars = loadEnvFromFile(envExamplePath);
  const envLocalVars = loadEnvFromFile(envLocalPath);
  
  // 合并环境变量（优先级: process.env > .env.local > .env.example）
  const envVars = {
    ...envExampleVars,
    ...envLocalVars,
    ...process.env
  };
  
  // 验证环境变量
  const results = validateEnvironment(envVars);
  
  // 生成报告
  const exitCode = generateReport(results, envVars);
  
  return exitCode;
}

// 执行主函数
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  log(`验证过程中发生错误: ${error.message}`, 'error');
  process.exit(1);
});