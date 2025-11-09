// api/comments.js
import { NextResponse } from 'next/server';
const { commentStore } = require('./comments-data');

// 安全验证函数
function validateCommentData(commentData) {
    const errors = [];
    
    if (!commentData.postId || typeof commentData.postId !== 'string') {
        errors.push('文章ID不能为空');
    }
    
    if (!commentData.author || commentData.author.trim().length === 0) {
        errors.push('昵称不能为空');
    } else if (commentData.author.length > 50) {
        errors.push('昵称长度不能超过50个字符');
    }
    
    if (!commentData.content || commentData.content.trim().length === 0) {
        errors.push('评论内容不能为空');
    } else if (commentData.content.length > 1000) {
        errors.push('评论内容长度不能超过1000个字符');
    }
    
    if (commentData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(commentData.email)) {
        errors.push('邮箱格式不正确');
    }
    
    return errors;
}

// 检查是否为管理员IP
function isAdminIP(request) {
    const adminIps = ['124.240.80.164', '127.0.0.1'];
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-client-ip') || 
                     'unknown';
    return adminIps.includes(clientIp.trim().split(':')[0]);
}

export async function OPTIONS(request) {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        status: 200
    });
}

// 获取评论
// GET /api/comments?postId=1&admin=true
// GET /api/comments?postId=1 (普通用户只能看到已审核的评论)
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const postId = url.searchParams.get('postId');
        const isAdmin = url.searchParams.get('admin') === 'true' && isAdminIP(request);
        
        if (!postId) {
            return NextResponse.json({
                error: '缺少文章ID参数',
                message: '请提供postId参数'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 管理员可以查看所有评论，普通用户只能查看已审核的评论
        const comments = await commentStore.getCommentsByPostId(postId, isAdmin);
        
        return NextResponse.json({
            success: true,
            postId: postId,
            comments: comments,
            isAdmin: isAdmin,
            total: comments.length
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('GET comments error:', error);
        return NextResponse.json({
            error: '获取评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

// 提交评论
// POST /api/comments
// Body: { postId, author, content, email, parentId }
export async function POST(request) {
    try {
        const body = await request.json();
        
        // 验证数据
        const validationErrors = validateCommentData(body);
        if (validationErrors.length > 0) {
            return NextResponse.json({
                error: '数据验证失败',
                messages: validationErrors
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        // 获取用户信息
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                         request.headers.get('x-client-ip') || 
                         'unknown';
        const userAgent = request.headers.get('user-agent') || '';
        
        // 检查是否为管理员
        const isAdmin = isAdminIP(request);
        
        // 创建评论数据
        const commentData = {
            postId: body.postId,
            author: body.author.trim(),
            content: body.content.trim(),
            email: body.email ? body.email.trim() : '',
            parentId: body.parentId || null,
            status: isAdmin ? 'approved' : 'pending', // 管理员评论自动审核
            ip: clientIp,
            userAgent: userAgent
        };
        
        // 添加评论
        const comment = await commentStore.addComment(commentData);
        
        return NextResponse.json({
            success: true,
            message: isAdmin ? '评论发布成功' : '评论已提交，等待审核',
            comment: comment,
            requiresApproval: !isAdmin
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 201
        });
    } catch (error) {
        console.error('POST comments error:', error);
        return NextResponse.json({
            error: '提交评论失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

// 管理员操作：审核评论
// PUT /api/comments?id=xxx&action=approve|reject|delete
export async function PUT(request) {
    try {
        // 检查管理员权限
        if (!isAdminIP(request)) {
            return NextResponse.json({
                error: '权限不足',
                message: '需要管理员权限'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 403
            });
        }
        
        const url = new URL(request.url);
        const commentId = url.searchParams.get('id');
        const action = url.searchParams.get('action');
        
        if (!commentId || !action) {
            return NextResponse.json({
                error: '参数不完整',
                message: '需要提供评论ID和操作类型'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 400
            });
        }
        
        let result;
        switch (action) {
            case 'approve':
                result = await commentStore.updateCommentStatus(commentId, 'approved');
                break;
            case 'reject':
                result = await commentStore.updateCommentStatus(commentId, 'rejected');
                break;
            case 'delete':
                result = await commentStore.deleteComment(commentId);
                break;
            default:
                return NextResponse.json({
                    error: '不支持的操作',
                    message: '操作类型必须是 approve、reject 或 delete'
                }, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    status: 400
                });
        }
        
        if (!result) {
            return NextResponse.json({
                error: '操作失败',
                message: '评论不存在'
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                status: 404
            });
        }
        
        return NextResponse.json({
            success: true,
            message: `评论${action === 'delete' ? '删除' : action === 'approve' ? '审核通过' : '已拒绝'}成功`,
            comment: result
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('PUT comments error:', error);
        return NextResponse.json({
            error: '操作失败',
            message: error.message
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        });
    }
}

export const config = {
    runtime: 'nodejs',
};
