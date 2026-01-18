#!/usr/bin/env node

/**
 * 生成密码哈希值的工具脚本
 * 用于生成安全的密码哈希
 */

import bcrypt from 'bcrypt';

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

// 生成密码哈希
async function generatePasswordHash(password, saltRounds = 10) {
  try {
    log(`正在为密码生成哈希值...`, 'info');
    
    const hash = await bcrypt.hash(password, saltRounds);
    
    log(`密码: ${password}`, 'info');
    log(`哈希值: ${hash}`, 'success');
    log('', 'info'); // 空行
    log('请将以上哈希值复制到您的 .env 文件中的 ADMIN_PASSWORD_HASH 字段', 'info');
    
    return hash;
  } catch (error) {
    log(`生成哈希时出错: ${error.message}`, 'error');
    return null;
  }
}

// 主函数
async function main() {
  log('密码哈希生成工具', 'info');
  log('==================', 'info');
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('用法: node generate-password-hash.js <password>', 'error');
    log('示例: node generate-password-hash.js mySecurePassword123', 'info');
    process.exit(1);
  }
  
  const password = args[0];
  
  // 验证密码强度
  if (password.length < 8) {
    log('警告: 密码长度应至少为8个字符', 'warning');
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    log('警告: 密码应包含大小写字母和数字以提高安全性', 'warning');
  }
  
  await generatePasswordHash(password);
}

// 运行主函数
try {
  await main();
} catch (error) {
  log(`执行过程中发生错误: ${error.message}`, 'error');
  process.exit(1);
}