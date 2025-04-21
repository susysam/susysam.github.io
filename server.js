const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Default route for root to prevent "Cannot GET /"
app.get('/', (req, res) => {
  res.send('Proxy server is running. Use /proxy to access the proxied content.');
});

// Proxy route
app.use('/proxy', createProxyMiddleware({
  target: 'https://example.com', // Change this to your target URL
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // Optional: Rewrites the proxy path
  },
}));

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
