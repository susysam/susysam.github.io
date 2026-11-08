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
      ${primary ? '' : '<p class="account-note" data-account-mode-note></p>'}
    </div>
    <div data-sync-conflict class="account-conflict" hidden>
      <p>Both copies are kept until you choose. Export a device backup in <a href="/settings.html#data">Your data</a> first if you want to keep both. “Use cloud data” replaces this device's copy; “Use this device's data” replaces the cloud copy.</p>
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
    if (!primary) field('[data-account-mode-note]').textContent = state.mode === 'cloud'
      ? 'Cloud Sync saves changes to your account automatically.'
      : state.mode === 'device' ? 'Your site data stays on this device.' : 'Choose a saving mode in Your data.';
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
    void perform(() => window.siteCloud.useCloud());
  });
  field('[data-use-device]').addEventListener('click', () => {
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

  const choice = document.querySelector('[data-storage-choice]');
  const conflict = document.querySelector('[data-data-conflict]');
  const choiceFeedback = document.querySelector('[data-storage-choice-feedback]');
  const conflictFeedback = document.querySelector('[data-data-conflict-feedback]');
  let modeBusy = false;
  async function changeMode(mode) {
    if (modeBusy) return;
    modeBusy = true;
    choiceFeedback.textContent = '';
    choice?.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await window.siteCloud[mode === 'cloud' ? 'selectCloud' : 'selectDevice'](); }
    catch (error) { choiceFeedback.textContent = friendlyError(error); }
    finally {
      modeBusy = false;
      choice?.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }
  choice?.querySelector('[data-select-cloud]').addEventListener('click', () => void changeMode('cloud'));
  choice?.querySelector('[data-select-device]').addEventListener('click', () => void changeMode('device'));
  conflict?.querySelector('[data-data-use-cloud]').addEventListener('click', async () => {
    conflictFeedback.textContent = '';
    try { await window.siteCloud.useCloud(); }
    catch (error) { conflictFeedback.textContent = friendlyError(error); }
  });
  conflict?.querySelector('[data-data-use-device]').addEventListener('click', async () => {
    conflictFeedback.textContent = '';
    try { await window.siteCloud.useDevice(); }
    catch (error) { conflictFeedback.textContent = friendlyError(error); }
  });

  function render(state) {
    const presentation = syncPresentation(state, navigator.onLine);
    if (!state.user && !['loading', 'error'].includes(state.phase) && !window.siteStorage.status.persistent) {
      presentation.detail = 'Device saving is unavailable. Changes may only last while this page is open.';
    }

    document.querySelectorAll('[data-auth-only]').forEach(element => { element.hidden = !state.user; });
    document.querySelectorAll('[data-login-link]').forEach(element => { element.hidden = !!state.user; });
    document.querySelectorAll('[data-cloud-status-card]').forEach(element => {
      element.hidden = !!state.user && state.mode === 'device';
    });
    document.querySelectorAll('[data-device-status-card]').forEach(element => {
      element.hidden = !!state.user && state.mode === 'cloud';
    });
    document.querySelectorAll('.data-status-grid').forEach(element => {
      element.toggleAttribute('data-single-mode', !!state.user && ['cloud', 'device'].includes(state.mode));
    });
    document.querySelectorAll('[data-cloud-indicator]').forEach(element => {
      const inSettings = !!element.closest('[data-settings-panel="data"]');
      const hide = !!state.user && state.mode === 'cloud' && !inSettings;
      const footer = element.closest('.page-sync-footer');
      if (footer) footer.hidden = hide;
      else element.hidden = hide;
      if (hide) return;
      renderStatus(element, presentation);
      if (state.user && ['conflict', 'error'].includes(state.phase)) {
        element.style.cursor = 'pointer';
        element.title = state.phase === 'conflict' ? 'Choose which copy to keep' : 'Retry cloud connection';
      } else {
        element.style.cursor = '';
        element.title = '';
      }
    });
    document.querySelectorAll('[data-sync-detail]').forEach(element => { element.textContent = presentation.detail; });
    if (choice) {
      choice.hidden = !state.user;
      choice.dataset.needsChoice = String(!!state.user && state.mode === null);
      choice.querySelector('[data-storage-choice-message]').textContent = state.phase === 'error'
        ? state.message : state.phase === 'choice'
        ? 'Please select if you want to save your info in the cloud or on this device.'
        : state.mode === 'cloud' ? 'Cloud Sync is on. Changes save to your account automatically.'
        : state.mode === 'device' ? 'Device storage is on. Site data stays on this device.'
        : 'Checking your saving choice…';
      choice.querySelector('[data-select-cloud]').setAttribute('aria-pressed', String(state.mode === 'cloud'));
      choice.querySelector('[data-select-device]').setAttribute('aria-pressed', String(state.mode === 'device'));
    }
    document.querySelectorAll('[data-category="data"]').forEach(link => {
      link.classList.toggle('needs-choice', !!state.user && state.mode === null);
    });
    if (conflict) conflict.hidden = !state.user || state.phase !== 'conflict';
    document.querySelectorAll('[data-account-status]').forEach(element => renderStatus(element, {
      tone: state.user ? 'good' : 'bad',
      label: state.user ? 'Signed in' : 'Not signed in',
      detail: state.user?.email || ''
    }));

    const showErrorBanner = !state.user && ['conflict', 'error'].includes(state.phase);
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
      syncNowBtn.href = state.phase === 'conflict' || !state.user ? '/index.html' : '#sync';
      syncNowBtn.textContent = state.phase === 'conflict' ? 'Choose a copy' : state.user ? 'Retry connection' : 'Open sign in';
      syncNowBtn.addEventListener('click', (e) => {
        if (state.phase === 'conflict' || !state.user) return;
        e.preventDefault();
        void window.siteCloud.retry();
      });
      notice.replaceChildren(document.createTextNode('Cloud sync paused. '), syncNowBtn);
    }

    window.dispatchEvent(new CustomEvent('site-account-rendered', { detail: { signedIn: !!state.user } }));
  }

  window.siteCloud.subscribe(render);
  ['online', 'offline'].forEach(event => window.addEventListener(event, () => {
    render(window.siteCloud.state);
  }));

  window.addEventListener('site-storage-status', () => render(window.siteCloud.state));

  // A conflict needs a deliberate choice; clicking the indicator opens that choice.
  document.addEventListener('click', (event) => {
    const indicator = event.target.closest('[data-cloud-indicator]');
    if (!indicator || !window.siteCloud?.state?.user) return;
    if (window.siteCloud.state.phase === 'conflict') location.href = '/index.html';
    else if (window.siteCloud.state.phase === 'error') void window.siteCloud.retry();
  });

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
