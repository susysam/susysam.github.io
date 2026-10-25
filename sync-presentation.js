// Presentation only: Firebase/SyncController remain the source of truth.
export function syncPresentation(state, online = true) {
  if (!online) return { tone: 'bad', label: 'Not Synced', detail: 'Offline. Cloud saving will retry when you reconnect.' };
  if (state.user && state.phase === 'synced') return { tone: 'good', label: 'Synced', detail: state.message && state.message !== 'Synced' ? state.message : 'Cloud data is up to date.' };
  if (state.phase === 'loading' || (state.user && ['pending', 'saving'].includes(state.phase))) {
    return { tone: 'pending', label: 'Syncing…', detail: state.message || 'Checking cloud saving…' };
  }
  return { tone: 'bad', label: 'Not Synced', detail: state.user ? state.message :
    (state.phase === 'error' ? state.message : 'Sign in to enable cloud saving. Device storage is separate.') };
}

export function renderStatus(element, { tone, label, detail = '' }) {
  element.classList.add('save-status');
  element.dataset.tone = tone;
  element.title = detail;
  const icon = document.createElement('span');
  icon.className = 'status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = tone === 'good' ? '✓' : tone === 'bad' ? '×' : '…';
  const text = document.createElement('span');
  text.textContent = label;
  element.replaceChildren(icon, text);
}
