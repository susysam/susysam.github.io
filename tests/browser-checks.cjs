// Isolated browser contexts and a fake Firebase adapter: no real accounts or cloud writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'test-results');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const mock = `
const listeners = new Set();
const state = {phase: 'local', user: null, available: true, message: 'Sign in to enable cloud saving.'};
function emit(update) {Object.assign(state, update); listeners.forEach(fn=>fn({...state}));}
window.__testCloud = {emit};
window.siteCloud = {
 get state(){return {...state}}, subscribe(fn){listeners.add(fn);fn({...state});return ()=>listeners.delete(fn)},
 async login(email,password){await new Promise(r=>setTimeout(r,100));if(password==='bad-password'){const e=new Error();e.code='auth/invalid-credential';throw e}sessionStorage.setItem('test-user',email);emit({user:{email,uid:'test-only'},phase:'synced',message:'Synced'})},
 async signup(email,password){return this.login(email,password)},
 async resetPassword(email){window.__resetRequested=email},
 async logout(){sessionStorage.removeItem('test-user');emit({user:null,phase:'local',message:'Sign in to enable cloud saving.'})},
 async retry(){emit({phase:'synced',message:'Synced'})},
 async useCloud(){emit({phase:'synced',message:'Synced'})}, async useDevice(){emit({phase:'synced',message:'Synced'})},
 async syncNow(){}, async beforeDeleteAll(){}
};
const email=sessionStorage.getItem('test-user');if(email)emit({user:{email,uid:'test-only'},phase:'synced',message:'Synced'});
window.dispatchEvent(new Event('site-cloud-ready'));
`;
let browser, server;
let checks = 0;
function check(value, message) { assert(value, message); checks++; }
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { const data=fs.readFileSync(target); res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'text/plain' }); res.end(data); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/firebase-config.js' && url.origin === base) return route.fulfill({ contentType: 'text/javascript', body: mock });
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(page.url() + ': ' + error.stack));
  await page.goto(base); await page.locator('[data-account-submit]:enabled').waitFor();
  check(await page.getByRole('heading', { name: 'Welcome to susysam' }).count() === 1, 'plain welcome heading');
  check(await page.locator('[data-cloud-indicator]').getAttribute('data-tone') === 'bad', 'signed-out cloud is not green');
  check(await page.getByRole('button', { name: 'Log out', exact: true }).count() === 0, 'no welcome logout');
  await page.screenshot({ path: path.join(artifacts, 'welcome-desktop.png'), fullPage: true });
  await page.getByLabel('Email', {exact:true}).fill('test@example.test');
  await page.getByLabel('Password', {exact:true}).fill('bad-password');
  await page.getByRole('button', {name:'Log in',exact:true}).click();
  await page.locator('[data-account-feedback]').filter({hasText:/email|password|credentials/i}).waitFor(); checks++;
  await page.getByRole('button', {name:'Forgot password?'}).click();
  await page.getByText('If an account exists for that email, a password reset message will arrive shortly.').waitFor(); checks++;
  check(await page.evaluate(()=>window.__resetRequested) === 'test@example.test', 'reset calls adapter with entered email');
  await page.getByRole('button', {name:'Create account',exact:true}).click();
  check(await page.getByLabel('Password',{exact:true}).getAttribute('autocomplete') === 'new-password', 'signup mode');
  await page.getByLabel('Password',{exact:true}).fill('test-only-password');
  await page.getByRole('button', {name:'Create account',exact:true}).click();
  await page.getByText('Logged in as').waitFor(); checks++;
  check(await page.locator('[data-signed-out]').isHidden(), 'form hides after auth event');
  for (const phase of ['pending','saving','error','conflict']) {
    await page.evaluate(phase=>window.__testCloud.emit({phase,message:'Test '+phase}), phase);
    check(await page.locator('[data-cloud-indicator]').getAttribute('data-tone') !== 'good', phase+' not green');
  }
  check(await page.getByRole('button',{name:'Use cloud data',exact:true}).isVisible(), 'conflict controls retained');
  await page.getByRole('button',{name:'Use cloud data',exact:true}).click();
  check(await page.locator('[data-cloud-indicator]').getAttribute('data-tone') === 'good', 'confirmed sync green');
  await page.getByRole('link', {name:'Continue to site'}).click();
  await page.getByRole('button',{name:'Log out',exact:true}).waitFor();
  check(await page.locator('.navbar').innerText().then(text=>/Movie \+ TV\s+Log out/.test(text)), 'logout next to Movie + TV');
  check(await page.locator('[data-account-logout]').evaluate(el=>getComputedStyle(el).backgroundColor) !== await page.locator('.navbar a').first().evaluate(el=>getComputedStyle(el).backgroundColor), 'logout color differs from navigation');
  check(await page.locator('[data-timezone-select]').count() === 0, 'Home clock is display-only');
  check(await page.locator('#time-sub').innerText().then(text=>/Eastern/.test(text)), 'Home displays timezone');
  check(await page.locator('.window-dots').count() === 0, 'decorative dots removed');
  await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
  await page.goto(base+'/settings.html#account');
  await page.locator('#settings-account:not([hidden])').waitFor();
  check(await page.locator('.settings-sidebar [data-category="account"]').count() === 0, 'account section omitted only from sidebar');
  check(await page.locator('[data-account-form]').count() === 0, 'Settings has no second sign-in form');
  check(await page.locator('#settings-account').isVisible(), 'account deep link works when signed in');
  await page.getByRole('link',{name:'Your Data',exact:true}).click();
  check(await page.locator('[data-device-status]').getAttribute('data-tone') === 'good', 'device storage probe succeeded');
  check(await page.locator('[data-account-status]').innerText().then(text=>text.includes('Signed in')), 'separate account status');
  await page.screenshot({path:path.join(artifacts,'settings-data-desktop.png'),fullPage:true});
  await page.getByRole('link',{name:'Appearance',exact:true}).click();
  await page.getByLabel('Dark mode',{exact:true}).check();
  check(await page.evaluate(()=>document.documentElement.classList.contains('dark')), 'theme control preserved');
  await page.getByLabel('Dark mode',{exact:true}).uncheck();
  check(await page.locator('.settings-category:not([hidden])').count() === 5, 'all signed-in sections stay visible');
  await page.getByRole('link',{name:'General',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.activeElement.id === 'settings-general');
  check(await page.locator('#settings-appearance').isVisible(), 'keyboard navigation scrolls without hiding other sections');
  await page.getByRole('link',{name:'Time & Display',exact:true}).click();
  await page.getByLabel('Clock timezone',{exact:true}).selectOption('UTC');
  check(await page.evaluate(()=>localStorage.getItem('timeZone')) === 'UTC', 'Settings timezone saved');
  await page.getByLabel('Clock timezone',{exact:true}).selectOption('America/Los_Angeles');
  await page.goto(base+'/start27.html');
  await page.reload();
  check(await page.locator('#time-sub').innerText().then(text=>/Pacific/.test(text)), 'Settings timezone survives Home refresh');
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  await page.getByRole('link',{name:'Log in',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'Log out',exact:true}).isHidden(), 'logout updates UI');
  check(await page.locator('.page-sync-footer [data-sync-detail]').count() === 0, 'signed-out Home omits sync detail subtitle');
  check(await page.evaluate(()=>localStorage.getItem('timeZone')) === 'America/Los_Angeles', 'logout retains device preferences');
  await page.goto(base+'/settings.html#account');
  check(await page.getByRole('link',{name:'Account & Cloud Saving'}).count() === 0, 'signed-out account category hidden');
  await page.getByRole('link',{name:'Your Data',exact:true}).click();
  check(await page.locator('[data-login-link]').count() === 1, 'one Settings account entry');
  check(await page.locator('[data-sync-detail]').innerText() === 'Your data stays on this device, not in the cloud.', 'signed-out Settings describes device storage');
  check(await page.locator('.settings-category:not([hidden])').count() === 4, 'all public sections visible while signed out');
  await page.screenshot({path:path.join(artifacts,'settings-data-signed-out.png'),fullPage:true});
  check(await page.getByRole('button',{name:'Export backup',exact:true}).isVisible(), 'local data controls stay accessible');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  const download = await downloadPromise;
  const backup = JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  check(backup.data.timeZone === 'America/Los_Angeles', 'timezone included in backup');
  await page.goto(base+'/tabs.html');
  check(await page.getByRole('button',{name:'Secret Movie Link',exact:true}).count() === 0, 'duplicate movie entry removed');
  await page.goto(base+'/movie+tv.html');
  await page.getByRole('button',{name:'Extras',exact:true}).click();
  check(await page.getByRole('button',{name:'Cinecat',exact:true}).isVisible(), 'original secret destination retained in Extras');
  check(await page.getByRole('button',{name:'Cinecat',exact:true}).getAttribute('onclick').then(text=>text.includes('https://zstream.mov/')), 'Extras destination preserved');
  await page.goto(base+'/games.html');
  check(await page.locator('.card-thumb').first().evaluate(el=>getComputedStyle(el).objectFit) === 'cover', 'full-width game artwork');
  for (const width of [1365, 768, 390, 320]) {
    await page.setViewportSize({width,height:900});
    for (const route of ['/index.html','/start27.html','/settings.html#appearance','/settings.html#data','/games.html','/movie+tv.html']) {
      await page.goto(base+route); await page.locator('body').waitFor();
      if (route.includes('settings')) await page.locator('[data-category][aria-current="location"]').waitFor();
      check(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow '+width+' '+route);
      if (width===390 && ['/index.html','/settings.html#data'].includes(route)) await page.screenshot({path:path.join(artifacts, route.includes('settings')?'settings-data-mobile.png':'welcome-mobile.png'),fullPage:true});
      if ((width===1365 && ['/games.html','/movie+tv.html','/settings.html#appearance'].includes(route)) || (width===768 && route==='/settings.html#appearance')) {
        await page.screenshot({path:path.join(artifacts,route.replace(/[^a-z]/g,'-')+'-'+width+'.png'),fullPage:true});
      }
    }
  }
  check(errors.length === 0, 'no page JavaScript errors: '+errors.join('; '));
  // Storage failure uses a fresh isolated origin context; no real user data is touched.
  const blocked = await browser.newContext();
  await blocked.route('**/firebase-config.js', route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')};});
  const blockedPage=await blocked.newPage();await blockedPage.goto(base+'/settings.html#data');
  await blockedPage.locator('[data-device-status][data-tone="bad"]').waitFor(); checks++;
  console.log('PASS: '+checks+' browser checks with a fake Firebase adapter; screenshots in test-results/. No real account operations were performed.');
  if (process.env.REAL_FIREBASE_SMOKE === '1') {
    const realContext = await browser.newContext();
    const realPage = await realContext.newPage();
    const realErrors = []; realPage.on('pageerror', error=>realErrors.push(error.message));
    await realPage.goto(base+'/index.html');
    await realPage.locator('[data-account-submit]:enabled').waitFor({timeout:25000});
    assert.equal(await realPage.evaluate(()=>window.siteCloud.state.user),null);
    assert.equal(await realPage.locator('[data-cloud-indicator]').getAttribute('data-tone'),'bad');
    assert.deepEqual(realErrors,[]);
    await realPage.screenshot({path:path.join(artifacts,'welcome-real-firebase.png'),fullPage:true});
    console.log('PASS: real Firebase SDK initializes signed out with no page errors. No account creation, login, reset email or cloud write attempted.');
  }
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close();});
