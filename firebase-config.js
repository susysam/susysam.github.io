import { friendlyError } from './account-errors.js';
export { friendlyError } from './account-errors.js';
import { DATA_KEYS, SyncController, CloudConflict, readLocal, replaceLocal, validateCloudData } from './cloud-sync-core.js';

// Firebase web configuration is public. Firestore Security Rules enforce access.
export const firebaseConfig = {
  apiKey: 'AIzaSyDtKguhzfoGU12MENX7Zoin5guhvFjDCI4',
  authDomain: 'susysam-2ae6e.firebaseapp.com',
  projectId: 'susysam-2ae6e',
  storageBucket: 'susysam-2ae6e.firebasestorage.app',
  messagingSenderId: '557569738552',
  appId: '1:557569738552:web:c0b8f0d1ed7570991ea3cd'
};

export let app, auth, firestore;
let authApi, dbApi, controller, suppressChanges = false;
const ownerKey = 'susysamCloudOwner';
const state = { phase: 'loading', message: 'Connecting to account service…', user: null, available: false };
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener({ ...state }));

function unpack(snapshot) {
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  if (value.schemaVersion !== 1 || typeof value.revision !== 'string') throw new Error('Cloud data has an unsupported format. Export your device data before changing the cloud setup.');
  return { data: validateCloudData(value.data), revision: value.revision };
}

function assertUser(uid) {
  if (auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Please retry.');
}

window.siteCloud = {
  get state() { return { ...state }; },
  subscribe(listener) { listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
  async login(email, password) {
    if (!state.available) throw new Error('Account service is unavailable. Retry when you are online.');
    await authApi.signInWithEmailAndPassword(auth, email, password);
  },
  async signup(email, password) {
    if (!state.available) throw new Error('Account service is unavailable. Retry when you are online.');
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    await authApi.createUserWithEmailAndPassword(auth, email, password);
  },
  async logout() {
    if (!auth) return;
    await authApi.signOut(auth);
  },
  async resetPassword(email) {
    if (!state.available) throw new Error('Account service is unavailable.');
    await authApi.sendPasswordResetEmail(auth, email);
  },
  async retry() {
    if (!state.available) return location.reload();
    if (auth.currentUser) await controller.connect(auth.currentUser.uid);
  },
  async useCloud() { await controller?.chooseCloud(); },
  async useDevice() { await controller?.chooseLocal(); },
  async syncNow() { await controller?.save(); },
  async beforeDeleteAll() {
    if (state.phase === 'loading' && !state.available) throw new Error('Wait for the account check to finish before deleting all data.');
    if (state.user) await controller.clearCloudAndDevice();
  }
};
window.dispatchEvent(new Event('site-cloud-ready'));

async function initialize() {
  try {
    let timeout;
    const modules = await Promise.race([
      Promise.all([
        import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')
      ]),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Account service could not load. You can keep using this device; retry when online.')), 12000); })
    ]).finally(() => clearTimeout(timeout));
    authApi = modules[1];
    dbApi = modules[2];
    app = modules[0].initializeApp(firebaseConfig);
    auth = authApi.getAuth(app);
    firestore = dbApi.initializeFirestore(app, { localCache: dbApi.memoryLocalCache() });
    await authApi.setPersistence(auth, authApi.browserLocalPersistence);
    controller = new SyncController({
      readLocal: () => readLocal(window.siteStorage),
      writeLocal(data) {
        suppressChanges = true;
        try { replaceLocal(window.siteStorage, data); }
        finally { suppressChanges = false; }
        // Existing page listeners redraw from local storage; no storage system is replaced.
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
      },
      getOwner: () => window.siteStorage.getItem(ownerKey),
      setOwner: uid => window.siteStorage.setItem(ownerKey, uid),
      async readCloud(uid) {
        assertUser(uid);
        return unpack(await dbApi.getDocFromServer(dbApi.doc(firestore, 'users', uid, 'data', 'settings')));
      },
      async writeCloud(uid, data, expectedRevision) {
        validateCloudData(data);
        assertUser(uid);
        const reference = dbApi.doc(firestore, 'users', uid, 'data', 'settings');
        const revision = crypto.randomUUID();
        await dbApi.runTransaction(firestore, async transaction => {
          const current = unpack(await transaction.get(reference));
          assertUser(uid);
          if (expectedRevision !== undefined && (current?.revision ?? null) !== expectedRevision) throw new CloudConflict(current);
          transaction.set(reference, { schemaVersion: 1, data, revision, updatedAt: dbApi.serverTimestamp() });
        }, { maxAttempts: 3 });
        return { data, revision };
      },
      errorMessage: friendlyError,
      status(update) { Object.assign(state, update); notify(); }
    });

    // Extend the existing storage wrapper, preserving its return values and fallback behavior.
    for (const method of ['setItem', 'removeItem']) {
      const original = window.siteStorage[method].bind(window.siteStorage);
      window.siteStorage[method] = (...args) => {
        const result = original(...args);
        if (!suppressChanges && DATA_KEYS.includes(args[0])) controller.changed();
        return result;
      };
    }
    window.addEventListener('storage', event => {
      if (event.key === null || DATA_KEYS.includes(event.key)) controller.changed();
    });
    window.addEventListener('online', () => { if (auth.currentUser && !controller.pending) void controller.connect(auth.currentUser.uid); });
    let lastFocusCheck = Date.now();
    window.addEventListener('focus', () => {
      if (auth.currentUser && !controller.pending && Date.now() - lastFocusCheck > 30000) {
        lastFocusCheck = Date.now();
        void controller.connect(auth.currentUser.uid);
      }
    });
    authApi.onAuthStateChanged(auth, user => {
      state.available = true;
      state.user = user ? { uid: user.uid, email: user.email } : null;
      if (user) void controller.connect(user.uid);
      else controller.disconnect();
    }, error => {
      controller.disconnect();
      state.user = null;
      state.available = false;
      Object.assign(state, { phase: 'error', message: friendlyError(error) });
      notify();
    });
  } catch (error) {
    state.available = false;
    Object.assign(state, { phase: 'error', message: friendlyError(error) });
    notify();
  }
}
void initialize();
