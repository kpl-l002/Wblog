const axios = require('axios');

// 发送到Telegram
async function sendTelegramNotification(message, chatId = null) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken) {
    console.warn('Telegram机器人令牌未配置');
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId || defaultChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    return response.data.ok;
  } catch (error) {
    console.error('Telegram通知发送失败:', error.message);
    return false;
  }
}

// 发送到Slack（可选）
async function sendSlackNotification(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return false;
  }

  try {
    const response = await axios.post(webhookUrl, {
      text: message,
      username: '部署机器人',
      icon_emoji: ':rocket:'
    });
    
    return response.status === 200;
  } catch (error) {
    console.error('Slack通知发送失败:', error.message);
    return false;
  }
}

// 格式化部署消息
function formatDeploymentMessage(payload) {
  const deployment = payload.deployment;
  const project = payload.project;
  
  const statusEmoji = {
    'READY': '✅',
    'BUILDING': '🔄',
    'ERROR': '❌',
    'CANCELED': '⏹️',
    'INITIALIZING': '⚡'
  };

  const targetEmoji = {
    'production': '🚀',
    'preview': '👀',
    'staging': '🧪'
  };

  const emoji = statusEmoji[deployment.state] || 'ℹ️';
  const targetIcon = targetEmoji[deployment.target] || '📦';
  
  const commitMessage = deployment.meta?.gitCommitMessage || '手动部署';
  const commitAuthor = deployment.meta?.gitCommitAuthorName || '未知作者';
  const commitSha = deployment.meta?.gitCommitSha ? 
    deployment.meta.gitCommitSha.substring(0, 7) : 'N/A';

  return `
${emoji} <b>部署状态更新</b> ${targetIcon}

📁 <b>项目:</b> ${project.name}
🌐 <b>环境:</b> ${deployment.target}
📊 <b>状态:</b> ${deployment.state}
🔗 <b>链接:</b> <a href="${deployment.url}">${deployment.url}</a>

📝 <b>提交信息:</b> ${commitMessage}
👤 <b>提交者:</b> ${commitAuthor}
🔑 <b>提交ID:</b> <code>${commitSha}</code>

⏰ <b>时间:</b> ${new Date().toLocaleString('zh-CN')}
  `.trim();
}

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { payload } = req.body;
    
    if (!payload) {
      return res.status(400).json({ error: '缺少payload数据' });
    }

    // 验证Webhook签名（如果设置了）
    const webhookSecret = process.env.DEPLOY_WEBHOOK_SECRET;
    if (webhookSecret) {
      // 这里可以添加签名验证逻辑
      console.log('Webhook签名验证已启用');
    }

    const deployment = payload.deployment;
    const project = payload.project;

    // 只处理特定状态的部署
    const notifyStates = ['READY', 'ERROR', 'CANCELED'];
    if (!notifyStates.includes(deployment.state)) {
      return res.status(200).json({ 
        message: '状态无需通知', 
        status: 'ignored' 
      });
    }

    // 格式化消息
    const message = formatDeploymentMessage(payload);
    
    // 发送通知
    const telegramSent = await sendTelegramNotification(message);
    const slackSent = await sendSlackNotification(message);

    console.log('部署通知发送结果:', {
      deploymentId: deployment.id,
      state: deployment.state,
      target: deployment.target,
      telegram: telegramSent ? '成功' : '失败',
      slack: slackSent ? '成功' : '失败'
    });

    res.status(200).json({
      success: true,
      notifications: {
        telegram: telegramSent,
        slack: slackSent
      },
      deployment: {
        id: deployment.id,
        state: deployment.state,
        url: deployment.url
      }
    });

  } catch (error) {
    console.error('Webhook处理错误:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Webhook处理失败',
        details: process.env.NODE_ENV === 'development' ? error.message : '内部错误'
      }
    });
  }
};