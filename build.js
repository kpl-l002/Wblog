const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 检查并自动安装依赖
function ensureDependencies() {
  const dependencies = [
    'handlebars',
    'markdown-it',
    'highlight.js',
    'markdown-it-highlightjs'
  ];

  for (const dep of dependencies) {
    try {
      require.resolve(dep);
    } catch (e) {
      console.log(`${dep} 未找到，正在安装...`);
      try {
        execSync(`npm install ${dep}`, { stdio: 'inherit' });
        // 重新require以确保安装成功
        require(dep);
        console.log(`${dep} 安装成功`);
      } catch (installError) {
        console.error(`安装 ${dep} 失败:`, installError.message);
        process.exit(1);
      }
    }
  }
}

// 在脚本开始时运行依赖检查
ensureDependencies();

// 读取并解析配置
const configPath = path.join(__dirname, 'config.json');
let config = {};
if (fs.existsSync(configPath)) {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);
}

// 从命令行参数获取配置，如果有的话
const args = process.argv.slice(2);
let isDraftVisible = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--draft') {
    isDraftVisible = true;
  }
}

// 获取文章列表
function getArticles(draftVisible) {
  const articlesDir = path.join(__dirname, 'articles');
  if (!fs.existsSync(articlesDir)) {
    return [];
  }

  const articleDirs = fs.readdirSync(articlesDir).filter(file => {
    const fullPath = path.join(articlesDir, file);
    return fs.statSync(fullPath).isDirectory();
  });

  let articles = [];
  for (const dir of articleDirs) {
    const articlePath = path.join(articlesDir, dir);

    // 检查是否为草稿
    const draftFlagPath = path.join(articlePath, 'draft.flag');
    const isDraft = fs.existsSync(draftFlagPath);

    // 如果不显示草稿且当前文章是草稿，则跳过
    if (!draftVisible && isDraft) {
      continue;
    }

    // 尝试读取标题
    let title = dir; // 默认使用文件夹名称作为标题
    const titlePath = path.join(articlePath, 'title.txt');
    if (fs.existsSync(titlePath)) {
      title = fs.readFileSync(titlePath, 'utf8').trim();
    }

    // 尝试读取日期
    let date = null;
    const datePath = path.join(articlePath, 'date.txt');
    if (fs.existsSync(datePath)) {
      const dateStr = fs.readFileSync(datePath, 'utf8').trim();
      // 解析日期字符串
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        date = null; // 如果日期无效则设为null
      }
    }

    // 尝试读取标签
    let tags = [];
    const tagsPath = path.join(articlePath, 'tags.txt');
    if (fs.existsSync(tagsPath)) {
      tags = fs.readFileSync(tagsPath, 'utf8')
        .split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
    }

    // 检查是否存在 index.md 文件
    const indexPath = path.join(articlePath, 'index.md');
    if (fs.existsSync(indexPath)) {
      articles.push({
        id: dir,
        title: title,
        date: date,
        tags: tags,
        draft: isDraft
      });
    }
  }

  // 按日期排序，最新的在前；没有日期的排在最后
  articles.sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return b.date - a.date;
  });

  return articles;
}

// 添加 Handlebars 引擎支持
let Handlebars;
try {
  Handlebars = require('handlebars');
} catch (error) {
  console.error('Handlebars module not found. Please install it using: npm install handlebars');
  process.exit(1);
}

// 注册 formatDate 辅助函数
Handlebars.registerHelper('formatDate', (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// 生成文章页面
function generateArticlePage(articleId) {
  const articlePath = path.join(__dirname, 'articles', articleId);
  const indexPath = path.join(articlePath, 'index.md');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const markdownContent = fs.readFileSync(indexPath, 'utf8');

  // 尝试读取标题
  let title = articleId; // 默认使用ID作为标题
  const titlePath = path.join(articlePath, 'title.txt');
  if (fs.existsSync(titlePath)) {
    title = fs.readFileSync(titlePath, 'utf8').trim();
  }

  // 尝试读取日期
  let date = null;
  const datePath = path.join(articlePath, 'date.txt');
  if (fs.existsSync(datePath)) {
    const dateStr = fs.readFileSync(datePath, 'utf8').trim();
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      date = null;
    }
  }

  // 尝试读取标签
  let tags = [];
  const tagsPath = path.join(articlePath, 'tags.txt');
  if (fs.existsSync(tagsPath)) {
    tags = fs.readFileSync(tagsPath, 'utf8')
      .split('\n')
      .map(tag => tag.trim())
      .filter(tag => tag !== '');
  }

  // 转换markdown内容为html
  const md = require('markdown-it')({
    html: true,
    linkify: true,
    typographer: true
  });

  // 添加代码块高亮
  const hljs = require('highlight.js');
  const mdWithHighlighting = require('markdown-it-highlightjs')(hljs);
  md.use(mdWithHighlighting);

  let htmlContent = md.render(markdownContent);

  // 为代码块添加行号
  htmlContent = htmlContent.replace(/<pre><code>(.*?)<\/code><\/pre>/gms, (match, p1) => {
    const lines = p1.split('\n');
    const langMatch = match.match(/class="([^"]*?)"/);
    let lang = '';
    if (langMatch && langMatch[1]) {
      lang = langMatch[1].replace('language-', '');
    }

    let numberedLines = '<div class="code-block">';
    if (lang) {
      numberedLines += `<div class="code-header">${lang}</div>`;
    }
    numberedLines += '<pre><code>';

    lines.forEach((line, index) => {
      if (index < lines.length - 1) { // 忽略最后一个空行
        numberedLines += `<span class="line"><span class="line-number">${index + 1}</span>${line}</span>\n`;
      }
    });

    numberedLines += '</code></pre></div>';
    return numberedLines;
  });

  // 读取模板
  const templatePath = path.join(__dirname, 'template', 'article.html');
  let template;
  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    // 默认模板
    template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - {{siteName}}</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/highlight.css">
  <script src="/script.js"></script>
</head>
<body>
  <main>
    <article>
      <header>
        <h1>{{title}}</h1>
        {{#if date}}
        <time datetime="{{date}}">{{formatDate date}}</time>
        {{/if}}
        {{#if tags}}
        <div class="tags">
          {{#each tags}}
          <span class="tag">{{this}}</span>
          {{/each}}
        </div>
        {{/if}}
      </header>
      <div class="content">
        {{{content}}}
      </div>
    </article>
  </main>
</body>
</html>`;
  }

  // 编译模板
  const compiledTemplate = Handlebars.compile(template);

  // 构建数据对象
  const data = {
      title: title,
      siteName: config.siteName || 'My Blog',
      date: date ? date.toISOString() : null,
      tags: tags,
      content: htmlContent
  };

  // 渲染模板
  const pageHtml = compiledTemplate(data);

  return pageHtml;
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 生成主页
function generateHomePage(articles) {
  const templatePath = path.join(__dirname, 'template', 'index.html');
  let template;
  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    // 默认模板
    template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{siteName}}</title>
  <link rel="stylesheet" href="/style.css">
  <script src="/script.js"></script>
</head>
<body>
  <main>
    <h1>{{siteName}}</h1>
    <section class="articles-list">
      {{#each articles}}
      <article class="article-item">
        <h2><a href="/article/{{this.id}}">{{this.title}}</a></h2>
        {{#if this.date}}
        <time datetime="{{this.date}}">{{formatDate this.date}}</time>
        {{/if}}
        {{#if this.tags}}
        <div class="tags">
          {{#each this.tags}}
          <span class="tag">{{this}}</span>
          {{/each}}
        </div>
        {{/if}}
        {{#if this.draft}}
        <span class="draft-tag">草稿</span>
        {{/if}}
      </article>
      {{/each}}
    </section>
  </main>
</body>
</html>`;
  }

  const siteName = config.siteName || 'My Blog';

  // 生成文章列表HTML
  let articlesHtml = '';
  articles.forEach(article => {
    articlesHtml += `
      <article class="article-item">
        <h2><a href="/article/${article.id}">${article.title}</a></h2>
        ${article.date ? `<time datetime="${article.date.toISOString()}">${formatDate(article.date)}</time>` : ''}
        ${article.tags && article.tags.length > 0 ?
          '<div class="tags">' + article.tags.map(tag => `<span class="tag">${tag}</span>`).join('') + '</div>'
          : ''}
        ${article.draft ? '<span class="draft-tag">草稿</span>' : ''}
      </article>
    `;
  });

  // 替换模板中的变量
  let pageHtml = template
    .replace('{{siteName}}', siteName)
    .replace('{{#each articles}}', articlesHtml)
    .replace('{{/each}}', '');

  // 处理条件渲染占位符
  pageHtml = pageHtml.replace(/{{#if [^}]*}}/g, '').replace(/{{\/if}}/g, '');

  return pageHtml;
}

// 生成404页面
function generateNotFoundPage() {
  const templatePath = path.join(__dirname, 'template', '404.html');
  let template;
  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    // 默认404页面
    template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - 页面未找到</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main>
    <h1>404 - 页面未找到</h1>
    <p>抱歉，您访问的页面不存在。</p>
    <a href="/">返回首页</a>
  </main>
</body>
</html>`;
  }

  return template;
}

// 复制静态资源
function copyStaticFiles() {
    const staticSrc = path.join(__dirname, 'static');
    const staticDest = path.join(__dirname, 'out', 'static'); // 修改为 out

    if (fs.existsSync(staticSrc)) {
        // 确保目标目录存在
        if (!fs.existsSync(path.dirname(staticDest))) {
            fs.mkdirSync(path.dirname(staticDest), { recursive: true });
        }

        // 复制整个static目录
        const copyRecursive = (src, dest) => {
            const items = fs.readdirSync(src);

            for (let item of items) {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);

                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    if (!fs.existsSync(destPath)) {
                        fs.mkdirSync(destPath, { recursive: true });
                    }
                    copyRecursive(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };

        copyRecursive(staticSrc, staticDest);
    }

    // 同样复制根目录下的CSS、JS和其他静态文件
    const filesToCopy = ['style.css', 'script.js', 'highlight.css'];
    for (const file of filesToCopy) {
        const srcPath = path.join(__dirname, file);
        const destPath = path.join(__dirname, 'out', file); // 修改为 out

        if (fs.existsSync(srcPath)) {
            // 确保目标目录存在
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }

    // 复制 assets 目录
    const assetsSrc = path.join(__dirname, 'assets');
    const assetsDest = path.join(__dirname, 'out', 'assets'); // 修改为 out
    if (fs.existsSync(assetsSrc)) {
        const copyRecursive = (src, dest) => {
            const items = fs.readdirSync(src);

            for (let item of items) {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);

                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    if (!fs.existsSync(destPath)) {
                        fs.mkdirSync(destPath, { recursive: true });
                    }
                    copyRecursive(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };

        copyRecursive(assetsSrc, assetsDest);
    }
}

// 主函数
function main() {
    // 检查依赖 - 现在已经在脚本开始时完成，所以这里不再需要

    console.log('开始构建博客...');

    // 获取文章列表
    const articles = getArticles(isDraftVisible);
    console.log(`找到 ${articles.length} 篇文章`);

    // 创建输出目录
    const outputDir = path.join(__dirname, 'out'); // 修改为 out
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成主页
    console.log('正在生成主页...');
    const homeHtml = generateHomePage(articles);
    fs.writeFileSync(path.join(outputDir, 'index.html'), homeHtml);

    // 生成每篇文章的页面
    console.log('正在生成文章页面...');
    for (const article of articles) {
        const articleHtml = generateArticlePage(article.id);
        if (articleHtml) {
            const articleDir = path.join(outputDir, 'article', article.id); // 修改为 out
            if (!fs.existsSync(articleDir)) {
                fs.mkdirSync(articleDir, { recursive: true });
            }
            fs.writeFileSync(path.join(articleDir, 'index.html'), articleHtml);
            console.log(`已生成文章: ${article.title}`);
        }
    }

    // 生成404页面
    console.log('正在生成404页面...');
    const notFoundHtml = generateNotFoundPage();
    fs.writeFileSync(path.join(outputDir, '404.html'), notFoundHtml);

    // 复制静态资源
    console.log('正在复制静态文件...');
    copyStaticFiles();

    console.log('构建完成！输出目录: out'); // 更新提示
}

// 运行主函数
main();