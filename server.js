const express = require('express');
const httpProxyMiddleware = require('http-proxy-middleware');
const app = express();

// Middleware to handle the proxy
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;  // Get the URL from the query parameter

  if (!targetUrl) {
    console.error("Error: No URL provided.");
    return res.status(400).send('Error: No URL provided.');
  }

  // Validate URL (optional)
  if (!/^https?:\/\//.test(targetUrl)) {
    console.error("Error: Invalid URL format:", targetUrl);
    return res.status(400).send('Error: Invalid URL.');
  }

  console.log("Proxying to:", targetUrl);

  // Set up the proxy with enhanced options
  const proxy = httpProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,   // Adjust the origin of the request to the target
    pathRewrite: { '^/proxy': '' }, // Remove /proxy from the path
    onProxyReq: (proxyReq, req, res) => {
      console.log('Proxying request with headers:', proxyReq.getHeaders());
      proxyReq.setHeader('X-Forwarded-Host', req.get('Host'));
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).send('Internal Server Error');
    }
  });

  // Apply the proxy middleware
  proxy(req, res, next);
});

// Start the server
app.listen(3000, () => {
  console.log('Proxy server is running on port 3000');
});
