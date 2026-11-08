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
const state = {phase: 'local', mode: null, user: null, available: true, message: 'Sign in to enable cloud saving.'};
function emit(update) {Object.assign(state, update); listeners.forEach(fn=>fn({...state}));}
window.__testCloud = {emit};
window.siteCloud = {
 get state(){return {...state}}, subscribe(fn){listeners.add(fn);fn({...state});return ()=>listeners.delete(fn)},
 async login(email,password){await new Promise(r=>setTimeout(r,100));if(password==='bad-password'){const e=new Error();e.code='auth/invalid-credential';throw e}sessionStorage.setItem('test-user',email);emit({user:{email,uid:'test-only'},mode:'cloud',phase:'synced',message:'Synced'})},
 async signup(email,password){return this.login(email,password)},
 async resetPassword(email){window.__resetRequested=email},
 async logout(){sessionStorage.removeItem('test-user');emit({user:null,mode:null,phase:'local',message:'Sign in to enable cloud saving.'})},
 async retry(){emit({phase:'synced',message:'Synced'})},
 async useCloud(){emit({phase:'synced',message:'Synced'})}, async useDevice(){emit({phase:'synced',message:'Synced'})},
 async selectCloud(){emit({mode:'cloud',phase:'synced',message:'Synced'})},
 async selectDevice(){emit({mode:'device',phase:'device',message:'Saved on this device'})},
 async syncNow(){}, async beforeDeleteAll(){}
};
const email=sessionStorage.getItem('test-user');if(email)emit({user:{email,uid:'test-only'},mode:'cloud',phase:'synced',message:'Synced'});
window.dispatchEvent(new Event('site-cloud-ready'));
`;
let browser, server;
let checks = 0;
function check(value, message) { assert(value, message); checks++; }
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const route = url === '/' ? '/index.html' : (url.endsWith('/') ? url + 'index.html' : url);
    const target = path.resolve(root, '.' + route);
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
    check(await page.locator('[data-cloud-indicator]').isHidden(), phase+' has no cloud prompt');
  }
  check(await page.getByRole('button',{name:'Use cloud data',exact:true}).isVisible(), 'conflict controls retained');
  await page.getByRole('button',{name:'Use cloud data',exact:true}).click();
  check(await page.locator('[data-cloud-indicator]').isHidden(), 'confirmed cloud account has no prompt');
  await page.getByRole('link', {name:'Continue to site'}).click();
  await page.getByRole('button',{name:'Log out',exact:true}).waitFor();
  check(await page.locator('.navbar').evaluate(nav=>{
    const movie=nav.querySelector('a[href="movie+tv.html"]');
    const gear=nav.querySelector('a.site-settings-gear');
    const logout=nav.querySelector('[data-account-logout]');
    return movie?.nextElementSibling===gear && gear?.nextElementSibling===logout;
  }), 'logout follows Movie + TV and the settings gear');
  check(await page.locator('.nav-link-icon').first().evaluate(img=>img.getBoundingClientRect().width >= 90), 'navigation artwork is enlarged within its button');
  check(await page.locator('.page-sync-footer').isHidden(), 'cloud account has no home sync message');
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
  check(await page.locator('[data-device-status-card]').isHidden(), 'cloud mode shows only its active storage card');
  check(await page.locator('[data-storage-choice]').isVisible(), 'signed-in saving choice available');
  check(await page.locator('[data-select-cloud]').getAttribute('aria-pressed') === 'true', 'cloud mode selected');
  await page.evaluate(()=>window.__testCloud.emit({mode:null,phase:'choice',message:'Choose a saving mode'}));
  check(await page.locator('[data-storage-choice]').getAttribute('data-needs-choice') === 'true', 'new account sees highlighted choice');
  await page.getByRole('button',{name:'Device storage',exact:true}).click();
  check(await page.locator('[data-select-device]').getAttribute('aria-pressed') === 'true', 'device mode selected');
  check(await page.locator('[data-cloud-status-card]').isHidden(), 'device mode shows only its active storage card');
  await page.getByRole('button',{name:'Cloud Sync',exact:true}).click();
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
  check(await page.evaluate(()=>window.siteCloud.state.phase) === 'synced', 'mock account remains synced before logout');
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
  const tabsNav = await page.locator('.site-home-nav').boundingBox();
  const tabsGear = await page.locator('.site-home-nav .site-settings-gear').boundingBox();
  check(tabsGear.x > tabsNav.x + tabsNav.width / 2, 'Tabs gear sits on the right side');
  await page.goto(base+'/movie+tv.html');
  await page.getByRole('button',{name:'Extras',exact:true}).click();
  check(await page.getByRole('button',{name:'Cinecat',exact:true}).isVisible(), 'original secret destination retained in Extras');
  check(await page.getByRole('button',{name:'Cinecat',exact:true}).getAttribute('onclick').then(text=>text.includes('https://zstream.mov/')), 'Extras destination preserved');
  await page.goto(base+'/games.html');
  check(await page.getByRole('heading',{name:'Games',exact:true}).isVisible(), 'games row labeled');
  check(await page.getByRole('heading',{name:'Apps',exact:true}).isVisible(), 'apps row labeled');
  check(await page.locator('.youtube-logo svg rect').getAttribute('fill') === '#ff0033', 'YouTube card uses red logo');
  await page.locator('#searchInput').fill('youtube');
  check(await page.locator('.app-card').isVisible(), 'app search finds YouTube');
  check(await page.locator('#gamesHeading').isHidden(), 'empty games row hides for app search');
  await page.locator('.app-card[data-name="youtube"] .open-app-btn').click();
  check(new URL(page.url()).pathname === '/youtube/', 'YouTube app has its own route');
  check(await page.getByRole('link',{name:'Settings',exact:true}).isVisible(), 'YouTube settings gear accessible');
  check(await page.locator('.page-title').innerText() === 'YouTube', 'YouTube title has no red play icon');
  const pageBox=await page.locator('header').boundingBox(), titleBox=await page.locator('.page-title').boundingBox();
  check(Math.abs((titleBox.x + titleBox.width / 2) - (pageBox.x + pageBox.width / 2)) < 2, 'YouTube title is centered');
  await page.locator('#urlInput').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button',{name:/Load/}).click();
  check(await page.locator('#videoFrame').getAttribute('src') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'valid link embeds only its video ID');
  await page.getByRole('textbox',{name:'Video name (optional)'}).fill('Favorite');
  await page.getByRole('button',{name:'Save video'}).click();
  check(await page.locator('#savedCount').innerText() === '1 / 6 saved', 'first video saved');
  await page.reload();
  check(await page.getByRole('button',{name:'Play Favorite'}).isVisible(), 'saved video survives reload');
  for (let i=2;i<=6;i++) {
    await page.locator('#urlInput').fill('https://youtu.be/'+String(i).padStart(11,'0'));
    await page.getByRole('button',{name:'Save video'}).click();
  }
  check(await page.locator('#savedCount').innerText() === '6 / 6 saved', 'six video limit');
  check(await page.getByRole('button',{name:'Save video'}).isDisabled(), 'save button disables at six');
  await page.getByRole('button',{name:'Remove Favorite'}).click();
  check(await page.locator('#savedCount').innerText() === '5 / 6 saved', 'saved video can be removed');
  await page.getByRole('button',{name:'Play Video 6'}).click();
  check(await page.locator('#videoFrame').getAttribute('src') === 'https://www.youtube-nocookie.com/embed/00000000006', 'saved video loads in player');
  await page.goto(base+'/settings.html#data');
  const savedDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  const savedDownload=await savedDownloadPromise;
  const savedBackup=JSON.parse(fs.readFileSync(await savedDownload.path(),'utf8'));
  check(JSON.parse(savedBackup.data.youtube_saved_videos).length === 5, 'video list included in backup');
  await page.goto(base+'/youtube/');
  await page.locator('#urlInput').fill('https://attacker.example/embed/dQw4w9WgXcQ');
  await page.getByRole('button',{name:/Load/}).click();
  check(await page.locator('#videoFrame').getAttribute('src') === null, 'untrusted video host rejected and old embed cleared');
  await page.goto(base+'/games.html');
  check(await page.locator('.card-thumb').first().evaluate(el=>getComputedStyle(el).objectFit) === 'cover', 'full-width game artwork');
  for (const width of [1365, 768, 390, 320]) {
    await page.setViewportSize({width,height:900});
    for (const route of ['/index.html','/start27.html','/settings.html#appearance','/settings.html#data','/games.html','/youtube/','/movie+tv.html']) {
      await page.goto(base+route); await page.locator('body').waitFor();
      if (route.includes('settings')) await page.locator('[data-category][aria-current="location"]').waitFor();
      check(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow '+width+' '+route);
      if (width===390 && ['/index.html','/settings.html#data'].includes(route)) await page.screenshot({path:path.join(artifacts, route.includes('settings')?'settings-data-mobile.png':'welcome-mobile.png'),fullPage:true});
      if ((width===1365 && ['/games.html','/youtube/','/movie+tv.html','/settings.html#appearance'].includes(route)) || (width===768 && route==='/settings.html#appearance')) {
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
