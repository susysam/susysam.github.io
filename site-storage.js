// Keep the page usable when browser storage is blocked or full.
(function () {
  const fallback = new Map();
  let persistent = false;
  function statusChanged(ok) {
    persistent = ok && fallback.size === 0;
    window.dispatchEvent(new Event('site-storage-status'));
  }
  // Probe a unique temporary key without changing application data.
  try {
    const probe = '__susysam_probe_' + crypto.randomUUID();
    localStorage.setItem(probe, probe);
    persistent = localStorage.getItem(probe) === probe;
    localStorage.removeItem(probe);
  } catch { persistent = false; }
  let noticeQueued = false;
  function notify() {
    if (noticeQueued) return;
    noticeQueued = true;
    const show = () => {
      const notice = document.createElement('p');
      notice.setAttribute('role', 'status');
      notice.textContent = 'Browser storage is unavailable. Some changes will only last while this page is open.';
      notice.style.cssText = 'position:relative;box-sizing:border-box;max-width:600px;width:calc(100% - 32px);margin:16px auto;padding:12px;border-radius:8px;background:#29202c;color:#fff;font:14px/1.5 Arial,sans-serif;text-align:center';
      document.body.appendChild(notice);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
  }
  window.siteStorage = {
    get status() { return { persistent }; },
    getItem(key) {
      if (fallback.has(key)) return fallback.get(key);
      try { return localStorage.getItem(key); }
      catch { statusChanged(false); notify(); return null; }
    },
    setItem(key, value) {
      try { localStorage.setItem(key, String(value)); fallback.delete(key); statusChanged(true); return true; }
      catch { fallback.set(key, String(value)); statusChanged(false); notify(); return false; }
    },
    removeItem(key) {
      try { localStorage.removeItem(key); fallback.delete(key); statusChanged(persistent); return true; }
      catch { fallback.set(key, null); statusChanged(false); notify(); return false; }
    }
  };
  window.siteHttpUrl = function (value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  };
})();
