import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from '../account-errors.js';
import { SyncController, CloudConflict, readLocal, replaceLocal, validateData, validateCloudData, MAX_CLOUD_BYTES, sameData } from '../cloud-sync-core.js';

function storage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return { items, getItem: key => items.get(key) ?? null,
    setItem(key, value) { items.set(key, value); return true; },
    removeItem(key) { items.delete(key); return true; } };
}
function setup(local = {}, remote = null, owner = null) {
  const device = storage(local);
  let cloud = remote;
  let writes = 0;
  const states = [];
  const adapter = {
    readLocal: () => readLocal(device), writeLocal: data => replaceLocal(device, data),
    getOwner: () => owner, setOwner: uid => { owner = uid; },
    readCloud: async () => structuredClone(cloud),
    writeCloud: async (uid, data, expected) => {
      if (expected !== undefined && (cloud?.revision ?? null) !== expected) throw new CloudConflict(structuredClone(cloud));
      cloud = { data: structuredClone(data), revision: 'revision-' + (++writes) };
      return structuredClone(cloud);
    },
    status: state => states.push(state)
  };
  const controller = new SyncController(adapter);
  return { controller, adapter, device, states, cloud: () => cloud, writes: () => writes,
    setCloud: next => { cloud = next; } };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('only approved app data is selected; credentials never enter sync', () => {
  const device = storage({ theme: 'dark', password: 'secret', localProfile: 'hash', rememberedUsername: 'private', firebaseToken: 'token' });
  assert.deepEqual(readLocal(device), { theme: 'dark' });
  assert.throws(() => validateData({ password: 'secret' }));
  assert.throws(() => validateData({ customGames: '{}' }));
  assert.throws(() => validateData({ backgroundUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateData({ backgroundUrl: 'https://user:pass@example.com/' }));
});
test('cloud limit counts UTF-8 bytes and is stricter than file-backup limit', () => {
  const data = { customGames: JSON.stringify([{ name: '😀'.repeat(230000), link: 'https://example.com' }]) };
  assert(new TextEncoder().encode(data.customGames).length > MAX_CLOUD_BYTES);
  assert.doesNotThrow(() => validateData(data));
  assert.throws(() => validateCloudData(data), /too large/);
});
test('applying cloud data rolls back on storage failure without touching credentials', () => {
  const device = storage({ theme: 'light', backgroundUrl: '#ffffff', localProfile: 'keep' });
  const original = device.setItem;
  device.setItem = (key, value) => value === '#000000' ? false : original(key, value);
  assert.throws(() => replaceLocal(device, { theme: 'dark', backgroundUrl: '#000000' }), /restored/);
  assert.equal(device.getItem('theme'), 'light');
  assert.equal(device.getItem('backgroundUrl'), '#ffffff');
  assert.equal(device.getItem('localProfile'), 'keep');
});
test('first sign-in creates a cloud copy of local app data', async () => {
  const h = setup({ theme: 'dark', localProfile: 'private' });
  await h.controller.connect('alice');
  assert.deepEqual(h.cloud().data, { theme: 'dark' });
  assert.equal(h.writes(), 1);
  assert.equal(h.controller.phase, 'synced');
  h.controller.disconnect();
});
test('different copies pause until the user explicitly selects cloud', async () => {
  const h = setup({ theme: 'light', localProfile: 'keep' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  assert.equal(h.controller.phase, 'conflict');
  assert.equal(h.writes(), 0);
  assert.equal(h.device.getItem('theme'), 'light');
  await h.controller.chooseCloud();
  assert.equal(h.device.getItem('theme'), 'dark');
  assert.equal(h.device.getItem('localProfile'), 'keep');
  h.controller.disconnect();
});
test('choosing this device writes only after explicit selection', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  await h.controller.chooseLocal();
  assert.deepEqual(h.cloud().data, { theme: 'light' });
  assert.equal(h.controller.phase, 'synced');
  h.controller.disconnect();
});
test('concurrent remote edit is not overwritten by a stale device', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'light' }, revision: 'old' });
  await h.controller.connect('alice');
  h.device.setItem('theme', 'dark');
  h.setCloud({ data: { theme: 'light', performanceMode: 'on' }, revision: 'newer' });
  await h.controller.save();
  assert.equal(h.controller.phase, 'conflict');
  assert.equal(h.cloud().revision, 'newer');
  assert.equal(h.device.getItem('theme'), 'dark');
  h.controller.disconnect();
});
test('newer cloud data requires another choice even after clicking use cloud', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  h.setCloud({ data: { theme: 'dark', performanceMode: 'on' }, revision: 'newer' });
  await h.controller.chooseCloud();
  assert.equal(h.controller.phase, 'conflict');
  assert.equal(h.device.getItem('theme'), 'light');
  h.controller.disconnect();
});
test('device edits made while loading a selected cloud copy are preserved', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  const read = deferred(); h.adapter.readCloud = () => read.promise;
  const choosing = h.controller.chooseCloud();
  h.device.setItem('performanceMode', 'on');
  read.resolve(h.cloud()); await choosing;
  assert.equal(h.controller.phase, 'conflict');
  assert.equal(h.device.getItem('performanceMode'), 'on');
  h.controller.disconnect();
});
test('offline writes retain local data and do not claim to be synced', async () => {
  const h = setup({ theme: 'dark' });
  h.adapter.writeCloud = async () => { throw new Error('Offline'); };
  await h.controller.connect('alice');
  assert.equal(h.controller.phase, 'error');
  assert.equal(h.device.getItem('theme'), 'dark');
  assert.equal(h.cloud(), null);
  h.controller.disconnect();
});
test('switching accounts never automatically uploads the previous account data', async () => {
  const h = setup({ theme: 'dark' }, null, 'alice');
  await h.controller.connect('bob');
  assert.equal(h.controller.phase, 'conflict');
  assert.equal(h.writes(), 0);
  h.controller.disconnect();
});
test('late response from a signed-out account cannot change the new state', async () => {
  const h = setup({ theme: 'light' });
  const read = deferred(); h.adapter.readCloud = () => read.promise;
  const loading = h.controller.connect('alice');
  h.controller.disconnect();
  read.resolve({ data: { theme: 'dark' }, revision: 'old' }); await loading;
  assert.equal(h.controller.phase, 'local');
  assert.equal(h.writes(), 0);
  assert.equal(h.device.getItem('theme'), 'light');
});
test('two-second debounce batches local changes into one upload', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'light' }, revision: 'old' });
  await h.controller.connect('alice');
  h.device.setItem('theme', 'dark'); h.controller.changed();
  h.device.setItem('performanceMode', 'on'); h.controller.changed();
  assert.equal(h.writes(), 0);
  await new Promise(resolve => setTimeout(resolve, 2200));
  assert.equal(h.writes(), 1);
  assert(sameData(h.cloud().data, readLocal(h.device)));
  h.controller.disconnect();
});
test('delete all clears both copies and leaves a marker that blocks stale restoration', async () => {
  const h = setup({ theme: 'dark' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  await h.controller.clearCloudAndDevice();
  assert.deepEqual(h.cloud().data, {});
  assert.deepEqual(readLocal(h.device), {});
  h.device.setItem('theme', 'dark'); // A stale second device later signs in.
  await h.controller.connect('alice');
  assert.equal(h.controller.phase, 'conflict');
  assert.deepEqual(h.cloud().data, {});
  h.controller.disconnect();
});
test('failed cloud deletion does not clear the local copy', async () => {
  const h = setup({ theme: 'dark' }, { data: { theme: 'dark' }, revision: 'old' });
  await h.controller.connect('alice');
  h.adapter.writeCloud = async () => { throw new Error('Offline'); };
  await assert.rejects(h.controller.clearCloudAndDevice(), /Offline/);
  assert.equal(h.device.getItem('theme'), 'dark');
  h.controller.disconnect();
});

test('a second save waits for current edits and does not leak an offline rejection', async () => {
  const h = setup({ theme: 'light' }, { data: { theme: 'light' }, revision: 'old' });
  await h.controller.connect('alice');
  const write = deferred(); h.adapter.writeCloud = () => write.promise;
  h.device.setItem('theme', 'dark');
  const first = h.controller.save();
  const second = h.controller.save();
  write.reject(new Error('Offline'));
  await Promise.all([first, second]);
  assert.equal(h.controller.phase, 'error');
  assert.equal(h.device.getItem('theme'), 'dark');
  h.controller.disconnect();
});

test('a synchronous adapter failure keeps local data and reports an error', async () => {
  const h = setup({ theme: 'dark' });
  h.adapter.writeCloud = () => { throw new Error('Unavailable'); };
  await h.controller.connect('alice');
  assert.equal(h.controller.phase, 'error');
  assert.equal(h.device.getItem('theme'), 'dark');
  h.controller.disconnect();
});

test('account errors give useful messages without leaking backend error details', () => {
  assert.match(friendlyError({ code: 'auth/invalid-credential' }), /Email or password is incorrect/);
  assert.match(friendlyError({ code: 'auth/email-already-in-use' }), /already has an account/);
  assert.match(friendlyError({ code: 'auth/weak-password' }), /at least 8 characters/);
  assert.match(friendlyError({ code: 'permission-denied' }), /rules/);
  assert.doesNotMatch(friendlyError({ code: 'unknown', message: 'secret detail' }), /secret detail/);
});
