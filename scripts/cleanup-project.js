#!/usr/bin/env node

/**
 * 项目清理脚本
 * 用于优化项目体积，移除冗余文件和依赖
 * 使用方法: node scripts/cleanup-project.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 日志工具
class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m'
    };
    this.removedItems = 0;
    this.savedSpace = 0;
  }

  log(message, color = 'cyan') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${this.colors[color]}[${timestamp}] ${message}${this.colors.reset}`);
  }

  success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  warning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  error(message) {
    this.log(`❌ ${message}`, 'red');
  }

  info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  addRemovedItem() {
    this.removedItems++;
  }

  addSavedSpace(bytes) {
    this.savedSpace += bytes;
  }

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  }

  summary() {
    this.info(`清理摘要:`);
    this.info(`  - 移除的项目: ${this.removedItems}`);
    this.info(`  - 节省的空间: ${this.formatBytes(this.savedSpace)}`);
  }
}

const logger = new Logger();
// 获取当前文件的目录路径（ES模块方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 要清理的文件和目录模式
const cleanupPatterns = {
  // 临时文件
  tempFiles: [
    '*.tmp', '*.temp', '~*', '.DS_Store',
    'Thumbs.db', '.Thumbs.db', 'desktop.ini',
    '*.log', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*'
  ],
  
  // 缓存目录
  cacheDirs: [
    'node_modules/.cache', '.cache', '.parcel-cache',
    '.next/cache', 'dist/cache', 'build/cache',
    '.rollup.cache', '.eslintcache', '.vscode-test',
    'coverage', '.nyc_output'
  ],
  
  // 构建输出目录
  buildDirs: [
    'dist', 'build', 'out', '.next',
    'public/build', 'static/build'
  ],
  
  // 开发依赖目录
  devDirs: [
    'node_modules/@types', 'node_modules/eslint-*',
    'node_modules/jest-*', 'node_modules/babel-*',
    'node_modules/webpack-*', 'node_modules/typescript'
  ],
  
  // 测试相关文件
  testFiles: [
    '__tests__', '**/*.test.js', '**/*.spec.js',
    '**/*.test.ts', '**/*.spec.ts', 'tests', 'test'
  ]
};

/**
 * 获取文件或目录的大小
 */
function getSize(pathToCheck) {
  try {
    const stats = fs.statSync(pathToCheck);
    if (stats.isFile()) {
      return stats.size;
    } else if (stats.isDirectory()) {
      let totalSize = 0;
      const files = fs.readdirSync(pathToCheck);
      for (const file of files) {
        const filePath = path.join(pathToCheck, file);
        totalSize += getSize(filePath);
      }
      return totalSize;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * 递归删除文件或目录
 */
function deleteItem(itemPath) {
  try {
    const stats = fs.statSync(itemPath);
    const size = getSize(itemPath);
    
    if (stats.isFile()) {
      fs.unlinkSync(itemPath);
      logger.success(`删除文件: ${path.relative(rootDir, itemPath)}`);
    } else if (stats.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      logger.success(`删除目录: ${path.relative(rootDir, itemPath)}`);
    }
    
    logger.addRemovedItem();
    logger.addSavedSpace(size);
    return true;
  } catch (error) {
    logger.warning(`无法删除: ${path.relative(rootDir, itemPath)} - ${error.message}`);
    return false;
  }
}

/**
 * 根据模式清理文件
 */
function cleanupByPatterns(patterns, dryRun = false) {
  for (const pattern of patterns) {
    const searchPath = path.join(rootDir, pattern);
    try {
      if (fs.existsSync(searchPath)) {
        if (!dryRun) {
          deleteItem(searchPath);
        } else {
          const size = getSize(searchPath);
          logger.info(`将删除: ${path.relative(rootDir, searchPath)} (${logger.formatBytes(size)})`);
        }
      }
    } catch (error) {
      logger.error(`清理模式失败: ${pattern} - ${error.message}`);
    }
  }
}

/**
 * 清理临时文件
 */
function cleanupTempFiles(dryRun = false) {
  logger.info('开始清理临时文件...');
  cleanupByPatterns(cleanupPatterns.tempFiles, dryRun);
}

/**
 * 清理缓存目录
 */
function cleanupCacheDirs(dryRun = false) {
  logger.info('开始清理缓存目录...');
  cleanupByPatterns(cleanupPatterns.cacheDirs, dryRun);
}

/**
 * 清理构建输出目录
 */
function cleanupBuildDirs(dryRun = false) {
  logger.info('开始清理构建输出目录...');
  cleanupByPatterns(cleanupPatterns.buildDirs, dryRun);
}

/**
 * 检查并清理未使用的依赖
 */
function cleanupUnusedDependencies(dryRun = false) {
  logger.info('检查未使用的依赖...');
  
  try {
    // 尝试使用 npm-check 或其他工具检查未使用的依赖
    // 这里我们简单地检查 node_modules 中的大型包
    const nodeModulesPath = path.join(rootDir, 'node_modules');
    
    if (fs.existsSync(nodeModulesPath)) {
      const packages = fs.readdirSync(nodeModulesPath).filter(pkg => 
        !pkg.startsWith('.') && 
        fs.statSync(path.join(nodeModulesPath, pkg)).isDirectory()
      );
      
      const largePackages = [];
      
      packages.forEach(pkg => {
        const pkgPath = path.join(nodeModulesPath, pkg);
        const size = getSize(pkgPath);
        if (size > 10 * 1024 * 1024) { // 大于10MB的包
          largePackages.push({ name: pkg, size });
        }
      });
      
      // 按大小排序
      largePackages.sort((a, b) => b.size - a.size);
      
      logger.info(`发现 ${largePackages.length} 个大型依赖包:`);
      largePackages.forEach(pkg => {
        logger.info(`  - ${pkg.name}: ${logger.formatBytes(pkg.size)}`);
      });
      
      logger.warning('注意: 请手动检查这些大型包是否必要');
    }
  } catch (error) {
    logger.error(`依赖检查失败: ${error.message}`);
  }
}

/**
 * 优化 package.json
 */
function optimizePackageJson(dryRun = false) {
  logger.info('检查 package.json...');
  
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 检查是否有冗余字段
      const redundantFields = ['description', 'author', 'license'];
      let hasChanges = false;
      
      for (const field of redundantFields) {
        if (!packageJson[field]) {
          logger.warning(`package.json 缺少 ${field} 字段`);
        }
      }
      
      // 检查是否有未使用的脚本
      const scripts = packageJson.scripts || {};
      const scriptNames = Object.keys(scripts);
      
      logger.info(`package.json 包含 ${scriptNames.length} 个脚本命令`);
      
      if (!dryRun && hasChanges) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        logger.success('优化了 package.json');
      }
    } catch (error) {
      logger.error(`解析 package.json 失败: ${error.message}`);
    }
  }
}

/**
 * 检查 .gitignore 文件
 */
function checkGitignore() {
  logger.info('检查 .gitignore 文件...');
  
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    logger.warning('.gitignore 文件不存在');
    
    // 创建基本的 .gitignore 文件
    const basicGitignore = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
*.lcov
.nyc_output

# Production
build
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Cache
.cache
.parcel-cache
.next/cache
.eslintcache

# Temporary files
*.tmp
*.temp
~*
Thumbs.db`;
    
    fs.writeFileSync(gitignorePath, basicGitignore);
    logger.success('创建了基本的 .gitignore 文件');
  } else {
    // 检查 .gitignore 内容是否合理
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = [
      'node_modules', 'dist', 'build', 'out',
      '.env', '*.log', 'coverage', '.DS_Store'
    ];
    
    let hasMissingPatterns = false;
    for (const pattern of requiredPatterns) {
      if (!content.includes(pattern)) {
        logger.warning(`.gitignore 缺少推荐的模式: ${pattern}`);
        hasMissingPatterns = true;
      }
    }
    
    if (!hasMissingPatterns) {
      logger.success('.gitignore 文件包含所有推荐的模式');
    }
  }
}

/**
 * 执行 Git 清理
 */
function cleanupGit() {
  logger.info('执行 Git 清理...');
  
  try {
    // 检查是否在 Git 仓库中
    if (fs.existsSync(path.join(rootDir, '.git'))) {
      // 运行 git gc --aggressive --prune=now
      logger.info('运行 git gc 优化 Git 仓库...');
      execSync('git gc --aggressive --prune=now', { cwd: rootDir, stdio: 'ignore' });
      logger.success('Git 仓库优化完成');
    } else {
      logger.warning('当前目录不是 Git 仓库，跳过 Git 清理');
    }
  } catch (error) {
    logger.error(`Git 清理失败: ${error.message}`);
  }
}

/**
 * 主清理函数
 */
async function main() {
  logger.info('开始项目清理...');
  logger.info('========================================');
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipBuild = args.includes('--skip-build');
  const skipDependencies = args.includes('--skip-deps');
  
  if (dryRun) {
    logger.warning('执行模拟清理模式 (--dry-run)，不会实际删除文件');
  }
  
  // 1. 检查 .gitignore
  checkGitignore();
  
  // 2. 清理临时文件
  cleanupTempFiles(dryRun);
  
  // 3. 清理缓存目录
  cleanupCacheDirs(dryRun);
  
  // 4. 清理构建输出目录
  if (!skipBuild) {
    cleanupBuildDirs(dryRun);
  } else {
    logger.info('跳过构建输出目录清理 (--skip-build)');
  }
  
  // 5. 检查未使用的依赖
  if (!skipDependencies) {
    cleanupUnusedDependencies(dryRun);
  } else {
    logger.info('跳过依赖检查 (--skip-deps)');
  }
  
  // 6. 优化 package.json
  optimizePackageJson(dryRun);
  
  // 7. Git 仓库清理
  if (!dryRun) {
    cleanupGit();
  }
  
  logger.info('========================================');
  
  // 生成摘要
  logger.summary();
  
  if (dryRun) {
    logger.info('提示: 运行以下命令进行实际清理:');
    logger.info('  node scripts/cleanup-project.js');
    logger.info('使用选项:');
    logger.info('  --dry-run, -d    模拟清理，不实际删除文件');
    logger.info('  --skip-build     跳过构建输出目录清理');
    logger.info('  --skip-deps      跳过依赖检查');
  } else {
    logger.success('🎉 项目清理完成！');
    logger.info('提示: 运行 npm install 重新安装依赖');
    logger.info('运行 npm run build 重新构建项目');
  }
}

// 执行主函数
main().catch(error => {
  logger.error(`清理过程中发生错误: ${error.message}`);
  process.exit(1);
});

// 导出主函数供其他模块使用
export default main;