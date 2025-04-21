const express = require('express');
const httpProxyMiddleware = require('http-proxy-middleware');
const app = express();

// Middleware to handle the proxy
app.use('/proxy', (req, res) => {
  const targetUrl = req.query.url;  // Get the URL from the query parameter

  // If no URL is provided
  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided.');
  }

  // Proxy configuration
  const proxy = httpProxyMiddleware({
    target: targetUrl,  // URL to be proxied
    changeOrigin: true,  // Adjust the origin of the request to the target
    pathRewrite: { '^/proxy': '' },  // Remove /proxy from the path
  });

  // Apply the proxy
  proxy(req, res);
});

// Start the server
app.listen(3000, () => {
  console.log('Proxy server is running on port 3000');
});
