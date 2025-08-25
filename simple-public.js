const express = require('express');
const path = require('path');
const app = express();

// 允許所有來源的CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 提供靜態檔案服務
app.use('/liff', express.static(path.join(__dirname, 'liff-app/dist')));

// 處理SPA路由 - 所有/liff下的路由都回傳index.html
app.get('/liff/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'liff-app/dist/index.html'));
});

// 主頁面路由
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 LINE BOT 管理介面</h1>
    <h2>📱 LIFF 應用程式</h2>
    <p><a href="/liff" target="_blank">開啟 LIFF 應用程式</a></p>
    <hr>
    <p>服務運行中...</p>
    <p>時間: ${new Date().toLocaleString('zh-TW')}</p>
  `);
});

// 代理webhook到本地3016端口
app.all('/webhook', (req, res) => {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: 3016,
    path: '/webhook',
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });

  req.pipe(proxyReq, { end: true });
});

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`✅ 簡易公共服務器運行在端口 ${PORT}`);
  console.log(`🌐 LIFF App: http://localhost:${PORT}/liff`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📱 主頁: http://localhost:${PORT}`);
});