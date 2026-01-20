import { handler as commentsHandler } from '../../api/comments.js';
import { handler as checkIpHandler } from '../../api/check-ip.js';
import { handler as healthHandler } from '../../api/health.js';
import { handler as deployStatusHandler } from '../../api/deploy-status.js';
import { handler as deployWebhookHandler } from '../../api/deploy-webhook.js';
import { handler as authenticateHandler } from '../../api/authenticate.js';
import { handler as commentsDataHandler } from '../../api/comments-data.js';
import { handler as postsHandler } from '../../api/posts.js';
import { handler as usersHandler } from '../../api/users.js';

// 将路径映射到对应的 API 处理函数
const handlers = {
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

// 主要的 API 包装函数
export async function handler(event, context) {
  const { httpMethod, path, body, headers, queryStringParameters } = event;

  // 提取 API 路径部分 (例如 /api/comments -> /comments)
  const apiPath = path.replace(/^\/api/, '');
  
  // 如果路径是根 API 路径，返回错误
  if (apiPath === '/' || apiPath === '') {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'API endpoint not found' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  // 查找对应的处理器
  const handlerFunction = handlers[apiPath];
  
  if (!handlerFunction) {
    // 尝试匹配更复杂的路径，例如 /api/users/register
    const pathParts = apiPath.split('/');
    if (pathParts[1] === 'users' && pathParts[2]) {
      if (handlers['/users']) {
        return await handlers['/users'](event, context);
      }
    }
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `API endpoint not found: ${apiPath}` }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  // 执行对应的处理器
  try {
    return await handlerFunction(event, context);
  } catch (error) {
    console.error('API Handler Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }
}