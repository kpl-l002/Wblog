# Wzz的个人博客 - Netlify 部署版本

这是一个基于静态站点构建、通过 Netlify 部署的轻量级博客系统，具备自动化部署流程和安全验证机制。

## 项目结构

```
.
├── api/                    # API 接口定义
│   ├── authenticate.js     # 身份验证接口
│   ├── check-ip.js         # IP 检查接口
│   ├── comments-data.js    # 评论数据接口
│   ├── comments.js         # 评论接口
│   ├── deploy-status.js    # 部署状态接口
│   ├── deploy-webhook.js   # 部署 Webhook 接口
│   ├── health.js           # 健康检查接口
│   ├── middleware.js       # 中间件
│   ├── posts.js            # 文章接口
│   └── users.js            # 用户接口
├── css/                    # 样式文件
├── js/                     # JavaScript 文件
├── db/                     # 数据库相关文件
├── scripts/                # 构建和部署脚本
├── netlify/                # Netlify 函数
│   └── functions/          # Netlify Functions
├── build.js                # 构建脚本
├── index.html              # 主页
├── admin.html              # 管理后台
├── vercel.json             # Vercel 配置（保留但不再使用）
├── netlify.toml            # Netlify 配置
└── package.json            # 项目配置
```

## 部署到 Netlify

### 方法一：一键部署

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=your-repo-url)

### 方法二：手动部署

1. 安装 Netlify CLI:
```bash
npm install -g netlify-cli
```

2. 构建项目:
```bash
npm run build
```

3. 登录 Netlify:
```bash
netlify login
```

4. 部署到 Netlify:
```bash
netlify deploy
```

5. 部署到生产环境:
```bash
netlify deploy --prod
```

## 环境变量配置

在 Netlify 仪表板中配置以下环境变量：

- `JWT_SECRET` - JWT 加密密钥
- `PG_HOST` - PostgreSQL 数据库主机
- `PG_USER` - PostgreSQL 用户名
- `PG_PASSWORD` - PostgreSQL 密码
- `PG_DATABASE` - PostgreSQL 数据库名
- `ADMIN_PASSWORD` - 管理员密码（经过哈希处理）

## 开发

1. 安装依赖:
```bash
npm install
```

2. 启动开发服务器:
```bash
npm run dev
```

3. 运行构建:
```bash
npm run build
```

## 从 Vercel 迁移到 Netlify

1. **创建新配置文件**: 项目中已包含 `netlify.toml` 配置文件，用于 Netlify 部署。

2. **API 适配**: 
   - Vercel 的 API 路由位于 [/api/*](file:///api/*) 目录
   - 已创建 Netlify Functions 适配器，将 API 请求映射到相应处理函数

3. **构建命令**: 保持 `node build.js` 不变

4. **发布目录**: 保持 `out` 目录不变

5. **函数目录**: 配置为 `netlify/functions`

6. **重定向和头信息**: 已在 `netlify.toml` 中配置相应的重定向和 HTTP 头

## 功能特性

- 博客文章展示
- 用户评论功能（支持后端存储与校验）
- 后台管理页面
- 健康检查与部署状态查询
- 自动化部署与环境验证
- IP 检查、JWT 认证等安全机制

## 技术栈

- 静态站点 + Serverless API 架构
- Node.js 后端服务
- PostgreSQL 数据库
- Netlify Functions 处理 API 请求
- Netlify 托管静态资源
