// api/check-ip.js
// 使用Node.js Runtime替代Edge Runtime以兼容next/server模块

export default async function handler(request, response) {
  // 配置需要特殊处理的IP地址列表
  const adminIps = [
    '124.240.80.164', // 示例IP地址，请替换为实际需要检测的IP
    '127.0.0.1'    // 本地开发环境IP
  ];

  // 获取用户的IP地址 - Vercel特定的获取方式
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-client-ip') || 
                   'unknown';

  // 清理IP地址（移除可能的端口号或额外信息）
  const userIp = clientIp.trim().split(':')[0];

  // 检查是否为管理员IP
  const isAdminIp = adminIps.includes(userIp);

  // 设置响应头
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Content-Type', 'application/json');
  
  // 返回JSON响应
  response.status(200).json({
    isAdminIp: isAdminIp,
    detectedIp: userIp,
    message: isAdminIp ? '管理员IP检测到' : '普通用户IP'
  });
}

// 允许GET方法
export const config = {
  runtime: 'nodejs', // 使用Node.js Runtime以兼容标准Node.js模块
};
