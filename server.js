const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { URL } = require('url');

const app = express();

// Middleware to proxy any URL via `/proxy?url=...`
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).send('Invalid URL');
  }

  const proxy = createProxyMiddleware({
    target: `${parsedUrl.protocol}//${parsedUrl.host}`,
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': parsedUrl.pathname + parsedUrl.search,
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('origin', parsedUrl.origin);
    },
    onError: (err, req, res) => {
      res.status(500).send('Proxy Error: ' + err.message);
    }
  });

  return proxy(req, res, next);
});

app.listen(3000, () => {
  console.log('Proxy server running on port 3000');
});
