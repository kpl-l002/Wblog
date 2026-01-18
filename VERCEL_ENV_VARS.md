# Vercel 环境变量配置指南

本文档详细介绍了在 Vercel 上部署个人博客项目时所需配置的环境变量。

## 必需的环境变量

### 基础配置
- `NODE_ENV`: 应用程序环境，设置为 `production`（生产环境）或 `development`（开发环境）
- `SITE_NAME`: 网站名称，例如 "Wzz的个人博客"
- `SITE_URL`: 网站的完整URL，例如 "https://your-blog.vercel.app"

### 认证与安全
- `JWT_SECRET`: JWT令牌密钥，至少32个字符的随机字符串，用于认证管理面板访问
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD_HASH`: 管理员密码的bcrypt哈希值

### 数据库配置
- `AURORA_POSTGRES_URL`: Amazon Aurora PostgreSQL数据库连接URL (推荐)
- `POSTGRES_URL`: 传统PostgreSQL数据库连接URL (备用选项)

> 注意: 如果设置了 `AURORA_POSTGRES_URL`，系统将优先使用Aurora连接；否则回退到 `POSTGRES_URL`。

### Vercel 集成
- `VERCEL_PROJECT_ID`: Vercel 项目ID，可在项目设置中找到
- `VERCEL_TOKEN`: Vercel API令牌，用于访问部署状态API

## 推荐的环境变量

### 部署与监控
- `APP_VERSION`: 应用程序版本号
- `HEALTH_CHECK_ENDPOINT`: 健康检查端点URL
- `LOG_LEVEL`: 日志级别，如 "info", "warn", "error"
- `DEPLOYMENT_TIMEOUT`: 部署超时时间（毫秒），如 300000（5分钟)

### 数据库监控
- `DB_CONNECTION_TIMEOUT`: 数据库连接超时时间（毫秒），如 10000
- `DB_MAX_CONNECTIONS`: 数据库最大连接数，如 20
- `DB_IDLE_TIMEOUT`: 数据库连接空闲超时时间（毫秒），如 30000

### 通知与集成
- `TELEGRAM_BOT_TOKEN`: Telegram机器人令牌，用于接收部署通知
- `TELEGRAM_CHAT_ID`: Telegram聊天ID，用于发送部署通知
- `DEPLOYMENT_NOTIFICATION_WEBHOOK`: 部署通知的Webhook URL

### 邮箱与联系
- `ADMIN_EMAIL`: 管理员邮箱地址
- `CONTACT_EMAIL`: 联系邮箱地址

## 环境变量设置步骤

1. 登录 Vercel 控制台
2. 选择你的项目
3. 进入 Settings > Environment Variables
4. 添加以下环境变量：

### 生产环境配置示例
```
NODE_ENV=production
SITE_NAME=Wzz的个人博客
SITE_URL=https://wzz-blog.vercel.app
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_32_chars_minimum
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$8K5pJyCx3/ZL9o7EQKaINO4iQdFBq6XbLnDbH3WNbBl3zYpUHLWDG
VERCEL_PROJECT_ID=prj_******
VERCEL_TOKEN=your_vercel_token_here
AURORA_POSTGRES_URL=postgresql://username:password@aurora-cluster-endpoint:5432/dbname
POSTGRES_URL=postgresql://... # 备用连接
APP_VERSION=1.0.0
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
ADMIN_EMAIL=admin@example.com
LOG_LEVEL=info
DB_CONNECTION_TIMEOUT=10000
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

### 预览环境配置示例
```
NODE_ENV=preview
SITE_NAME=Wzz的个人博客 - 预览版
SITE_URL=https://wzz-blog-git-preview-username.vercel.app
JWT_SECRET=preview_secret_different_from_prod
ADMIN_USERNAME=preview_admin
ADMIN_PASSWORD_HASH=$2b$10$8K5pJyCx3/ZL9o7EQKaINO4iQdFBq6XbLnDbH3WNbBl3zYpUHLWDG
VERCEL_PROJECT_ID=prj_******
VERCEL_TOKEN=your_vercel_token_here
POSTGRES_URL=postgresql://...
APP_VERSION=1.0.0-preview
LOG_LEVEL=info
```

## 安全注意事项

1. **绝不在代码中硬编码敏感信息**：所有密码、密钥和令牌都应通过环境变量设置
2. **不同环境使用不同密钥**：生产和预览环境的JWT密钥应该不同
3. **定期更换密钥**：特别是JWT_SECRET和Vercel API令牌
4. **使用强密码**：管理员密码应足够复杂，并使用bcrypt生成哈希
5. **限制访问权限**：只向需要的团队成员授予环境变量访问权限

## 生成环境变量值的方法

### 生成JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 生成密码哈希
使用项目中的脚本：
```bash
node scripts/generate-password-hash.js your_password
```

### 获取Vercel项目ID
在Vercel仪表板的项目设置页面查找，通常格式为 `prj_` 开头的字符串。

### 获取Vercel Token
1. 访问 https://vercel.com/account/tokens
2. 点击 "Create a New Token"
3. 保存生成的令牌

## 验证环境变量配置

部署后，你可以通过以下方式验证环境变量是否配置正确：

1. 访问健康检查端点：`https://your-domain.vercel.app/api/health`
2. 查看部署状态：`https://your-domain.vercel.app/api/deploy-status`
3. 检查环境变量验证脚本的输出：运行 `npm run validate-env`

## 故障排除

### 常见错误及解决方案

1. **"Missing required environment variables" 错误**
   - 确认所有必需的环境变量都已在Vercel控制台中设置

2. **"Invalid JWT Secret" 警告**
   - 确保JWT_SECRET至少32个字符长

3. **数据库连接失败**
   - 确认POSTGRES_URL格式正确且有访问权限

4. **管理员登录失败**
   - 检查ADMIN_PASSWORD_HASH是否为有效的bcrypt哈希值

### 调试提示

- 在开发环境中，可以临时在 `.env.local` 文件中设置环境变量进行测试
- 使用 `npm run validate-secure-env` 验证安全相关的环境变量
- 检查 `api/health` 的响应以获取环境变量验证详情