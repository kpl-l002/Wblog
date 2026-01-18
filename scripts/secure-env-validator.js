#!/usr/bin/env node

/**
 * 安全环境变量验证脚本
 * 验证必要的安全配置是否存在
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

// 检查必需的环境变量
function checkRequiredEnvVars() {
  log('检查必需的安全环境变量...', 'info');
  
  const requiredVars = [
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD_HASH',
    'JWT_SECRET'
  ];
  
  const missingVars = [];
  
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }
  
  if (missingVars.length > 0) {
    log(`缺少以下必需的环境变量: ${missingVars.join(', ')}`, 'error');
    log('请在 .env 文件中设置这些变量', 'error');
    return false;
  }
  
  log('所有必需的安全环境变量都已设置', 'success');
  return true;
}

// 检查密码哈希强度
function checkPasswordHash() {
    log('检查管理员密码哈希...', 'info');
    
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    
    if (!passwordHash) {
        log('未设置管理员密码哈希', 'error');
        return false;
    }
    
    // 检查是否为bcrypt哈希格式
    if (!passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2y$')) {
        log('警告: 密码哈希不是bcrypt格式，这可能不安全', 'warning');
        return true; // 不阻止运行，但给出警告
    }
    
    log('管理员密码哈希格式正确', 'success');
    return true;
}

// 检查JWT密钥强度
function checkJwtSecret() {
    log('检查JWT密钥安全性...', 'info');
    
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
        log('未设置JWT密钥', 'error');
        return false;
    }
    
    // 检查密钥长度
    if (jwtSecret.length < 32) {
        log('JWT密钥长度小于32字符，安全性较低', 'warning');
        return true; // 不阻止运行，但给出警告
    }
    
    log('JWT密钥长度足够安全', 'success');
    return true;
}

// 检查是否在生产环境中使用了默认值
function checkForDefaultValues() {
    log('检查是否使用默认安全值...', 'info');
    
    const defaultPasswords = [
        '$2b$10$8K5pJyCx3/ZL9o7EQKaINO4iQdFBq6XbLnDbH3WNbBl3zYpUHLWDG', // 'admin123'的哈希
        'admin123',
        'password',
        ''
    ];
    
    if (defaultPasswords.includes(process.env.ADMIN_PASSWORD_HASH) || 
        defaultPasswords.includes(process.env.JWT_SECRET)) {
        log('检测到使用默认安全值，强烈建议修改!', 'warning');
        return false;
    }
    
    log('未检测到默认安全值', 'success');
    return true;
}

// 主函数
function main() {
    log('开始安全环境变量验证...', 'info');
    
    let allChecksPassed = true;
    
    allChecksPassed &= checkRequiredEnvVars();
    allChecksPassed &= checkPasswordHash();
    allChecksPassed &= checkJwtSecret();
    allChecksPassed &= checkForDefaultValues();
    
    if (allChecksPassed) {
        log('所有安全检查均已通过', 'success');
    } else {
        log('某些安全检查未通过，请修复问题后重试', 'error');
        process.exit(1);
    }
}

// 运行主函数
try {
    main();
} catch (error) {
    log(`验证过程中发生错误: ${error.message}`, 'error');
    process.exit(1);
}