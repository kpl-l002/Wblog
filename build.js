import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// 日志工具函数
function logWithTimestamp(level, message) {
  const timestamp = new Date().toISOString();
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `[${timestamp}] [${level.toUpperCase()}] ${message}`
  );
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.error(`❌ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️ ${message}`);
}

// 构建配置
const BUILD_CONFIG = {
  outputDir: 'out',
  staticFiles: [
    'index.html', '404.html', '500.html', 'admin.html', 
    'admin_readme.md', 'README.md'
  ],
  staticDirs: [
    { source: 'css', destination: 'css' },
    { source: 'js', destination: 'js' }
  ],
  environment: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  startTime: Date.now()
};

// 记录构建信息
function writeBuildInfo() {
  const buildInfo = {
    timestamp: new Date().toISOString(),
    environment: BUILD_CONFIG.environment,
    buildDuration: `${(Date.now() - BUILD_CONFIG.startTime) / 1000}s`,
    version: process.env.APP_VERSION || '1.0.0',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local-build',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'local'
  };
  
  const buildInfoPath = path.join(BUILD_CONFIG.outputDir, 'build-info.json');
  try {
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
    logInfo(`构建信息已写入: ${buildInfoPath}`);
  } catch (err) {
    logError(`写入构建信息失败: ${err.message}`);
  }
}

// 验证目录是否存在
function validateDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }
  return true;
}

// 验证必要文件是否存在
function validateRequiredFiles() {
  const requiredFiles = ['index.html', 'package.json'];
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    throw new Error(`缺少必要文件: ${missingFiles.join(', ')}`);
  }
  
  return true;
}

// 清理输出目录
function cleanOutputDir() {
  logInfo(`开始清理输出目录: ${BUILD_CONFIG.outputDir}`);
  try {
    if (fs.existsSync(BUILD_CONFIG.outputDir)) {
      fs.rmSync(BUILD_CONFIG.outputDir, { recursive: true, force: true });
      logSuccess(`成功清理目录: ${BUILD_CONFIG.outputDir}`);
    }
    fs.mkdirSync(BUILD_CONFIG.outputDir, { recursive: true });
    logSuccess(`创建输出目录: ${BUILD_CONFIG.outputDir}`);
  } catch (err) {
    logError(`清理输出目录失败: ${err.message}`);
    throw err;
  }
}

// 复制文件并验证
function copyFileWithValidation(source, destination) {
  try {
    const stats = fs.statSync(source);
    fs.copyFileSync(source, destination);
    
    // 验证复制是否成功
    const destStats = fs.statSync(destination);
    if (stats.size !== destStats.size) {
      throw new Error(`文件大小不匹配: ${source}`);
    }
    
    logInfo(`已复制: ${source} -> ${destination}`);
    return true;
  } catch (err) {
    logError(`复制文件失败 ${source}: ${err.message}`);
    return false;
  }
}

// 复制目录
function copyDirectory(sourceDir, destDir) {
  logInfo(`开始复制目录: ${sourceDir} -> ${destDir}`);
  
  try {
    if (!fs.existsSync(sourceDir)) {
      logInfo(`目录不存在，跳过: ${sourceDir}`);
      return false;
    }
    
    fs.mkdirSync(destDir, { recursive: true });
    
    const files = fs.readdirSync(sourceDir);
    let successCount = 0;
    let failureCount = 0;
    
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);
      const isDir = fs.statSync(sourcePath).isDirectory();
      
      if (isDir) {
        if (copyDirectory(sourcePath, destPath)) {
          successCount++;
        } else {
          failureCount++;
        }
      } else {
        if (copyFileWithValidation(sourcePath, destPath)) {
          successCount++;
        } else {
          failureCount++;
        }
      }
    });
    
    logInfo(`目录复制完成: ${sourceDir} -> ${destDir} (成功: ${successCount}, 失败: ${failureCount})`);
    return failureCount === 0;
  } catch (err) {
    logError(`复制目录失败 ${sourceDir}: ${err.message}`);
    return false;
  }
}

// 处理环境变量
function processEnvironmentVariables() {
  logInfo('处理环境变量配置');
  
  // 读取.env.example作为基准
  const envExamplePath = '.env.example';
  if (fs.existsSync(envExamplePath)) {
    logInfo(`找到环境变量模板: ${envExamplePath}`);
    
    // 创建环境特定的配置
    const envConfig = {
      NODE_ENV: BUILD_CONFIG.environment,
      APP_VERSION: process.env.APP_VERSION || '1.0.0',
      BUILD_TIME: new Date().toISOString()
    };
    
    // 写入构建信息到env-config.js
    const envConfigContent = `// 自动生成的环境配置
window.APP_ENV = ${JSON.stringify(envConfig, null, 2)};
`;
    
    const envConfigPath = path.join(BUILD_CONFIG.outputDir, 'js', 'env-config.js');
    try {
      // 确保目录存在
      fs.mkdirSync(path.dirname(envConfigPath), { recursive: true });
      fs.writeFileSync(envConfigPath, envConfigContent);
      logSuccess(`环境配置已生成: ${envConfigPath}`);
    } catch (err) {
      logError(`生成环境配置失败: ${err.message}`);
    }
  }
}

// 验证构建结果
function validateBuild() {
  logInfo('验证构建结果...');
  
  const requiredOutputFiles = ['index.html'];
  const missingFiles = [];
  
  requiredOutputFiles.forEach(file => {
    const filePath = path.join(BUILD_CONFIG.outputDir, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    logError(`构建验证失败: 缺少关键文件 ${missingFiles.join(', ')}`);
    return false;
  }
  
  logSuccess('构建验证通过');
  return true;
}

// 生成文件哈希用于缓存控制
function generateAssetHashes() {
  logInfo('生成静态资源哈希...');
  const hashes = {};
  const staticDirs = ['css', 'js'];
  
  staticDirs.forEach(dir => {
    const dirPath = path.join(BUILD_CONFIG.outputDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (file.endsWith('.css') || file.endsWith('.js')) {
          const filePath = path.join(dirPath, file);
          const content = fs.readFileSync(filePath);
          const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
          hashes[`${dir}/${file}`] = hash;
        }
      });
    }
  });
  
  const hashesPath = path.join(BUILD_CONFIG.outputDir, 'asset-hashes.json');
  try {
    fs.writeFileSync(hashesPath, JSON.stringify(hashes, null, 2));
    logSuccess(`资产哈希已生成: ${hashesPath}`);
  } catch (err) {
    logError(`生成资产哈希失败: ${err.message}`);
  }
}

// 主构建函数
async function build() {
  logInfo(`开始构建项目 [环境: ${BUILD_CONFIG.environment}]`);
  logInfo(`Node.js版本: ${process.version}`);
  
  try {
    // 1. 验证项目结构
    logInfo('验证项目结构...');
    validateRequiredFiles();
    logSuccess('项目结构验证通过');
    
    // 2. 清理输出目录
    cleanOutputDir();
    
    // 3. 复制静态文件
    logInfo('开始复制静态文件...');
    BUILD_CONFIG.staticFiles.forEach(file => {
      const source = file;
      const destination = path.join(BUILD_CONFIG.outputDir, file);
      copyFileWithValidation(source, destination);
    });
    
    // 4. 复制静态目录
    logInfo('开始复制静态目录...');
    BUILD_CONFIG.staticDirs.forEach(dir => {
      const sourceDir = dir.source;
      const destDir = path.join(BUILD_CONFIG.outputDir, dir.destination);
      copyDirectory(sourceDir, destDir);
    });
    
    // 5. 处理环境变量
    processEnvironmentVariables();
    
    // 6. 生成文件哈希
    generateAssetHashes();
    
    // 7. 写入构建信息
    writeBuildInfo();
    
    // 8. 验证构建结果
    if (!validateBuild()) {
      throw new Error('构建验证失败');
    }
    
    // 9. 输出构建统计
    const endTime = Date.now();
    const duration = ((endTime - BUILD_CONFIG.startTime) / 1000).toFixed(2);
    
    logInfo('========================================');
    logSuccess(`构建完成！`);
    logInfo(`环境: ${BUILD_CONFIG.environment}`);
    logInfo(`持续时间: ${duration}秒`);
    logInfo(`输出目录: ${BUILD_CONFIG.outputDir}`);
    logInfo('========================================');
    
    return { success: true, duration };
  } catch (err) {
    logError('构建失败: ' + err.message);
    logError(err.stack);
    process.exitCode = 1;
    return { success: false, error: err.message };
  }
}

// 执行构建
build().then(result => {
  if (!result.success) {
    console.error('构建过程遇到错误');
    process.exit(1);
  }
});

const fs = require('fs');
const path = require('path');

// 确保 dist 目录存在
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 复制静态资源到 dist 目录
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    const srcPath = path.join(publicDir, file);
    const destPath = path.join(distDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      // 如果是目录则递归复制
      copyDir(srcPath, destPath);
    }
  }
}

// 复制 index.html 到 dist 目录
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, path.join(distDir, 'index.html'));
}

console.log('Build completed successfully!');

// 辅助函数：复制整个目录
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      copyDir(srcPath, destPath);
    }
  }
}
