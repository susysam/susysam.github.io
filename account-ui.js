import { friendlyError } from './account-errors.js';
import { syncPresentation, renderStatus } from './sync-presentation.js';
const panels = [...document.querySelectorAll('[data-account-panel]')];
panels.forEach((panel, index) => {
  const primary = panel.dataset.accountPanel !== 'manage';
  const prefix = 'cloudAccount' + index;
  panel.classList.add('account-panel');
  panel.innerHTML = `${primary ? `
    <div data-signed-out>
      <form data-account-form>
        <div class="account-fields">
          <label class="account-field" for="${prefix}Email">Email<input class="account-input" id="${prefix}Email" name="email" type="email" autocomplete="username" required maxlength="254"></label>
          <label class="account-field" for="${prefix}Password">Password<input class="account-input" id="${prefix}Password" name="password" type="password" autocomplete="current-password" required></label>
        </div>
        <div class="account-actions auth-actions">
          <button class="site-home-button" data-account-submit type="submit" disabled>Log in</button>
          <button class="account-secondary" data-account-toggle type="button">Create account</button>
        </div>
        <div class="account-actions auth-actions"><button class="account-link" data-account-reset type="button" disabled>Forgot password?</button></div>
      </form>
    </div>` : ''}
    <div data-signed-in hidden>
      <p>Logged in as <span class="account-email" data-account-email></span></p>
      ${primary ? '' : '<p class="account-note">Your settings, links, games, viewing history, and timezone use this account. Resolve any differences below before cloud saving continues.</p>'}
    </div>
    <div data-sync-conflict class="account-conflict" hidden>
      <p>Both copies are kept until you choose. Export a device backup in <a href="/settings.html#data">Your data</a> first if you want to keep both. “Use cloud data” replaces this device\'s copy; “Use this device\'s data” replaces the cloud copy.</p>
      <div class="account-actions">
        <button class="site-home-button" data-use-cloud type="button">Use cloud data</button>
        <button class="site-home-button" data-use-device type="button">Use this device's data</button>
      </div>
    </div>
    <button class="account-secondary" data-sync-retry type="button" hidden>Retry connection</button>
    <p class="account-feedback" data-account-feedback role="alert"></p>`;
  let signup = false, busy = false;
  let currentState = { phase: 'loading', available: false, message: 'Connecting…' };
  const field = selector => panel.querySelector(selector);
  const form = field('[data-account-form]'), feedback = field('[data-account-feedback]');
  function render(state) {
    currentState = state;
    field('[data-signed-in]').hidden = !state.user;
    if (primary) field('[data-signed-out]').hidden = !!state.user;
    field('[data-account-email]').textContent = state.user?.email || '';
    field('[data-sync-conflict]').hidden = !state.user || state.phase !== 'conflict';
    field('[data-sync-retry]').hidden = state.phase !== 'error';
    panel.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    panel.setAttribute('aria-busy', String(busy));
    if (primary) {
      field('[data-account-submit]').disabled = busy || !state.available;
      field('[data-account-reset]').disabled = busy || !state.available;
      field('[data-account-submit]').textContent = busy ? 'Please wait…' : signup ? 'Create account' : 'Log in';
    }
  }
  async function perform(action) {
    if (busy) return;
    busy = true; feedback.textContent = ''; render(currentState);
    try { await action(); }
    catch (error) { feedback.textContent = friendlyError(error); }
    finally { busy = false; render(window.siteCloud?.state || currentState); }
  }
  if (primary) {
    field('[data-account-toggle]').addEventListener('click', () => {
      signup = !signup;
      field('[data-account-toggle]').textContent = signup ? 'Back to login' : 'Create account';
      form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
      form.elements.password.minLength = signup ? 8 : 1;
      feedback.textContent = signup ? 'Use a unique password with at least 8 characters.' : '';
      render(currentState);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      void perform(async () => {
        try { await window.siteCloud[signup ? 'signup' : 'login'](form.elements.email.value.trim(), form.elements.password.value); }
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
  }
  field('[data-use-cloud]').addEventListener('click', () => { void perform(() => window.siteCloud.useCloud()); });
  field('[data-use-device]').addEventListener('click', () => { void perform(() => window.siteCloud.useDevice()); });
  field('[data-sync-retry]').addEventListener('click', () => { void perform(() => window.siteCloud.retry()); });
  function connect() { window.siteCloud.subscribe(render); }
  if (window.siteCloud) connect();
  else window.addEventListener('site-cloud-ready', connect, { once: true });
});
function bindStatus() {
  let notice;
  function render(state) {
    const presentation = syncPresentation(state, navigator.onLine);
    if (!state.user && !['loading', 'error'].includes(state.phase) && !window.siteStorage.status.persistent) {
      presentation.detail = 'Device saving is unavailable. Changes may only last while this page is open.';
    }
    document.querySelectorAll('[data-auth-only]').forEach(element => { element.hidden = !state.user; });
    document.querySelectorAll('[data-login-link]').forEach(element => { element.hidden = !!state.user; });
    document.querySelectorAll('[data-cloud-indicator]').forEach(element => renderStatus(element, presentation));
    document.querySelectorAll('[data-sync-detail]').forEach(element => { element.textContent = presentation.detail; });
    document.querySelectorAll('[data-account-status]').forEach(element => renderStatus(element, {
      tone: state.user ? 'good' : 'bad', label: state.user ? 'Signed in' : 'Not signed in', detail: state.user?.email || ''
    }));
    const needsAttention = ['conflict', 'error'].includes(state.phase);
    const visiblePanel = panels.some(panel => !panel.closest('[hidden]'));
    if (!needsAttention || visiblePanel) { notice?.remove(); notice = null; }
    else if (!notice) {
      notice = document.createElement('aside'); notice.className = 'cloud-notice';
      notice.setAttribute('role', 'status'); document.body.appendChild(notice);
    }
    if (notice) {
      const link = document.createElement('a');
      link.href = state.user ? '/settings.html#account' : '/index.html';
      link.textContent = state.user ? 'Open account settings' : 'Open sign in';
      notice.replaceChildren(document.createTextNode('Cloud saving needs attention. '), link);
    }
    window.dispatchEvent(new CustomEvent('site-account-rendered', { detail: { signedIn: !!state.user } }));
  }
  window.siteCloud.subscribe(render);
  ['online', 'offline'].forEach(event => window.addEventListener(event, () => render(window.siteCloud.state)));
  window.addEventListener('site-storage-status', () => render(window.siteCloud.state));
  document.querySelectorAll('[data-account-logout]').forEach(button => button.addEventListener('click', async () => {
    if (['loading', 'pending', 'saving', 'error', 'conflict'].includes(window.siteCloud.state.phase) &&
        !confirm('Some device data may not be synced. Log out and keep it on this device?')) return;
    button.disabled = true;
    const feedback = document.querySelector('[data-logout-feedback]');
    if (feedback) feedback.textContent = '';
    try { await window.siteCloud.logout(); }
    catch (error) { if (feedback) feedback.textContent = friendlyError(error); }
    finally { button.disabled = false; }
  }));
}
function renderDevice() {
  const state = window.siteStorage.status;
  document.querySelectorAll('[data-device-status]').forEach(element => renderStatus(element, {
    tone: state?.persistent ? 'good' : 'bad', label: state?.persistent ? 'Saved on this device' : 'Device saving unavailable',
    detail: state?.persistent ? 'Browser storage passed a write/read check. Backups are still recommended.' : 'Some changes may only last while this page is open.'
  }));
}
renderDevice();
window.addEventListener('site-storage-status', renderDevice);
if (window.siteCloud) bindStatus();
else window.addEventListener('site-cloud-ready', bindStatus, { once: true });
