(function () {
  const keys = ['theme', 'backgroundUrl', 'customBackgroundPresets', 'performanceMode',
    'customGames', 'tabs_saved_links', 'lastWatched', 'recentImdbMedia', 'timeZone'];
  const profileKeys = ['localProfile', 'username', 'password', 'rememberedUsername'];
  const status = document.getElementById('dataStatus');
  const report = message => { status.textContent = message; };
  const maxBytes = 2 * 1024 * 1024;

  function validateBackup(value) {
    if (!value || value.format !== 'susysam-backup' || value.version !== 1 ||
        !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
      throw new Error('This is not a supported site backup.');
    }
    for (const [key, item] of Object.entries(value.data)) {
      if (!keys.includes(key) || typeof item !== 'string') {
        throw new Error('Backup contains unsupported data.');
      }
      if (key === 'theme' && !['dark', 'light'].includes(item)) throw new Error('Invalid theme.');
      if (key === 'performanceMode' && !['on', 'off'].includes(item)) throw new Error('Invalid performance mode.');
      if (key === 'timeZone') {
        if (!item || item.length > 100) throw new Error('Invalid timezone.');
        try { new Intl.DateTimeFormat('en-US', { timeZone: item }); }
        catch { throw new Error('Invalid timezone.'); }
      }
      if (key === 'backgroundUrl' && item && !/^#[0-9a-f]{6}$/i.test(item) && !siteHttpUrl(item)) {
        throw new Error('Invalid background URL.');
      }
      if (['customBackgroundPresets', 'customGames', 'tabs_saved_links', 'recentImdbMedia'].includes(key) &&
          !Array.isArray(JSON.parse(item))) throw new Error('Invalid list in backup.');
      if (key === 'lastWatched') {
        const media = JSON.parse(item);
        if (media !== null && (typeof media !== 'object' || Array.isArray(media))) throw new Error('Invalid history.');
      }
    }
    return value.data;
  }

  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const data = {};
    keys.forEach(key => {
      const value = siteStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    const blob = new Blob([JSON.stringify({ format: 'susysam-backup', version: 1, data }, null, 2)], { type: 'application/json' });
    if (blob.size > maxBytes) return report('Backup exceeds 2 MB. Reduce saved data before exporting.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'susysam-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('Backup download requested. Keep it private: it can include viewing history and saved links.');
  });

  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importDataFile').click();
  });
  document.getElementById('importDataFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('backupFileName').textContent = 'Selected: ' + file.name;
    try {
      if (file.size > maxBytes) throw new Error('Backup must be smaller than 2 MB.');
      const data = validateBackup(JSON.parse(await file.text()));
      if (!confirm('Replace the settings and data included in this backup? Export a backup first if you want to keep the current values.')) return;
      const before = {};
      // Use persistent storage directly so a failed import cannot report success.
      Object.keys(data).forEach(key => { before[key] = localStorage.getItem(key); });
      try {
        Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, value));
      } catch {
        let restored = true;
        for (const [key, value] of Object.entries(before)) {
          try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); }
          catch { restored = false; }
        }
        throw new Error(restored ? 'Storage is unavailable or full. Import canceled; previous data restored.' : 'Import failed and some data could not be restored. Keep your backup and free browser storage.');
      }
      if (typeof window !== 'undefined') await window.siteCloud?.syncNow();
      location.reload();
    } catch (error) {
      report(error.message || 'Could not import backup.');
    } finally { event.target.value = ''; }
  });

  async function removeData(selected, question, all = false) {
    if (!confirm(question)) return;
    if (all && typeof window !== 'undefined') {
      try {
        if (!window.siteCloud) throw new Error('The account check is still loading. Please try again shortly.');
        await window.siteCloud.beforeDeleteAll();
      } catch (error) { return report(error.message || 'Cloud deletion failed. Device data was kept.'); }
    }
    let complete = true;
    selected.forEach(key => { if (!siteStorage.removeItem(key)) complete = false; });
    if (!complete) return report('Some data could not be deleted. Check browser storage permissions and try again.');
    if (!all && typeof window !== 'undefined') await window.siteCloud?.syncNow();
    location.reload();
  }
  document.getElementById('deleteHistoryBtn').addEventListener('click', () =>
    removeData(['lastWatched', 'recentImdbMedia'],
      typeof window !== 'undefined' && window.siteCloud?.state.user ?
        'Permanently delete viewing history from this browser and sync that change to your account when syncing is active?' :
        'Permanently delete viewing history from this browser?'));
  document.getElementById('deleteAllDataBtn').addEventListener('click', () =>
    removeData([...keys, ...profileKeys, 'susysamCloudOwner'],
      typeof window !== 'undefined' && window.siteCloud?.state.user ?
        'Permanently delete this device’s site data AND this account’s synced site data? Your account will remain. Export a backup first if needed.' :
        'Permanently delete site data and the old local profile from this device? Any cloud copy will remain. Export a backup first if needed.', true));
})();
