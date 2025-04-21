const express = require('express');
const httpProxyMiddleware = require('http-proxy-middleware');
const app = express();

// Middleware to handle the proxy
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;  // Get the URL from the query parameter

  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided.');
  }

  // Validate URL (optional)
  if (!/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send('Error: Invalid URL.');
  }

  // Set up the proxy
  httpProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
  })(req, res, next);
});

// Start the server
app.listen(3000, () => {
  console.log('Proxy server is running on port 3000');
});
