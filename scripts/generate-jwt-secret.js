#!/usr/bin/env node

/**
 * 生成JWT密钥的工具脚本
 * 用于生成安全的JWT密钥
 */

import crypto from 'crypto';

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

// 生成JWT密钥
function generateJwtSecret(length = 64) {
  try {
    log(`正在生成长度为 ${length} 字符的JWT密钥...`, 'info');
    
    const secret = crypto.randomBytes(Math.ceil(length / 2)).toString('hex');
    
    log(`JWT密钥: ${secret}`, 'success');
    log('', 'info'); // 空行
    log('请将以上密钥复制到您的 .env 文件中的 JWT_SECRET 字段', 'info');
    log('注意: 在生产环境中，请务必通过环境变量设置此值，而不是硬编码在代码中', 'warning');
    
    return secret;
  } catch (error) {
    log(`生成密钥时出错: ${error.message}`, 'error');
    return null;
  }
}

// 主函数
async function main() {
  log('JWT密钥生成工具', 'info');
  log('==================', 'info');
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  
  let length = 64; // 默认长度
  
  if (args.length > 0) {
    const parsedLength = parseInt(args[0], 10);
    if (!isNaN(parsedLength) && parsedLength >= 32) {
      length = parsedLength;
    } else if (parsedLength < 32) {
      log('警告: 密钥长度应至少为32个字符以确保安全性，使用默认长度64', 'warning');
    } else {
      log('无效的长度参数，使用默认长度64', 'warning');
    }
  }
  
  // 验证长度要求
  if (length < 32) {
    log('错误: 密钥长度不能少于32个字符', 'error');
    process.exit(1);
  }
  
  generateJwtSecret(length);
}

// 运行主函数
try {
  main();
} catch (error) {
  log(`执行过程中发生错误: ${error.message}`, 'error');
  process.exit(1);
}