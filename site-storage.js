// Keep the page usable when browser storage is blocked or full,
// and apply shared navigation icon preferences across Home and Settings.
(function () {
  const fallback = new Map();
  let persistent = false;

  function statusChanged(ok) {
    persistent = ok && fallback.size === 0;
    window.dispatchEvent(new Event('site-storage-status'));
  }

  // Probe a unique temporary key without changing application data.
  try {
    const probe = '__susysam_probe_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
    localStorage.setItem(probe, probe);
    persistent = localStorage.getItem(probe) === probe;
    localStorage.removeItem(probe);
  } catch {
    persistent = false;
  }

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
      try {
        return localStorage.getItem(key);
      } catch {
        statusChanged(false);
        notify();
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, String(value));
        fallback.delete(key);
        statusChanged(true);
        window.dispatchEvent(new CustomEvent('site-storage-write', { detail: { key, value: String(value) } }));
        return true;
      } catch {
        fallback.set(key, String(value));
        statusChanged(false);
        notify();
        return false;
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
        fallback.delete(key);
        statusChanged(persistent);
        window.dispatchEvent(new CustomEvent('site-storage-write', { detail: { key, value: null } }));
        return true;
      } catch {
        fallback.set(key, null);
        statusChanged(false);
        notify();
        return false;
      }
    }
  };

  window.siteHttpUrl = function (value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  };

  // ── Shared Home Navigation Icons & Settings Toggle Enhancer ──
  const NAV_ICONS_KEY = 'navIcons';
  const ICON_MAP = {
    'games.html': {
      label: 'Games + Apps',
      src: '/images/games.png',
      altSrc: 'images/games.png',
      svg: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4m-2-2v4"/><circle cx="15" cy="11" r="1" fill="#ffffff"/><circle cx="17" cy="13" r="1" fill="#ffffff"/></svg>')
    },
    'tabs.html': {
      label: 'Tabs',
      src: '/images/tab.png',
      altSrc: 'images/tab.png',
      svg: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v5"/></svg>')
    },
    'movie+tv.html': {
      label: 'Movie + TV',
      src: '/images/movies.png',
      altSrc: 'images/movies.png',
      svg: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8h20M7 4l3 4M14 4l3 4"/><polygon points="10 11 16 14 10 17 10 11" fill="#ffffff" stroke="none"/></svg>')
    }
  };

  function injectNavIconStyles() {
    if (document.getElementById('susysam-nav-icon-styles')) return;
    const style = document.createElement('style');
    style.id = 'susysam-nav-icon-styles';
    style.textContent = `
      .navbar a.nav-feature-link {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px;
      }
      .navbar.icons-on a.nav-feature-link {
        padding: 8px !important;
        width: 60px !important;
        height: 60px !important;
        min-width: 60px !important;
        border-radius: 12px !important;
        overflow: hidden;
      }
      .navbar .nav-link-icon {
        width: 46px;
        height: 46px;
        object-fit: contain;
        transform: scale(2.1);
        display: none !important;
        pointer-events: none;
      }
      .navbar.icons-on .nav-link-icon {
        display: block !important;
      }
      .navbar.icons-on .nav-link-text {
        display: none !important;
      }
      .navbar:not(.icons-on) .nav-link-text {
        display: inline !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyHomeNavbarIcons() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    injectNavIconStyles();

    navbar.querySelectorAll('a[href]').forEach(link => {
      const rawHref = (link.getAttribute('href') || '').replace(/^\//, '');
      const cfg = ICON_MAP[rawHref];
      if (!cfg) return;

      link.classList.add('nav-feature-link');
      link.title = cfg.label;
      link.setAttribute('aria-label', cfg.label);

      if (!link.querySelector('.nav-link-icon')) {
        const img = document.createElement('img');
        img.className = 'nav-link-icon';
        img.src = cfg.src;
        img.alt = cfg.label;
        img.addEventListener('error', function () {
          if (!img.dataset.triedAlt) {
            img.dataset.triedAlt = 'true';
            img.src = cfg.altSrc;
          } else if (img.src !== cfg.svg) {
            img.src = cfg.svg;
          }
        });

        const span = document.createElement('span');
        span.className = 'nav-link-text';
        span.textContent = cfg.label;

        link.replaceChildren(img, span);
      }
    });

    const mode = window.siteStorage.getItem(NAV_ICONS_KEY) || 'on';
    navbar.classList.toggle('icons-on', mode !== 'off');
  }

  function injectSettingsNavToggle() {
    const generalPanel = document.querySelector('#settings-general .card-body');
    if (!generalPanel || document.getElementById('navIconsToggle')) return;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="left">
        <p class="label">Home navigation style (Icons vs. Words)</p>
        <p class="hint">On = Images (icons for Games + Apps, Tabs, and Movie + TV). Off = Words.</p>
      </div>
      <label class="toggle">
        <input type="checkbox" id="navIconsToggle" aria-label="Home navigation style: On for Images, Off for Words">
        <span class="switch" aria-hidden="true"></span>
      </label>
    `;
    generalPanel.insertBefore(row, generalPanel.firstChild);

    const toggle = row.querySelector('#navIconsToggle');
    const syncToggleState = () => {
      const mode = window.siteStorage.getItem(NAV_ICONS_KEY) || 'on';
      toggle.checked = mode !== 'off';
    };
    syncToggleState();

    toggle.addEventListener('change', () => {
      const mode = toggle.checked ? 'on' : 'off';
      window.siteStorage.setItem(NAV_ICONS_KEY, mode);
      const toastEl = document.getElementById('toast');
      if (toastEl) {
        toastEl.textContent = toggle.checked ? 'Navigation set to Images' : 'Navigation set to Words';
        toastEl.classList.add('show');
        clearTimeout(window.__toastT);
        window.__toastT = setTimeout(() => toastEl.classList.remove('show'), 1600);
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key === NAV_ICONS_KEY) syncToggleState();
    });
  }

  function initSharedEnhancements() {
    applyHomeNavbarIcons();
    injectSettingsNavToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedEnhancements, { once: true });
  } else {
    initSharedEnhancements();
  }

  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === NAV_ICONS_KEY) {
      applyHomeNavbarIcons();
    }
  });
  window.addEventListener('site-storage-write', (e) => {
    if (!e.detail || e.detail.key === NAV_ICONS_KEY) {
      applyHomeNavbarIcons();
    }
  });
})();
