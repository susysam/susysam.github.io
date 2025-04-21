const express = require('express');
const httpProxy = require('http-proxy-middleware');
const app = express();

// Set up the proxy middleware
app.use('/proxy', httpProxy({
  target: 'https://example.com', // Target website you want to proxy
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // Remove the '/proxy' part in the request URL
  },
}));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
