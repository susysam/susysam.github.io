const express = require('express');
const httpProxyMiddleware = require('http-proxy-middleware');

const app = express();

// Use the proxy middleware for your route
app.use('/proxy', httpProxyMiddleware({
  target: 'https://example.com', // Change to your target URL
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // Optional: Rewrites the proxy path
  },
}));

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
