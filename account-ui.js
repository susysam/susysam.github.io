// Local-only navigation remains available even if the Firebase CDN cannot load.
const panels = [...document.querySelectorAll('[data-account-panel]')];
panels.forEach((panel, index) => {
  const prefix = 'cloudAccount' + index;
  panel.classList.add('account-panel');
  panel.innerHTML = `
    <p class="account-note">Sign in to save settings, links, games, and viewing history across devices. You can also use the site locally without an account.</p>
    <div data-signed-out>
      <form data-account-form>
        <div class="account-fields">
          <label class="account-field" for="${prefix}Email">Email<input class="account-input" id="${prefix}Email" name="email" type="email" autocomplete="username" required maxlength="254"></label>
          <label class="account-field" for="${prefix}Password">Password<input class="account-input" id="${prefix}Password" name="password" type="password" autocomplete="current-password" required></label>
        </div>
        <div class="account-actions">
          <button class="site-home-button" data-account-submit type="submit" disabled>Log in</button>
          <button class="account-secondary" data-account-toggle type="button">Create account</button>
          <button class="account-secondary" data-account-reset type="button" disabled>Forgot password?</button>
        </div>
      </form>
      <p class="account-note" style="margin-top:12px">Old browser-only usernames are not cloud accounts. Create an account with your email to start syncing.</p>
    </div>
    <div data-signed-in hidden>
      <p>Logged in as <span class="account-email" data-account-email></span></p>
      <div class="account-actions"><button class="site-home-button" data-account-logout type="button">Log out</button></div>
      <p class="account-note" style="margin-top:12px">Logging out keeps this device's saved data. On a shared computer, delete device data after logging out.</p>
    </div>
    <p class="sync-indicator" data-sync-status role="status">Connecting to account service…</p>
    <div data-sync-conflict class="account-conflict" hidden>
      <p>Both copies are kept until you choose. Export a device backup first if you want to keep both. “Use cloud data” replaces this device's copy; “Use this device's data” replaces the cloud copy.</p>
      <div class="account-actions">
        <button class="site-home-button" data-use-cloud type="button">Use cloud data</button>
        <button class="site-home-button" data-use-device type="button">Use this device's data</button>
      </div>
    </div>
    <button class="account-secondary" data-sync-retry type="button" hidden>Retry connection</button>
    <p class="account-feedback" data-account-feedback role="alert"></p>`;
  let signup = false;
  let busy = false;
  let currentState;
  const field = selector => panel.querySelector(selector);
  const form = field('[data-account-form]');
  const feedback = field('[data-account-feedback]');
  function render(state) {
    currentState = state;
    field('[data-signed-in]').hidden = !state.user;
    field('[data-signed-out]').hidden = !!state.user;
    field('[data-account-email]').textContent = state.user?.email || '';
    field('[data-sync-status]').textContent = state.message;
    field('[data-sync-conflict]').hidden = state.phase !== 'conflict';
    field('[data-sync-retry]').hidden = state.phase !== 'error';
    panel.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    field('[data-account-submit]').disabled = busy || !state.available;
    field('[data-account-reset]').disabled = busy || !state.available;
  }
  async function perform(action) {
    if (busy) return;
    busy = true;
    feedback.textContent = '';
    render(currentState || { phase: 'loading', available: false, message: 'Connecting…' });
    try { await action(); }
    catch (error) {
      const { friendlyError } = await import('./account-errors.js');
      feedback.textContent = friendlyError(error);
    } finally { busy = false; render(window.siteCloud?.state || currentState); }
  }
  field('[data-account-toggle]').addEventListener('click', () => {
    signup = !signup;
    field('[data-account-submit]').textContent = signup ? 'Create account' : 'Log in';
    field('[data-account-toggle]').textContent = signup ? 'Back to login' : 'Create account';
    form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
    form.elements.password.minLength = signup ? 8 : 1;
    feedback.textContent = signup ? 'Use a unique password with at least 8 characters.' : '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      try { await window.siteCloud[signup ? 'signup' : 'login'](email, password); }
      finally { form.elements.password.value = ''; }
    });
  });
  field('[data-account-reset]').addEventListener('click', () => {
    if (!form.elements.email.reportValidity()) return;
    void perform(async () => {
      await window.siteCloud.resetPassword(form.elements.email.value.trim());
      feedback.textContent = 'If an account exists for that email, a password reset message will arrive shortly.';
    });
  });
  field('[data-account-logout]').addEventListener('click', () => {
    if (['pending', 'saving', 'error', 'conflict'].includes(window.siteCloud.state.phase) &&
        !confirm('Some device data may not be synced. Log out and keep it on this device?')) return;
    void perform(() => window.siteCloud.logout());
  });
  field('[data-use-cloud]').addEventListener('click', () => { void perform(() => window.siteCloud.useCloud()); });
  field('[data-use-device]').addEventListener('click', () => { void perform(() => window.siteCloud.useDevice()); });
  field('[data-sync-retry]').addEventListener('click', () => { void perform(() => window.siteCloud.retry()); });
  function connect() { window.siteCloud.subscribe(render); }
  if (window.siteCloud) connect();
  else window.addEventListener('site-cloud-ready', connect, { once: true });
});

function bindStatus() {
  let notice;
  window.siteCloud.subscribe(state => {
    document.querySelectorAll('[data-backup-sync-status]').forEach(element => { element.textContent = state.message; });
    if (panels.length) return;
    const needsAttention = ['conflict', 'error'].includes(state.phase);
    if (!needsAttention) { notice?.remove(); notice = null; return; }
    if (!notice) {
      notice = document.createElement('aside');
      notice.className = 'cloud-notice';
      notice.setAttribute('role', 'status');
      const text = document.createElement('span');
      text.textContent = 'Cloud sync needs attention. Your device data is kept. ';
      const link = document.createElement('a');
      link.href = '/settings.html#account';
      link.textContent = 'Open Settings';
      notice.append(text, link);
      document.body.appendChild(notice);
    }
  });
}
if (window.siteCloud) bindStatus();
else window.addEventListener('site-cloud-ready', bindStatus, { once: true });
