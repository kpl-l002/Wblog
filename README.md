# Wzz的个人博客 - Vercel部署版本

这是Wzz的个人博客项目，使用静态页面构建并通过Vercel进行部署。

## 项目特点

- 静态站点生成
- 通过Vercel实现一键部署
- 支持评论功能
- 管理后台
- 响应式设计

## 技术栈

- HTML/CSS/JavaScript
- Node.js
- PostgreSQL (数据库)
- Vercel (部署平台)

## 部署到Vercel

1. Fork此仓库
2. 在Vercel上创建新项目并关联此仓库
3. 在环境变量部分配置以下变量：

### 必需的环境变量

- `NODE_ENV`: 应用程序环境，设置为 `production`（生产环境）或 `development`（开发环境）
- `SITE_NAME`: 网站名称，例如 "Wzz的个人博客"
- `SITE_URL`: 网站的完整URL，例如 "https://your-blog.vercel.app"
- `JWT_SECRET`: JWT令牌密钥，至少32个字符的随机字符串，用于认证管理面板访问
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD_HASH`: 管理员密码的bcrypt哈希值
- `VERCEL_PROJECT_ID`: Vercel 项目ID，可在项目设置中找到
- `VERCEL_TOKEN`: Vercel API令牌，用于访问部署状态API
- `AURORA_POSTGRES_URL`: Amazon Aurora PostgreSQL数据库连接URL (推荐)
- `POSTGRES_URL`: 传统PostgreSQL数据库连接URL (备用选项)

### 可选的环境变量

- `APP_VERSION`: 应用程序版本号
- `HEALTH_CHECK_ENDPOINT`: 健康检查端点URL
- `LOG_LEVEL`: 日志级别，如 "info", "warn", "error"
- `TELEGRAM_BOT_TOKEN`: Telegram机器人令牌，用于接收部署通知
- `TELEGRAM_CHAT_ID`: Telegram聊天ID，用于发送部署通知
- `ADMIN_EMAIL`: 管理员邮箱地址
- `CONTACT_EMAIL`: 联系邮箱地址

## Aurora PostgreSQL 配置说明

本项目已优化支持Amazon Aurora PostgreSQL，具有以下优势：

- 高可用性和自动故障转移
- 可扩展的只读副本
- 更快的备份和恢复
- 与PostgreSQL完全兼容

要配置Aurora PostgreSQL，请：

1. 在AWS控制台创建Aurora PostgreSQL集群
2. 获取连接字符串
3. 将连接字符串设置为`AURORA_POSTGRES_URL`环境变量
4. 系统将优先使用Aurora连接，如果未设置则回退到`POSTGRES_URL`

连接字符串格式示例：
```
postgresql://username:password@aurora-cluster-endpoint.region.rds.amazonaws.com:5432/database_name
```

## 本地开发

1. 克隆仓库
2. 安装依赖：`npm install`
3. 设置环境变量
4. 启动本地服务器：`npm run dev`

## 贡献

欢迎提交Issue和Pull Request。
