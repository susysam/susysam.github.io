// Shared appearance and performance settings for site pages.
(function () {
  const presets = {
    '#0d0d14': { glow1: 'rgba(255,140,0,.15)', glow2: 'rgba(120,0,255,.12)' },
    '#1f0f1d': { glow1: 'rgba(255,85,0,.18)', glow2: 'rgba(255,0,128,.14)' },
    '#050c08': { glow1: 'rgba(0,255,100,.12)', glow2: 'rgba(0,150,255,.10)' },
    '#12131a': { glow1: 'rgba(0,240,255,.15)', glow2: 'rgba(255,0,240,.15)' },
    '#0e171e': { glow1: 'rgba(0,198,255,.14)', glow2: 'rgba(20,100,240,.10)' },
    '#1f1112': { glow1: 'rgba(255,70,80,.16)', glow2: 'rgba(140,20,30,.12)' },
    '#1a1316': { glow1: 'rgba(240,120,180,.15)', glow2: 'rgba(180,70,140,.12)' },
    '#f6f7fb': { glow1: 'rgba(108,11,169,.12)', glow2: 'rgba(79,6,114,.10)' }
  };
  const paletteProperties = [
    '--bg', '--text', '--muted', '--card', '--card-hover', '--border',
    '--border-hover', '--inputBg', '--overlay', '--glow1', '--glow2'
  ];
  const root = document.documentElement;

  const style = document.createElement('style');
  style.textContent = `
    html[data-site-preset] { background-color: var(--bg) !important; color: var(--text) !important; }
    html[data-site-preset] body { background-color: var(--bg) !important; color: var(--text); }
    html[data-site-preset] body::before {
      background: radial-gradient(ellipse at 12% 12%, var(--glow1), transparent 60%),
                  radial-gradient(ellipse at 88% 80%, var(--glow2), transparent 60%) !important;
    }
    html[data-site-preset="light"] header { background-color: rgba(255,255,255,.82); }
    html.performance-mode *, html.performance-mode *::before, html.performance-mode *::after {
      animation: none !important;
      transition: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      filter: none !important;
      box-shadow: none !important;
    }
    html.performance-mode .app-container { opacity: 1 !important; transform: none !important; }
    html.performance-mode body::before { display: none !important; }
  `;
  document.head.appendChild(style);

  window.applySiteAppearance = function () {
    const saved = localStorage.getItem('backgroundUrl') || '';
    const preset = presets[saved.toLowerCase()];
    paletteProperties.forEach(property => root.style.removeProperty(property));

    if (preset) {
      const light = saved.toLowerCase() === '#f6f7fb';
      root.dataset.sitePreset = light ? 'light' : 'dark';
      root.classList.toggle('dark', !light);
      const colors = light ? {
        '--bg': '#f6f7fb',
        '--text': '#14161a',
        '--muted': 'rgba(20,22,26,.65)',
        '--card': 'rgba(255,255,255,.85)',
        '--card-hover': 'rgba(255,255,255,.95)',
        '--border': 'rgba(0,0,0,.12)',
        '--border-hover': 'rgba(0,0,0,.35)',
        '--inputBg': 'rgba(255,255,255,.85)',
        '--overlay': 'transparent'
      } : {
        '--bg': saved,
        '--text': '#f2f4f8',
        '--muted': 'rgba(242,244,248,.72)',
        '--card': 'rgba(25,28,36,.78)',
        '--card-hover': 'rgba(40,44,54,.88)',
        '--border': 'rgba(255,255,255,.18)',
        '--border-hover': 'rgba(255,255,255,.42)',
        '--inputBg': 'rgba(0,0,0,.28)',
        '--overlay': 'transparent'
      };
      colors['--glow1'] = preset.glow1;
      colors['--glow2'] = preset.glow2;
      Object.entries(colors).forEach(([property, value]) => root.style.setProperty(property, value));
    } else {
      delete root.dataset.sitePreset;
      root.classList.toggle('dark', localStorage.getItem('theme') === 'dark');
    }

    root.classList.toggle('performance-mode', localStorage.getItem('performanceMode') === 'on');
  };

  window.applySiteAppearance();
  window.addEventListener('storage', event => {
    if (['theme', 'backgroundUrl', 'performanceMode'].includes(event.key)) {
      window.applySiteAppearance();
    }
  });
})();
