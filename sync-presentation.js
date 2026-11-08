// Presentation only: Firebase/SyncController remain the source of truth.
export function syncPresentation(state, online = true) {
  if (state.user && state.mode === 'device' && state.phase === 'error') {
    return { tone: 'bad', label: 'Saving choice needs attention', detail: state.message };
  }
  if (state.user && state.mode === 'device' && state.phase !== 'loading') {
    return { tone: 'good', label: 'Saved on this device', detail: 'Cloud Sync is off for this account.' };
  }
  if (state.user && state.phase === 'choice') {
    return { tone: 'bad', label: 'Choose where to save', detail: 'Select Cloud Sync or Device storage in Your data.' };
  }
  if (!state.user && !['loading', 'error'].includes(state.phase)) {
    return { tone: 'bad', label: 'Not Synced', detail: 'Your data stays on this device, not in the cloud.' };
  }
  if (!online) return { tone: 'bad', label: 'Not Synced', detail: 'Offline. Cloud saving will retry when you reconnect.' };
  if (state.user && state.phase === 'synced') return { tone: 'good', label: 'Synced', detail: state.message && state.message !== 'Synced' ? state.message : 'Cloud data is up to date.' };
  if (state.phase === 'loading' || (state.user && ['pending', 'saving'].includes(state.phase))) {
    return { tone: 'pending', label: 'Syncing…', detail: state.message || 'Checking cloud saving…' };
  }
  return { tone: 'bad', label: 'Not Synced', detail: state.user ? state.message :
    (state.phase === 'error' ? state.message : 'Your data stays on this device, not in the cloud.') };
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
