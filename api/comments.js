// api/comments.js
import { NextResponse } from 'next/server';

export async function OPTIONS(request) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    status: 200
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const postId = url.searchParams.get('postId');
    
    return NextResponse.json({
      message: 'Comments API is ready',
      postId: postId,
      comments: [] // Empty array for now
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      status: 500
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      message: 'Comment submission API is ready',
      comment: body,
      id: Date.now(),
      date: new Date().toISOString()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      status: 201
    });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
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
  runtime: 'nodejs18.x',
};
