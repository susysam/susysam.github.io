const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: No URL provided in ?url=');
  }

  try {
    new URL(targetUrl); // Validate
  } catch (err) {
    return res.status(400).send('Error: Invalid URL.');
  }

  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      const urlObj = new URL(req.originalUrl, `http://${req.headers.host}`);
      return urlObj.searchParams.get('path') || '/';
    },
    router: (req) => {
      const urlObj = new URL(req.originalUrl, `http://${req.headers.host}`);
      return urlObj.searchParams.get('url');
    },
    onError(err, req, res) {
      console.error('Proxy error:', err);
      res.status(500).send('Internal Server Error: Proxy failed.');
    }
  });

  proxy(req, res, next);
});

app.listen(3000, () => {
  console.log('Proxy server is running on port 3000');
});
