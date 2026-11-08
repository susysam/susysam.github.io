import { friendlyError } from './account-errors.js';
import { syncPresentation, renderStatus } from './sync-presentation.js';

const AUTO_SYNC_KEY = 'autoCloudSync';
let autoResolveLock = false;
let lastAutoResolveTime = 0;

function isAutoSyncEnabled() {
  try {
    return (window.siteStorage?.getItem(AUTO_SYNC_KEY) || 'on') !== 'off';
  } catch {
    return true;
  }
}

async function autoResolveCloudState(state, force = false) {
  if (!window.siteCloud || !state || !state.user || !navigator.onLine) return false;
  if (autoResolveLock) return false;

  const now = Date.now();
  if (!force && now - lastAutoResolveTime < 1500) return false;

  if (state.phase === 'conflict' && (force || isAutoSyncEnabled())) {
    autoResolveLock = true;
    lastAutoResolveTime = now;
    try {
      await window.siteCloud.useDevice();
      return true;
    } catch (err) {
      console.warn('Auto cloud sync failed, will retry:', err);
    } finally {
      autoResolveLock = false;
    }
  } else if (state.phase === 'error' && force) {
    autoResolveLock = true;
    lastAutoResolveTime = now;
    try {
      await window.siteCloud.retry();
      return true;
    } catch (err) {
      console.warn('Cloud retry failed:', err);
    } finally {
      autoResolveLock = false;
    }
  }
  return false;
}

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
      ${primary ? '' : '<p class="account-note">Your settings, links, games, viewing history, and timezone automatically sync with this account.</p>'}
    </div>
    <div data-sync-conflict class="account-conflict" hidden>
      <p>Both copies are kept until you choose. Export a device backup in <a href="/settings.html#data">Your data</a> first if you want to keep both. “Use cloud data” replaces this device's copy; “Use this device's data” replaces the cloud copy and enables auto-sync.</p>
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
    field('[data-sync-conflict]').hidden = !state.user || state.phase !== 'conflict' || isAutoSyncEnabled();
    field('[data-sync-retry]').hidden = state.phase !== 'error';
    panel.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    panel.setAttribute('aria-busy', String(busy));
    if (primary) {
      field('[data-account-submit]').disabled = busy || !state.available;
      field('[data-account-reset]').disabled = busy || !state.available;
      field('[data-account-submit]').textContent = busy ? 'Please wait…' : signup ? 'Create account' : 'Log in';
    }

    if (state.user && state.phase === 'conflict' && isAutoSyncEnabled()) {
      void autoResolveCloudState(state, false);
    }
  }

  async function perform(action) {
    if (busy) return;
    busy = true;
    feedback.textContent = '';
    render(currentState);
    try {
      await action();
    } catch (error) {
      feedback.textContent = friendlyError(error);
    } finally {
      busy = false;
      render(window.siteCloud?.state || currentState);
    }
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
        try {
          await window.siteCloud[signup ? 'signup' : 'login'](
            form.elements.email.value.trim(),
            form.elements.password.value
          );
        } finally {
          form.elements.password.value = '';
        }
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

  field('[data-use-cloud]').addEventListener('click', () => {
    window.siteStorage?.setItem(AUTO_SYNC_KEY, 'on');
    void perform(() => window.siteCloud.useCloud());
  });
  field('[data-use-device]').addEventListener('click', () => {
    window.siteStorage?.setItem(AUTO_SYNC_KEY, 'on');
    void perform(() => window.siteCloud.useDevice());
  });
  field('[data-sync-retry]').addEventListener('click', () => {
    void perform(() => window.siteCloud.retry());
  });

  function connect() {
    window.siteCloud.subscribe(render);
  }
  if (window.siteCloud) connect();
  else window.addEventListener('site-cloud-ready', connect, { once: true });
});

function bindStatus() {
  let notice;

  function render(state) {
    // Automatically push local changes when conflict occurs and auto-sync is on
    if (state.user && state.phase === 'conflict' && isAutoSyncEnabled()) {
      void autoResolveCloudState(state, false);
    }

    const presentation = syncPresentation(state, navigator.onLine);
    if (!state.user && !['loading', 'error'].includes(state.phase) && !window.siteStorage.status.persistent) {
      presentation.detail = 'Device saving is unavailable. Changes may only last while this page is open.';
    }

    document.querySelectorAll('[data-auth-only]').forEach(element => { element.hidden = !state.user; });
    document.querySelectorAll('[data-login-link]').forEach(element => { element.hidden = !!state.user; });
    document.querySelectorAll('[data-cloud-indicator]').forEach(element => {
      renderStatus(element, presentation);
      if (state.user && ['conflict', 'error'].includes(state.phase)) {
        element.style.cursor = 'pointer';
        element.title = 'Click to sync your device data to the cloud now';
      } else {
        element.style.cursor = '';
        element.title = '';
      }
    });
    document.querySelectorAll('[data-sync-detail]').forEach(element => { element.textContent = presentation.detail; });
    document.querySelectorAll('[data-account-status]').forEach(element => renderStatus(element, {
      tone: state.user ? 'good' : 'bad',
      label: state.user ? 'Signed in' : 'Not signed in',
      detail: state.user?.email || ''
    }));

    // Suppress the nag banner when auto-sync is handling conflicts
    const showErrorBanner = state.phase === 'error' || (state.phase === 'conflict' && !isAutoSyncEnabled());
    const visiblePanel = panels.some(panel => !panel.closest('[hidden]'));

    if (!showErrorBanner || visiblePanel) {
      notice?.remove();
      notice = null;
    } else if (!notice) {
      notice = document.createElement('aside');
      notice.className = 'cloud-notice';
      notice.setAttribute('role', 'status');
      document.body.appendChild(notice);
    }

    if (notice) {
      const syncNowBtn = document.createElement('a');
      syncNowBtn.href = '#sync';
      syncNowBtn.textContent = state.user ? 'Sync now' : 'Open sign in';
      syncNowBtn.addEventListener('click', (e) => {
        if (!state.user) {
          location.href = '/index.html';
          return;
        }
        e.preventDefault();
        window.siteStorage?.setItem(AUTO_SYNC_KEY, 'on');
        void autoResolveCloudState(window.siteCloud.state, true);
      });
      notice.replaceChildren(document.createTextNode('Cloud sync paused. '), syncNowBtn);
    }

    window.dispatchEvent(new CustomEvent('site-account-rendered', { detail: { signedIn: !!state.user } }));
  }

  window.siteCloud.subscribe(render);
  ['online', 'offline'].forEach(event => window.addEventListener(event, () => {
    render(window.siteCloud.state);
    if (event === 'online' && window.siteCloud.state) {
      void autoResolveCloudState(window.siteCloud.state, true);
    }
  }));

  window.addEventListener('site-storage-status', () => render(window.siteCloud.state));

  // Whenever any setting/game/link is saved locally, auto-resolve any resulting conflict immediately
  window.addEventListener('site-storage-write', () => {
    setTimeout(() => {
      if (window.siteCloud?.state) {
        void autoResolveCloudState(window.siteCloud.state, false);
      }
    }, 120);
  });

  // Allow clicking any [data-cloud-indicator] to force-sync immediately
  document.addEventListener('click', (event) => {
    const indicator = event.target.closest('[data-cloud-indicator]');
    if (!indicator || !window.siteCloud?.state?.user) return;
    window.siteStorage?.setItem(AUTO_SYNC_KEY, 'on');
    void autoResolveCloudState(window.siteCloud.state, true);
  });

  document.querySelectorAll('[data-account-logout]').forEach(button => button.addEventListener('click', async () => {
    if (window.siteCloud?.state?.phase === 'conflict' && isAutoSyncEnabled()) {
      try { await window.siteCloud.useDevice(); } catch {}
    }
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
    tone: state?.persistent ? 'good' : 'bad',
    label: state?.persistent ? 'Saved on this device' : 'Device saving unavailable',
    detail: state?.persistent
      ? 'Browser storage passed a write/read check. Backups are still recommended.'
      : 'Some changes may only last while this page is open.'
  }));
}

renderDevice();
window.addEventListener('site-storage-status', renderDevice);
if (window.siteCloud) bindStatus();
else window.addEventListener('site-cloud-ready', bindStatus, { once: true });
