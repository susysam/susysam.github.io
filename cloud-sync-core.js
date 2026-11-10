import { validTimeZone } from './time-preferences.js';
// Only application data is synced. Local login hashes and Firebase tokens are excluded.
export const DATA_KEYS = Object.freeze(['theme', 'backgroundUrl', 'customBackgroundPresets',
  'performanceMode', 'customGames', 'tabs_saved_links', 'youtube_saved_videos', 'lastWatched', 'recentImdbMedia', 'timeZone']);
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
    if (key === 'youtube_saved_videos') {
      const videos = JSON.parse(value);
      if (!Array.isArray(videos) || videos.length > 6 ||
          videos.some(video => !video || typeof video !== 'object' || Array.isArray(video) ||
            Object.keys(video).some(field => !['id', 'title'].includes(field)) ||
            typeof video.id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(video.id) ||
            typeof video.title !== 'string' || !video.title.trim() || video.title.length > 60) ||
          new Set(videos.map(video => video.id)).size !== videos.length) {
        throw new Error('Invalid saved videos.');
      }
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
    this.mode = null;
  }
  status(phase, message) {
    this.phase = phase;
    this.adapter.status({ phase, message, signedIn: !!this.uid, mode: this.mode });
  }
  disconnect(silent = false) {
    this.cancelScheduledSave();
    this.generation++;
    this.uid = null;
    this.ready = false;
    this.pending = null;
    this.remote = null;
    this.base = null;
    this.mode = null;
    if (!silent) this.status('local', 'Sign in to enable cloud saving.');
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
    this.disconnect(true);
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
      // Existing documents predate the mode field and have always been cloud accounts.
      this.mode = remote ? (remote.mode || 'cloud') : null;
      if (!this.mode) return this.status('choice', 'Choose where this account saves its data.');
      if (this.mode === 'device') {
        this.adapter.setOwner(uid);
        return this.status('device', 'Saved on this device');
      }
      if (owner && owner !== uid && Object.keys(local).length) {
        return this.conflict(remote, 'This device has data from another account. Choose a copy before linking it to this account.');
      }
      const lastSynced = owner === uid ? this.adapter.getLastSynced?.(uid) : null;
      const localIsUnchanged = lastSynced ? sameData(lastSynced, local) : !Object.keys(local).length;
      if (remote && !sameData(remote.data, local) && localIsUnchanged) {
        this.adapter.writeLocal(remote.data);
        this.adapter.setLastSynced?.(uid, remote.data);
        this.adapter.setDeletionMarker?.(uid, !Object.keys(remote.data).length);
        this.adapter.setOwner(uid);
        this.ready = true;
        return this.status('synced', 'Synced');
      }
      if (remote && lastSynced && !this.adapter.getDeletionMarker?.(uid) &&
          sameData(lastSynced, remote.data) && !sameData(remote.data, local)) {
        this.ready = true;
        await this.save();
        return;
      }
      if (remote && !sameData(remote.data, local)) return this.conflict(remote);
      this.ready = true;
      this.adapter.setOwner(uid);
      this.adapter.setLastSynced?.(uid, local);
      this.status('synced', 'Synced');
    } catch (error) { if (generation === this.generation) this.fail(error); }
  }
  changed() {
    if (!this.uid || this.mode !== 'cloud' || !this.ready) return;
    this.cancelScheduledSave();
    this.status('pending', 'Cloud changes pending…');
    this.timer = setTimeout(() => { void this.save(); }, 2000);
  }
  cancelScheduledSave() {
    clearTimeout(this.timer);
    this.timer = null;
  }
  async save() {
    this.cancelScheduledSave();
    if (!this.uid || this.mode !== 'cloud' || !this.ready) return;
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
      this.adapter.setLastSynced?.(uid, data);
      this.adapter.setDeletionMarker?.(uid, false);
      if (sameData(data, this.adapter.readLocal())) this.status('synced', 'Synced');
      else this.changed();
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof CloudConflict && error.remote?.mode === 'device') {
        this.mode = 'device';
        this.base = error.remote.revision;
        this.ready = false;
        this.status('device', 'Saved on this device');
      } else if (error instanceof CloudConflict && error.remote &&
          sameData(error.remote.data, this.adapter.readLocal())) {
        this.base = error.remote.revision;
        this.adapter.setLastSynced?.(uid, error.remote.data);
        this.adapter.setDeletionMarker?.(uid, false);
        this.status('synced', 'Synced');
      } else if (error instanceof CloudConflict) this.conflict(error.remote);
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
      this.adapter.setLastSynced?.(uid, data);
      this.adapter.setDeletionMarker?.(uid, !Object.keys(data).length);
      this.ready = true;
      if (!remote) await this.save();
      else if (remote.mode === 'device') {
        const updated = await this.adapter.writeMode(uid, 'cloud', remote.revision);
        if (generation !== this.generation) return;
        this.base = updated.revision;
        this.status('synced', 'Synced');
      } else this.status('synced', 'Synced · Cloud copy applied');
    } catch (error) { if (generation === this.generation) this.fail(error); }
  }
  async chooseLocal() {
    if (this.phase !== 'conflict') return;
    this.ready = true;
    await this.save();
  }
  async selectMode(mode) {
    if (!this.uid || !['cloud', 'device'].includes(mode)) return;
    if (this.mode === mode) return;
    const uid = this.uid;
    const generation = this.generation;
    this.cancelScheduledSave();
    this.ready = false;
    if (this.pending) { try { await this.pending; } catch {} }
    if (generation !== this.generation) return;
    this.status('loading', 'Updating your saving choice…');
    try {
      const remote = await this.adapter.readCloud(uid);
      if (generation !== this.generation) return;
      if (mode === 'cloud' && remote && !sameData(remote.data, this.adapter.readLocal())) {
        this.mode = 'cloud';
        return this.conflict(remote, 'Choose which copy to keep before enabling cloud saving.');
      }
      const updated = await this.adapter.writeMode(uid, mode, remote?.revision ?? null);
      if (generation !== this.generation) return;
      this.mode = mode;
      this.base = updated.revision;
      this.adapter.setOwner(uid);
      if (mode === 'cloud') {
        this.ready = true;
        if (!sameData(updated.data, this.adapter.readLocal())) await this.save();
        else {
          this.adapter.setLastSynced?.(uid, updated.data);
          this.adapter.setDeletionMarker?.(uid, false);
          this.status('synced', 'Synced');
        }
      } else this.status('device', 'Saved on this device');
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof CloudConflict) {
        this.mode = error.remote?.mode || null;
        this.base = error.remote?.revision ?? null;
        this.status('error', 'Saving choice changed on another device. Retry connection.');
      }
      else this.fail(error);
    }
  }
  async clearCloudAndDevice() {
    if (!this.uid) return;
    if (this.mode === null) {
      this.adapter.writeLocal({});
      this.status('choice', 'Choose where this account saves its data.');
      return;
    }
    const uid = this.uid;
    const generation = this.generation;
    this.cancelScheduledSave();
    this.ready = false;
    if (this.pending) { try { await this.pending; } catch {} }
    if (generation !== this.generation) throw new Error('Account changed. Please try again.');
    this.status('saving', 'Deleting synced site data…');
    try {
      // An empty versioned document prevents stale devices from silently restoring deleted data.
      const remote = await this.adapter.clearCloud(uid, this.mode);
      if (generation !== this.generation) throw new Error('Account changed. Please try again.');
      this.adapter.writeLocal({});
      this.base = remote.revision;
      this.mode = remote.mode || this.mode;
      this.ready = this.mode === 'cloud';
      this.adapter.setOwner(uid);
      this.adapter.setLastSynced?.(uid, {});
      this.adapter.setDeletionMarker?.(uid, true);
      this.status(this.mode === 'device' ? 'device' : 'synced', 'Site data deleted · Your account is kept');
    } catch (error) {
      if (generation === this.generation) this.fail(error);
      throw error;
    }
  }
}
