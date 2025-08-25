const http = require('http');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 代理所有請求到本地3016端口
const proxy = createProxyMiddleware({
  target: 'http://localhost:3016',
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(500).send('代理錯誤: ' + err.message);
  }
});

app.use('/', proxy);

const PORT = process.env.PROXY_PORT || 8080;
app.listen(PORT, () => {
  console.log(`🔄 代理服務器運行在端口 ${PORT}`);
  console.log(`📡 轉發請求到 http://localhost:3016`);
  console.log(`🌐 您可以使用任何隧道服務連接到端口 ${PORT}`);
});