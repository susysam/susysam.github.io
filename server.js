const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors'); // Include CORS middleware

const app = express();

// Enable CORS for all origins
app.use(cors());

// Root route handler
app.get('/', (req, res) => {
  res.send('Welcome to the Proxy Server. Please use /proxy?url=YOUR_URL to access a site.');
});

// Proxy route
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided.');
  }

  try {
    new URL(targetUrl);  // Validate URL
  } catch (e) {
    return res.status(400).send('Error: Invalid URL.');
  }

  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': '',
    },
  });

  proxy(req, res, next);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
