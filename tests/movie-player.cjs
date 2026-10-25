// Isolated player regression: no real media, Firebase session or saved user data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let browser, server;
(async () => {
  server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + name);
    if (!target.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      const data = fs.readFileSync(target);
      res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base && url.pathname === '/firebase-config.js') return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.origin === base) return route.continue();
    if (url.hostname === 'vidsrc.me' || url.hostname === 'zstream.mov') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test provider</title><p>Test player ready</p>' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(base + '/movie+tv.html');
  await page.getByRole('button', { name: 'Movie', exact: true }).click();
  await page.getByLabel('IMDb title ID').fill('tt1234567');
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const popup = await popupEvent;
  await popup.locator('#playerFrame').waitFor();
  assert.equal(await popup.locator('#playerFrame').getAttribute('sandbox'), null);
  assert.equal(await popup.locator('#playerFrame').getAttribute('src'), 'https://vidsrc.me/embed/movie?imdb=tt1234567');
  assert.equal(await popup.locator('#playerFrame').getAttribute('referrerpolicy'), 'no-referrer');
  assert.notEqual(await popup.locator('#playerFrame').getAttribute('allowfullscreen'), null);
  assert.equal(await popup.evaluate(() => window.opener === null), true);
  await popup.frameLocator('#playerFrame').getByText('Test player ready').waitFor();
  assert.equal(await popup.locator('#directLink').getAttribute('href'), 'https://vidsrc.me/embed/movie?imdb=tt1234567');
  await popup.close();
  await page.reload();
  await page.getByRole('button', { name: 'Extras', exact: true }).click();
  await page.getByRole('button', { name: 'Cinecat', exact: true }).click();
  assert.equal(await page.locator('#targetIframe').getAttribute('sandbox'), null);
  await page.frameLocator('#targetIframe').getByText('Test player ready').waitFor();
  const secondPopupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open in about:blank', exact: true }).click();
  const secondPopup = await secondPopupEvent;
  await secondPopup.frameLocator('#playerFrame').getByText('Test player ready').waitFor();
  assert.equal(await secondPopup.locator('#playerFrame').getAttribute('sandbox'), null);
  await secondPopup.close();
  assert.equal(await page.evaluate(() => openAboutBlankWindow('javascript:alert(1)')), false);
  assert.equal(await context.pages().length, 1);
  console.log('PASS: Movie playback popup, Extras inline/popup, fullscreen, direct fallback, opener isolation and unsafe-URL rejection. Test providers only.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); server?.close();
});
