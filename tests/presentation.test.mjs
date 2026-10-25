import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { syncPresentation } from '../sync-presentation.js';
import { formatClock, validTimeZone } from '../time-preferences.js';
import { validateData, readLocal, replaceLocal } from '../cloud-sync-core.js';

test('only a confirmed signed-in synced state is green', () => {
  for (const phase of ['local', 'loading', 'pending', 'saving', 'error', 'conflict']) {
    assert.notEqual(syncPresentation({ phase, user: { email: 'test@example.test' } }).tone, 'good');
  }
  assert.equal(syncPresentation({ phase: 'synced', user: null }).tone, 'bad');
  assert.equal(syncPresentation({ phase: 'synced', user: {} }, false).tone, 'bad');
  assert.equal(syncPresentation({ phase: 'synced', user: {} }, true).tone, 'good');
});
test('pending and failing uploads remain distinct from successful synchronization', () => {
  assert.equal(syncPresentation({ phase: 'pending', user: {} }).label, 'Syncing…');
  const failed = syncPresentation({ phase: 'error', user: {}, message: 'Upload failed' });
  assert.equal(failed.label, 'Not Synced'); assert.equal(failed.detail, 'Upload failed');
});
test('clock follows Eastern daylight saving transitions without hardcoded offsets', () => {
  assert.deepEqual(formatClock(new Date('2026-03-08T06:59:59Z'), 'America/New_York'), { time: '1:59:59 AM', abbreviation: 'EST' });
  assert.deepEqual(formatClock(new Date('2026-03-08T07:00:00Z'), 'America/New_York'), { time: '3:00:00 AM', abbreviation: 'EDT' });
  assert.equal(formatClock(new Date('2026-11-01T06:00:00Z'), 'America/New_York').abbreviation, 'EST');
});
test('timezone formatting supports Pacific and UTC and rejects invented zones', () => {
  assert.equal(formatClock(new Date('2026-07-01T12:00:00Z'), 'America/Los_Angeles').time, '5:00:00 AM');
  assert.equal(formatClock(new Date('2026-07-01T12:00:00Z'), 'UTC').time, '12:00:00 PM');
  assert.equal(validTimeZone('Invented/Zone'), false);
  assert.throws(() => validateData({ timeZone: 'Invented/Zone' }));
});
test('timezone participates in the existing storage allowlist without exposing credentials', () => {
  const values = new Map([['timeZone', 'UTC'], ['password', 'never-sync']]);
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); return true; },
    removeItem(key) { values.delete(key); return true; } };
  assert.deepEqual(readLocal(storage), { timeZone: 'UTC' });
  replaceLocal(storage, { timeZone: 'America/Chicago' });
  assert.equal(values.get('password'), 'never-sync');
  assert.equal(values.get('timeZone'), 'America/Chicago');
});
function storageHarness(blocked = false) {
  const values = new Map([['theme', 'dark']]);
  const notices = [];
  let fail = blocked;
  const localStorage = {
    getItem: key => { if (fail) throw Error('blocked'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); },
    removeItem: key => { if (fail) throw Error('blocked'); values.delete(key); }
  };
  const window = { dispatchEvent: event => notices.push(event.type) };
  vm.runInNewContext(fs.readFileSync('site-storage.js', 'utf8'), {
    window, localStorage, crypto: webcrypto, Event, URL,
    document: { readyState: 'loading', addEventListener() {} }
  });
  return { storage: window.siteStorage, values, notices, fail: value => { fail = value; } };
}
test('device status probes actual storage without leaving a key or altering saved data', () => {
  const h = storageHarness();
  assert.equal(h.storage.status.persistent, true);
  assert.deepEqual([...h.values], [['theme', 'dark']]);
});
test('blocked or failed storage is never presented as saved, and in-memory fallback survives', () => {
  const blocked = storageHarness(true); assert.equal(blocked.storage.status.persistent, false);
  const h = storageHarness(); h.fail(true);
  assert.equal(h.storage.setItem('timeZone', 'UTC'), false);
  assert.equal(h.storage.status.persistent, false);
  assert.equal(h.storage.getItem('timeZone'), 'UTC');
  h.fail(false); h.storage.setItem('theme', 'light');
  assert.equal(h.storage.status.persistent, false, 'a different successful write must not hide a failed preference');
  h.storage.setItem('timeZone', 'UTC');
  assert.equal(h.storage.status.persistent, true);
});
