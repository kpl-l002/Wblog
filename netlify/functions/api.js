// 导入 API 路由处理函数
import { handler as commentsHandler } from '../../api/comments.js';
import { handler as checkIpHandler } from '../../api/check-ip.js';
import { handler as healthHandler } from '../../api/health.js';
import { handler as deployStatusHandler } from '../../api/deploy-status.js';
import { handler as deployWebhookHandler } from '../../api/deploy-webhook.js';
import { handler as authenticateHandler } from '../../api/authenticate.js';
import { handler as commentsDataHandler } from '../../api/comments-data.js';
import { handler as postsHandler } from '../../api/posts.js';
import { handler as usersHandler } from '../../api/users.js';

// 定义路由映射
const routes = {
  '/comments': commentsHandler,
  '/check-ip': checkIpHandler,
  '/health': healthHandler,
  '/deploy-status': deployStatusHandler,
  '/deploy-webhook': deployWebhookHandler,
  '/authenticate': authenticateHandler,
  '/comments-data': commentsDataHandler,
  '/posts': postsHandler,
  '/users': usersHandler,
};

// 处理函数
export async function handler(event, context) {
  const { httpMethod, path, body, headers, queryStringParameters, rawUrl } = event;

  try {
    // 提取路径部分，移除 /api/ 前缀
    const routePath = path.replace('/api', '').replace(/\/$/, '') || '/';
    
    // 检查路由是否存在
    if (routes[routePath]) {
      // 调用对应的处理函数
      return await routes[routePath](event, context);
    } else {
      // 检查是否有更具体的路由，如 /api/users/register
      if (path.startsWith('/api/users')) {
        return await routes['/users'](event, context);
      }
      
      // 返回 404 错误
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Route not found: ${path}`,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      };
    }
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }
}