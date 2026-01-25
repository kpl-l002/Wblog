const express = require('express');
const path = require('path');
const app = express();

// 设置静态文件夹
app.use(express.static(path.join(__dirname, 'public')));

// 对于所有其他路由，返回 index.html（适用于单页应用）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});