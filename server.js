const express = require('express');
const httpProxyMiddleware = require('http-proxy-middleware');
const app = express();

app.use('/proxy', (req, res) => {
  const targetUrl = req.query.url;  // Get the URL from the query parameter

  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided.');
  }

  // Check if the URL is valid
  try {
    new URL(targetUrl);  // Validate the URL
  } catch (e) {
    return res.status(400).send('Error: Invalid URL.');
  }

  const proxy = httpProxyMiddleware({
    target: targetUrl,  // URL to be proxied
    changeOrigin: true,  // Adjust the origin of the request to the target
    pathRewrite: { '^/proxy': '' },  // Remove /proxy from the path
  });

  // Apply the proxy
  proxy(req, res, (err) => {
    if (err) {
      console.error('Proxy error:', err);
      return res.status(500).send('Internal Server Error');
    }
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Proxy server is running on port 3000');
});
