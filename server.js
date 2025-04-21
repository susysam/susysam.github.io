const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Use the proxy middleware for your route
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
