const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Use the proxy middleware for your route
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;  // Get the URL from the query parameter

  // If no URL is provided, return a 400 error
  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided.');
  }

  try {
    // Validate the URL
    new URL(targetUrl);  // This will throw an error if the URL is invalid
  } catch (e) {
    return res.status(400).send('Error: Invalid URL.');
  }

  // Create the proxy middleware dynamically with the target URL
  const proxy = createProxyMiddleware({
    target: targetUrl, // Use the user-specified URL as the target
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': '', // Optional: Rewrites the proxy path
    },
  });

  // Apply the proxy
  proxy(req, res, next);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
