/**
 * Aurora PostgreSQL 数据库迁移脚本
 * 用于初始化Aurora数据库中的表结构
 */

import { auroraPool } from '../db/aurora-database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQL迁移文件路径
const migrationDir = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
  try {
    console.log('开始执行Aurora PostgreSQL数据库迁移...');
    
    const client = await auroraPool.connect();
    
    try {
      // 创建posts表
      console.log('创建posts表...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          date DATE NOT NULL,
          author VARCHAR(100) NOT NULL,
          image VARCHAR(500),
          excerpt TEXT,
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'draft',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建comments表
      console.log('创建comments表...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          post_id VARCHAR(255) NOT NULL,
          author VARCHAR(50) NOT NULL,
          email VARCHAR(100),
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          parent_id INTEGER,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建admins表
      console.log('创建admins表...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建users表
      console.log('创建users表...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          avatar_url VARCHAR(500),
          bio TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建索引以提高查询性能
      console.log('创建索引...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
      `);
      
      console.log('Aurora PostgreSQL数据库迁移完成！');
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('数据库迁移过程中出现错误:', error);
    throw error;
  }
}

// 执行迁移
if (process.argv[2] === '--migrate') {
  runMigrations()
    .then(() => {
      console.log('迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移脚本执行失败:', error);
      process.exit(1);
    });
}

export { runMigrations };