// Keep the page usable when browser storage is blocked or full.
(function () {
  const fallback = new Map();
  let noticeQueued = false;
  function notify() {
    if (noticeQueued) return;
    noticeQueued = true;
    const show = () => {
      const notice = document.createElement('p');
      notice.setAttribute('role', 'status');
      notice.textContent = 'Browser storage is unavailable. Some changes will only last while this page is open.';
      notice.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;margin:0;padding:12px;border-radius:8px;background:#29202c;color:#fff;font:14px Arial,sans-serif;text-align:center';
      document.body.appendChild(notice);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
  }
  window.siteStorage = {
    getItem(key) {
      if (fallback.has(key)) return fallback.get(key);
      try { return localStorage.getItem(key); }
      catch { notify(); return null; }
    },
    setItem(key, value) {
      try { localStorage.setItem(key, String(value)); fallback.delete(key); return true; }
      catch { fallback.set(key, String(value)); notify(); return false; }
    },
    removeItem(key) {
      try { localStorage.removeItem(key); fallback.delete(key); return true; }
      catch { fallback.set(key, null); notify(); return false; }
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
