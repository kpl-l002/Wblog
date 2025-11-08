// api/check-ip.js
import { NextResponse } from 'next/server';

export default async function handler(request) {
  // 配置需要特殊处理的IP地址列表
  const adminIps = [
    '192.168.1.1', // 示例IP地址，请替换为实际需要检测的IP
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

  // 返回JSON响应
  return NextResponse.json({
    isAdminIp: isAdminIp,
    detectedIp: userIp,
    message: isAdminIp ? '管理员IP检测到' : '普通用户IP'
  }, {
    headers: {
      // 允许跨域请求
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'no-cache'
    },
    status: 200
  });
}

// 允许GET方法
export const config = {
  runtime: 'edge', // 使用Edge Runtime获取最佳性能
};
