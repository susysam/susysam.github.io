// Local profiles are a convenience on this browser, not access control.
(function () {
  const key = 'localProfile';
  const iterations = 210000;
  const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  async function digest(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bytes = Uint8Array.from(salt.match(/../g), value => parseInt(value, 16));
    const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes, iterations, hash: 'SHA-256' }, material, 256);
    return hex(new Uint8Array(result));
  }
  function read() {
    try {
      const profile = JSON.parse(siteStorage.getItem(key));
      return profile && typeof profile.username === 'string' &&
        /^[a-f0-9]{32}$/.test(profile.salt) && /^[a-f0-9]{64}$/.test(profile.hash) ? profile : null;
    } catch { return null; }
  }
  async function create(username, password) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const profile = { username, salt, hash: await digest(password, salt) };
    const persisted = siteStorage.setItem(key, JSON.stringify(profile));
    if (persisted) {
      siteStorage.removeItem('password');
      siteStorage.removeItem('username');
    }
  }
  const ready = (async () => {
    const username = siteStorage.getItem('username');
    const password = siteStorage.getItem('password');
    if (!read() && username && password !== null) await create(username, password);
    else if (read()) {
      siteStorage.removeItem('password');
      siteStorage.removeItem('username');
    }
  })();
  // Keep a failed migration from causing an unhandled rejection on page load.
  ready.catch(() => {});
  window.localProfile = {
    ready,
    create,
    async verify(username, password) {
      await ready;
      const profile = read();
      return !!profile && profile.username === username && await digest(password, profile.salt) === profile.hash;
    }
  };
})();
