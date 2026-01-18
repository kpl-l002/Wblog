#!/usr/bin/env node

// Vercel部署配置检查脚本
// 使用方法: node scripts/check-config.js

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 检查文件是否存在
function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    success(`${description}: 存在`);
    return true;
  } else {
    error(`${description}: 不存在`);
    return false;
  }
}

// 检查JSON配置文件
function checkJsonConfig(filePath, requiredFields, description) {
  if (!fs.existsSync(filePath)) {
    error(`${description}: 文件不存在`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    let allValid = true;
    
    for (const field of requiredFields) {
      if (config[field] === undefined) {
        error(`${description}: 缺少必需字段 '${field}'`);
        allValid = false;
      } else {
        success(`${description}: 字段 '${field}' 存在`);
      }
    }
    
    return allValid;
  } catch (err) {
    error(`${description}: JSON解析错误 - ${err.message}`);
    return false;
  }
}

// 检查环境变量文件
function checkEnvFile() {
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envExamplePath)) {
    warn('环境变量示例文件不存在');
    return false;
  }

  const content = fs.readFileSync(envExamplePath, 'utf8');
  const lines = content.split('\n').filter(line => 
    line.trim() && !line.trim().startsWith('#') && line.includes('=')
  );

  success(`环境变量示例文件: 包含 ${lines.length} 个变量定义`);
  
  // 检查重要环境变量
  const importantVars = ['NODE_ENV', 'SITE_NAME', 'JWT_SECRET'];
  const foundVars = [];
  
  for (const line of lines) {
    const varName = line.split('=')[0].trim();
    if (importantVars.includes(varName)) {
      foundVars.push(varName);
    }
  }

  const missingVars = importantVars.filter(v => !foundVars.includes(v));
  
  if (missingVars.length > 0) {
    warn(`缺少重要环境变量: ${missingVars.join(', ')}`);
    return false;
  } else {
    success('所有重要环境变量已定义');
    return true;
  }
}

// 检查API文件
// 检查API文件 - 增强版
function checkApiFiles() {
  logger.info('检查API文件...');
  const apiDir = path.join(__dirname, '..', 'api');
  const requiredApis = ['comments.js', 'check-ip.js', 'health.js', 'deploy-status.js'];
  
  if (!fs.existsSync(apiDir)) {
    logger.error('API目录不存在');
    return false;
  }

  let allExist = true;
  
  // 获取并显示所有API文件
  const files = fs.readdirSync(apiDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  logger.success(`找到 ${jsFiles.length} 个API文件`);
  
  for (const apiFile of requiredApis) {
    const apiPath = path.join(apiDir, apiFile);
    if (fs.existsSync(apiPath)) {
      logger.success(`API文件: ${apiFile} 存在`);
      
      // 检查文件内容
      const content = readFileSafely(apiPath);
      if (content) {
        // 检查基本结构
        if (content.includes('module.exports') || content.includes('export default')) {
          logger.success(`  ${apiFile}: 导出配置正确`);
        } else {
          logger.warning(`  ${apiFile}: 可能缺少正确的导出配置`);
        }
      }
    } else {
      logger.error(`API文件: ${apiFile} 不存在`);
      allExist = false;
    }
  }
  
  return allExist;
}

// 检查脚本文件
// 检查脚本文件 - 增强版
function checkScriptFiles() {
  logger.info('检查脚本文件...');
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const requiredScripts = ['deploy.sh', 'deploy.bat', 'check-config.js'];
  
  if (!fs.existsSync(scriptsDir)) {
    logger.error('脚本目录不存在');
    return false;
  }

  let allExist = true;
  
  // 获取并显示所有脚本文件
  const files = fs.readdirSync(scriptsDir);
  logger.success(`找到 ${files.length} 个脚本文件`);
  
  for (const scriptFile of requiredScripts) {
    const scriptPath = path.join(scriptsDir, scriptFile);
    if (fs.existsSync(scriptPath)) {
      logger.success(`脚本文件: ${scriptFile} 存在`);
      
      // 检查执行权限
      try {
        const stats = fs.statSync(scriptPath);
        if (stats.mode & 0o111) {
          logger.success(`  ${scriptFile}: 具有执行权限`);
        } else {
          logger.warning(`  ${scriptFile}: 建议添加执行权限`);
        }
      } catch (error) {
        logger.warning(`  ${scriptFile}: 无法检查执行权限`);
      }
    } else {
      logger.error(`脚本文件: ${scriptFile} 不存在`);
      allExist = false;
    }
  }
  
  return allExist;
}

// 检查package.json脚本
// 检查package.json脚本 - 增强版
function checkPackageScripts() {
  logger.info('检查package.json脚本命令...');
  const packagePath = path.join(__dirname, '..', 'package.json');
  
  if (!checkFile(packagePath, 'package.json文件', true)) {
    return false;
  }

  const content = readFileSafely(packagePath);
  if (!content) return false;
  
  const pkg = parseJsonSafely(content, 'package.json');
  if (!pkg) return false;
  
  const requiredScripts = [
    'deploy:preview', 'deploy:staging', 'deploy:production',
    'health:check', 'status:deployments'
  ];
  
  // 扩展必需脚本列表
  const enhancedRequiredScripts = [...requiredScripts, 'validate-env', 'validate-config', 'prebuild'];
  const recommendedScripts = ['test', 'lint', 'format'];
  
  let allExist = true;
  
  for (const script of enhancedRequiredScripts) {
    if (pkg.scripts && pkg.scripts[script]) {
      logger.success(`package.json脚本: ${script} 存在`);
      
      // 检查脚本内容的合理性
      const scriptContent = pkg.scripts[script];
      if (script.includes('deploy') && scriptContent.includes('scripts')) {
        logger.success(`  ${script}: 使用自定义部署脚本`);
      } else if (script.includes('validate') && scriptContent.includes('check')) {
        logger.success(`  ${script}: 包含验证逻辑`);
      }
    } else {
      logger.error(`package.json脚本: ${script} 不存在`);
      allExist = false;
    }
  }
  
  // 检查推荐脚本
  for (const script of recommendedScripts) {
    if (pkg.scripts && pkg.scripts[script]) {
      logger.success(`推荐脚本存在: ${script}`);
    } else {
      logger.warning(`推荐脚本不存在: ${script}`);
    }
  }
  
  // 检查依赖
  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};
  
  logger.info(`项目依赖: 生产 ${Object.keys(dependencies).length}, 开发 ${Object.keys(devDependencies).length}`);
  
  return allExist;
}

// 主检查函数
async function main() {
  logger.info('开始执行增强版Vercel部署配置检查...');
  logger.info('========================================');

  let hasErrors = false;

  // 按优先级执行检查
  // 1. 检查Vercel配置 - 使用增强版检查
  const vercelConfigCheck = () => checkJsonConfig(
    path.join(__dirname, '..', 'vercel.json'),
    ['version', 'builds', 'routes'],
    ['functions', 'cleanUrls', 'trailingSlash', 'headers', 'redirects'],
    'vercel.json'
  );
  
  logger.info('\n=== 检查: vercel.json配置文件 ===');
  if (!vercelConfigCheck()) {
    hasErrors = true;
  }

  // 2. 检查package.json文件
  logger.info('\n=== 检查: package.json文件 ===');
  if (!checkFile(path.join(__dirname, '..', 'package.json'), 'package.json')) {
    hasErrors = true;
  }

  // 3. 检查package.json脚本
  logger.info('\n=== 检查: package.json脚本 ===');
  if (!checkPackageScripts()) {
    hasErrors = true;
  }

  // 4. 检查环境变量文件
  logger.info('\n=== 检查: 环境变量配置 ===');
  if (!checkEnvFile()) {
    hasErrors = true;
  }

  // 5. 检查API文件
  logger.info('\n=== 检查: API文件检查 ===');
  if (!checkApiFiles()) {
    hasErrors = true;
  }

  // 6. 检查脚本文件
  logger.info('\n=== 检查: 脚本文件检查 ===');
  if (!checkScriptFiles()) {
    hasErrors = true;
  }

  logger.info('========================================');
  
  // 生成摘要报告
  const summaryPassed = logger.summary();
  
  if (hasErrors || !summaryPassed) {
    logger.error('配置检查未通过，请修复发现的问题后再进行部署');
    logger.info('建议检查顺序:');
    logger.info('  1. 修复所有错误级别的问题');
    logger.info('  2. 解决警告级别的问题');
    logger.info('  3. 重新运行验证: node scripts/check-config.js');
    process.exit(1);
  } else {
    logger.success('🎉 所有配置检查通过！项目已准备好进行部署');
    logger.info('接下来可以执行:');
    logger.info('  - 本地开发: npm run dev (如果已配置)');
    logger.info('  - 构建项目: npm run build (如果已配置)');
    logger.info('  - 部署预览: npm run deploy:preview');
    logger.info('  - 生产部署: npm run deploy:production');
    logger.info('  - 检查部署状态: npm run status:deployments');
    process.exit(0);
  }
}

// 运行检查
if (require.main === module) {
  main().catch(err => {
    error(`检查过程中出现错误: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };