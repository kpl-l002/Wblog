import fs from 'fs';
import path from 'path';

console.log('开始构建项目...');

// 清理out目录（Vercel默认输出目录）
const outputDir = 'out';
if (fs.existsSync(outputDir)) {
  console.log('清理out目录...');
  fs.rmSync(outputDir, { recursive: true, force: true });
}

// 创建out目录
fs.mkdirSync(outputDir, { recursive: true });
console.log('创建out目录');

// 复制文件
const copyFiles = ['index.html', '404.html', '500.html', 'admin.html', 'admin_readme.md', 'README.md'];
copyFiles.forEach(file => {
  const sourcePath = file;
  const destPath = path.join(outputDir, file);
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log('复制文件: ' + file);
    } else {
      console.warn('文件不存在: ' + sourcePath);
    }
  } catch (err) {
    console.error('复制失败 ' + file + ': ' + err.message);
  }
});

// 复制目录
const copyDirs = [['css', 'css'], ['js', 'js']];
copyDirs.forEach(([sourceDir, destDir]) => {
  const sourcePath = sourceDir;
  const destPath = path.join(outputDir, destDir);
  try {
    if (fs.existsSync(sourcePath)) {
      fs.mkdirSync(destPath, { recursive: true });
      fs.cpSync(sourcePath, destPath, { recursive: true });
      console.log('复制目录: ' + sourceDir + ' 到 ' + destDir);
    } else {
      console.warn('目录不存在: ' + sourcePath);
    }
  } catch (err) {
    console.error('复制目录失败 ' + sourceDir + ': ' + err.message);
  }
});

// 注意：在Vercel中，api目录会被自动处理，不需要复制到out目录

console.log('✅ 构建完成: 所有文件已复制到out目录');
