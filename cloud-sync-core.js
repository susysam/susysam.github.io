import { validTimeZone } from './time-preferences.js';
// Only application data is synced. Local login hashes and Firebase tokens are excluded.
export const DATA_KEYS = Object.freeze(['theme', 'backgroundUrl', 'customBackgroundPresets',
  'performanceMode', 'customGames', 'tabs_saved_links', 'lastWatched', 'recentImdbMedia', 'timeZone']);
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
// Leave room below Firestore's 1 MiB document limit for field names and metadata.
export const MAX_CLOUD_BYTES = 900000;
export const canonical = data => JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))));
export const sameData = (a, b) => canonical(a) === canonical(b);

export function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid saved data.');
  for (const [key, value] of Object.entries(data)) {
    if (!DATA_KEYS.includes(key) || typeof value !== 'string') throw new Error('Unsupported saved data.');
    if (key === 'theme' && !['dark', 'light'].includes(value)) throw new Error('Invalid theme.');
    if (key === 'performanceMode' && !['on', 'off'].includes(value)) throw new Error('Invalid performance mode.');
    if (key === 'timeZone' && !validTimeZone(value)) throw new Error('Invalid timezone.');
    if (key === 'backgroundUrl' && value && !/^#[0-9a-f]{6}$/i.test(value)) {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid background URL.');
    }
    if (['customBackgroundPresets', 'customGames', 'tabs_saved_links', 'recentImdbMedia'].includes(key)) {
      if (!Array.isArray(JSON.parse(value))) throw new Error('Invalid saved list.');
    }
    if (key === 'lastWatched') {
      const item = JSON.parse(value);
      if (item !== null && (typeof item !== 'object' || Array.isArray(item))) throw new Error('Invalid viewing history.');
    }
  }
  const bytes = new TextEncoder().encode(canonical(data)).byteLength;
  if (bytes > MAX_BACKUP_BYTES) throw new Error('Data exceeds the 2 MB backup limit. Export smaller categories before syncing.');
  return data;
}

export function validateCloudData(data) {
  validateData(data);
  if (new TextEncoder().encode(canonical(data)).byteLength > MAX_CLOUD_BYTES) {
    throw new Error('Data is too large for cloud sync (900 KB limit). File backups still support 2 MB. Check device storage status before leaving.');
  }
  return data;
}

export function readLocal(storage) {
  const data = {};
  DATA_KEYS.forEach(key => {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  });
  return data;
}

export function replaceLocal(storage, data) {
  validateData(data);
  const before = readLocal(storage);
  try {
    for (const key of DATA_KEYS) {
      const result = Object.hasOwn(data, key) ? storage.setItem(key, data[key]) : storage.removeItem(key);
      if (result === false) throw new Error('Browser storage is unavailable or full.');
    }
  } catch {
    let restored = true;
    for (const key of DATA_KEYS) {
      try {
        const result = Object.hasOwn(before, key) ? storage.setItem(key, before[key]) : storage.removeItem(key);
        if (result === false) restored = false;
      } catch { restored = false; }
    }
    throw new Error(restored ? 'Cloud data was not applied. Previous device data was restored.' :
      'Browser storage failed and could not fully restore device data. Your cloud copy is unchanged; export a backup before retrying.');
  }
}

export class CloudConflict extends Error {
  constructor(remote) { super('Cloud data changed on another device. Choose which copy to keep.'); this.remote = remote; }
}

// The Firebase adapter is injected so races and failures can be tested without real accounts.
export class SyncController {
  constructor(adapter) {
    this.adapter = adapter;
    this.generation = 0;
    this.uid = null;
    this.ready = false;
    this.pending = null;
    this.timer = null;
    this.remote = null;
    this.base = null;
    this.phase = 'local';
  }
  status(phase, message) {
    this.phase = phase;
    this.adapter.status({ phase, message, signedIn: !!this.uid });
  }
  disconnect() {
    clearTimeout(this.timer);
    this.generation++;
    this.uid = null;
    this.ready = false;
    this.pending = null;
    this.remote = null;
    this.status('local', 'Sign in to enable cloud saving.');
  }
  conflict(remote, message = 'Cloud and device data differ. Choose a copy before syncing.') {
    this.remote = remote;
    this.base = remote?.revision ?? null;
    this.ready = false;
    this.status('conflict', message);
  }
  fail(error) {
    this.ready = false;
    this.status('error', this.adapter.errorMessage?.(error) || error.message || 'Cloud unavailable. Your device data is kept.');
  }
  async connect(uid) {
    this.disconnect();
    this.uid = uid;
    const generation = this.generation;
    this.status('loading', 'Checking cloud data…');
    try {
      const remote = await this.adapter.readCloud(uid);
      if (generation !== this.generation) return;
      if (remote) validateCloudData(remote.data);
      const local = this.adapter.readLocal();
      const owner = this.adapter.getOwner();
      this.base = remote?.revision ?? null;
      if (owner && owner !== uid && Object.keys(local).length) {
        return this.conflict(remote, 'This device has data from another account. Choose a copy before linking it to this account.');
      }
      if (remote && !sameData(remote.data, local)) return this.conflict(remote);
      this.ready = true;
      if (!remote) await this.save();
      else {
        this.adapter.setOwner(uid);
        this.status('synced', 'Synced');
      }
    } catch (error) { if (generation === this.generation) this.fail(error); }
  }
  changed() {
    if (!this.uid || !this.ready) return;
    clearTimeout(this.timer);
    this.status('pending', 'Cloud changes pending…');
    this.timer = setTimeout(() => { void this.save(); }, 2000);
  }
  async save() {
    clearTimeout(this.timer);
    if (!this.uid || !this.ready) return;
    if (this.pending) {
      const generation = this.generation;
      // The original save reports failures. A second caller must not leak a rejection
      // or schedule data from a different account after an in-flight request ends.
      try { await this.pending; } catch { return; }
      if (generation === this.generation && this.ready) await this.save();
      return;
    }
    const uid = this.uid;
    const generation = this.generation;
    let data;
    try { data = validateCloudData(this.adapter.readLocal()); }
    catch (error) { this.fail(error); return; }
    this.status('saving', 'Syncing…');
    const task = Promise.resolve().then(() => this.adapter.writeCloud(uid, data, this.base));
    this.pending = task;
    try {
      const remote = await task;
      if (generation !== this.generation) return;
      this.base = remote.revision;
      this.adapter.setOwner(uid);
      if (sameData(data, this.adapter.readLocal())) this.status('synced', 'Synced');
      else this.changed();
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof CloudConflict) this.conflict(error.remote);
      else this.fail(error);
    } finally { if (this.pending === task) this.pending = null; }
  }
  async chooseCloud() {
    if (this.phase !== 'conflict') return;
    // Recheck before applying: another device may have changed the cloud copy meanwhile.
    const generation = this.generation;
    const uid = this.uid;
    const localAtChoice = this.adapter.readLocal();
    this.status('loading', 'Loading the current cloud copy…');
    try {
      const remote = await this.adapter.readCloud(uid);
      if (generation !== this.generation) return;
      if ((remote?.revision ?? null) !== this.base) return this.conflict(remote, 'Cloud data changed again. Review your choice and try again.');
      if (!sameData(localAtChoice, this.adapter.readLocal())) return this.conflict(remote, 'Device data changed while loading. Review your choice and try again.');
      const data = validateCloudData(remote?.data ?? {});
      this.adapter.writeLocal(data);
      this.adapter.setOwner(uid);
      this.ready = true;
      if (!remote) await this.save();
      else this.status('synced', 'Synced · Cloud copy applied');
    } catch (error) { if (generation === this.generation) this.fail(error); }
  }
  async chooseLocal() {
    if (this.phase !== 'conflict') return;
    this.ready = true;
    await this.save();
  }
  async clearCloudAndDevice() {
    if (!this.uid) return;
    const uid = this.uid;
    const generation = this.generation;
    clearTimeout(this.timer);
    this.ready = false;
    if (this.pending) { try { await this.pending; } catch {} }
    if (generation !== this.generation) throw new Error('Account changed. Please try again.');
    this.status('saving', 'Deleting synced site data…');
    try {
      // An empty versioned document prevents stale devices from silently restoring deleted data.
      const remote = await this.adapter.writeCloud(uid, {}, undefined);
      if (generation !== this.generation) throw new Error('Account changed. Please try again.');
      this.adapter.writeLocal({});
      this.base = remote.revision;
      this.ready = true;
      this.adapter.setOwner(uid);
      this.status('synced', 'Site data deleted · Your account is kept');
    } catch (error) {
      if (generation === this.generation) this.fail(error);
      throw error;
    }
  }
}
