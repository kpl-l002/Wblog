// api/posts.js - 帖子管理API
import { requireAdminAuth, validateInputs, sanitizeInput, sendResponse } from './middleware';
import { auroraPostDB } from '../db/aurora-database.js';
import { authenticate } from './middleware.js';

// 错误处理包装器
function withErrorHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API错误:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  };
}

// 获取文章列表
const getPosts = withErrorHandler(async (req, res) => {
  // 解析查询参数
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category || '';
  const status = req.query.status || 'published';
  const search = req.query.search || '';

  try {
    const posts = await auroraPostDB.getAllPosts({
      page,
      limit,
      category,
      status,
      search
    });

    res.json({
      success: true,
      data: posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(posts.length / limit), // 简化的分页计算，实际应用中应该从数据库获取总数
        totalPosts: posts.length
      }
    });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取文章列表失败' 
    });
  }
});

// 获取单篇文章
const getPost = withErrorHandler(async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少文章ID' 
    });
  }

  try {
    const post = await auroraPostDB.getPostById(id);

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: '文章不存在' 
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取文章详情失败' 
    });
  }
});

// 创建文章 - 需要认证
const createPost = withErrorHandler(async (req, res) => {
  if (!authenticate(req, res)) {
    return res.status(401).json({ 
      success: false, 
      error: '未授权访问' 
    });
  }

  const { title, category, author, image, excerpt, content, status } = req.body;

  // 验证必填字段
  if (!title || !category || !author || !content) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少必需字段' 
    });
  }

  try {
    const newPost = await auroraPostDB.createPost({
      title,
      category,
      author,
      image: image || '',
      excerpt: excerpt || '',
      content,
      status: status || 'draft'
    });

    res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '创建文章失败' 
    });
  }
});

// 更新文章 - 需要认证
const updatePost = withErrorHandler(async (req, res) => {
  if (!authenticate(req, res)) {
    return res.status(401).json({ 
      success: false, 
      error: '未授权访问' 
    });
  }

  const { id } = req.query;
  const { title, category, author, image, excerpt, content, status } = req.body;

  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少文章ID' 
    });
  }

  try {
    const updatedPost = await auroraPostDB.updatePost(id, {
      title,
      category,
      author,
      image,
      excerpt,
      content,
      status
    });

    if (!updatedPost) {
      return res.status(404).json({ 
        success: false, 
        error: '文章不存在' 
      });
    }

    res.json({
      success: true,
      data: updatedPost
    });
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '更新文章失败' 
    });
  }
});

// 删除文章 - 需要认证
const deletePost = withErrorHandler(async (req, res) => {
  if (!authenticate(req, res)) {
    return res.status(401).json({ 
      success: false, 
      error: '未授权访问' 
    });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少文章ID' 
    });
  }

  try {
    const deletedPost = await auroraPostDB.deletePost(id);

    if (!deletedPost) {
      return res.status(404).json({ 
        success: false, 
        error: '文章不存在' 
      });
    }

    res.json({
      success: true,
      message: '文章删除成功'
    });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '删除文章失败' 
    });
  }
});

// 导出API函数
export {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost
};

// 验证帖子数据
function validatePostData(postData) {
  const errors = [];
  
  if (!postData.title || postData.title.trim().length === 0) {
    errors.push('标题不能为空');
  } else if (postData.title.length > 200) {
    errors.push('标题长度不能超过200个字符');
  }
  
  if (!postData.category || postData.category.trim().length === 0) {
    errors.push('分类不能为空');
  }
  
  if (!postData.excerpt || postData.excerpt.trim().length === 0) {
    errors.push('摘要不能为空');
  } else if (postData.excerpt.length > 500) {
    errors.push('摘要长度不能超过500个字符');
  }
  
  if (!postData.content || postData.content.trim().length === 0) {
    errors.push('内容不能为空');
  } else if (postData.content.length > 50000) {
    errors.push('内容长度不能超过50000个字符');
  }
  
  if (postData.author && postData.author.length > 50) {
    errors.push('作者名称长度不能超过50个字符');
  }
  
  return errors;
}

// GET /api/posts - 获取帖子列表
export async function GET(req, res) {
  try {
    // 从URL参数获取查询条件
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // 检查是否为管理员，如果不是则强制设置状态为'published'
    const authResult = await checkAdminAuth(req);
    if (!authResult.authenticated) {
      // 普通用户只能看到已发布的帖子
      status = 'published';
    }
    
    // 获取帖子列表
    const posts = await postDB.getAllPosts({
      category,
      status,
      page,
      limit,
      search
    });
    
    // 获取帖子总数
    const totalPosts = await postDB.getTotalPosts({ category, status });
    const totalPages = Math.ceil(totalPosts / limit);
    
    return new Response(JSON.stringify({
      success: true,
      posts: posts,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalPosts: totalPosts,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('获取帖子列表失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取帖子列表失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// POST /api/posts - 创建新帖子（需要管理员权限）
export async function POST(req, res) {
  try {
    // 检查管理员权限
    const authResult = await checkAdminAuth(req);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 解析请求体
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }
    
    let postData;
    try {
      postData = JSON.parse(body);
    } catch (parseError) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的JSON数据'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 验证数据
    const validationErrors = validatePostData(postData);
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '数据验证失败',
        details: validationErrors
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 创建新帖子
    const newPost = await postDB.createPost({
      title: sanitizeInput(postData.title),
      category: sanitizeInput(postData.category),
      author: sanitizeInput(postData.author || 'Anonymous'),
      image: postData.image || '',
      excerpt: sanitizeInput(postData.excerpt),
      content: sanitizeInput(postData.content),
      status: postData.status || 'draft' // 默认为草稿状态
    });
    
    return new Response(JSON.stringify({
      success: true,
      post: newPost
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('创建帖子失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '创建帖子失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// PUT /api/posts/:id - 更新帖子（需要管理员权限）
export async function PUT(req, res) {
  try {
    // 检查管理员权限
    const authResult = await checkAdminAuth(req);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 从URL获取帖子ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const postId = parseInt(pathParts[pathParts.length - 1]);
    
    if (!postId) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少帖子ID'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 查找帖子
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      return new Response(JSON.stringify({
        success: false,
        error: '帖子不存在'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 解析请求体
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }
    
    let postData;
    try {
      postData = JSON.parse(body);
    } catch (parseError) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的JSON数据'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 验证数据
    const validationErrors = validatePostData(postData);
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '数据验证失败',
        details: validationErrors
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 更新帖子
    const updatedPost = await postDB.updatePost(postId, {
      title: sanitizeInput(postData.title),
      category: sanitizeInput(postData.category),
      author: sanitizeInput(postData.author),
      image: postData.image || '',
      excerpt: sanitizeInput(postData.excerpt),
      content: sanitizeInput(postData.content),
      status: postData.status
    });
    
    return new Response(JSON.stringify({
      success: true,
      post: updatedPost
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('更新帖子失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新帖子失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// DELETE /api/posts/:id - 删除帖子（需要管理员权限）
export async function DELETE(req, res) {
  try {
    // 检查管理员权限
    const authResult = await checkAdminAuth(req);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 从URL获取帖子ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const postId = parseInt(pathParts[pathParts.length - 1]);
    
    if (!postId) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少帖子ID'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 删除帖子
    const result = await postDB.deletePost(postId);
    
    return new Response(JSON.stringify({
      success: true,
      message: result.message
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('删除帖子失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除帖子失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 检查管理员权限的辅助函数
async function checkAdminAuth(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false };
  }
  
  const token = authHeader.substring(7);
  
  try {
    // 在实际应用中，应该解析和验证JWT token
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { authenticated: payload.role === 'admin', user: payload.user };
  } catch (e) {
    return { authenticated: false };
  }
}

// 默认导出以支持不同导入方式
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await GET(req, res);
  } else if (req.method === 'POST') {
    return await POST(req, res);
  } else if (req.method === 'PUT') {
    return await PUT(req, res);
  } else if (req.method === 'DELETE') {
    return await DELETE(req, res);
  } else if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } else {
    return new Response(JSON.stringify({ error: '方法不允许' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}