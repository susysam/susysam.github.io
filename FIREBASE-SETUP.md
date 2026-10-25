# Firebase setup and review

This site uses Firebase Authentication and Firestore for account-based saving. Email/password sign-in and Cloud Firestore are enabled. The configuration and verification steps below are kept for future setup and troubleshooting.

## Finish the Firebase setup

1. Open [Firestore Rules for this project](https://console.firebase.google.com/project/susysam-2ae6e/firestore/rules).
2. Replace the editor contents with the complete contents of **firestore.rules** in this folder, then publish the rules. The exact text is also included below. These rules are intended for this site's database; if you add another app later, review its access separately.
3. Keep the project on the **Spark** plan. This implementation uses email/password Authentication and Firestore; it does not require paid hosting, Cloud Functions, or Cloud Storage. Do not enable billing for this setup. Free quotas still apply; the app keeps local changes if cloud requests fail.
4. Open the local preview's Settings page and create your account with your own email and a unique password. Enter the password yourself; do not paste it into chat. Old browser-only usernames and passwords are not Firebase accounts.
5. Wait for **Synced**. If you see a rules/permission error, check the rules were published to the `susysam-2ae6e` project's default Firestore database, then select Retry connection.
6. If Firebase reports an unauthorized domain, add the exact hostname in Authentication > Settings > Authorized domains: `susysam.github.io` for the public site, and `127.0.0.1` or `localhost` for whichever local preview you use. Do not enter a port or a full URL.

Creating an account for the first time uploads the site's existing settings, saved games, links and viewing history to your Firebase account. Export a backup first if you want an extra copy. The Firebase web configuration is public by design; the rules are what restrict access. Never add an Admin SDK key or service-account private key to this repository.

## Review before publishing

- Export a backup from Settings before testing changes.
- Sign in, make a small appearance change, wait for **Synced**, then refresh. Your account should remain signed in.
- Open the preview in a separate browser profile on this computer and sign into the same account. If copies differ, choose **Use cloud data** to bring the saved settings into that profile. After publication, repeat on another device.
- With different copies, neither is overwritten until you choose. **Use this device's data** replaces the account's cloud copy; **Use cloud data** replaces this browser's site data. Export first if you need both.
- Disconnect the network and change a setting. The page should continue to work and keep the change locally. Reconnect, retry and resolve any differences.
- Log out: the page should remain usable, and future changes should stay local. Logging out does not erase this device's saved data. On a shared computer, clear the device data after logging out.
- For access-rule verification, use the Firebase Rules Playground: an unauthenticated read must fail, a signed-in user's read of their own `users/UID/data/settings` must pass, and a different UID's read/write must fail. Writes must include the exact fields and a server timestamp required by the rules. Listing users and physical document deletion must fail.
- Only test Delete all with disposable data you are ready to lose. While signed in it clears this device and the account's synced site data, keeping the account and an empty revision marker. That marker prevents another device from silently restoring an old copy. While signed out it clears only this device. Other devices can retain local copies until they reconnect and choose cloud data; this is not a remote device wipe.

The login protects account data through Firebase rules. It does not make this public GitHub Pages site private. Browser-local data remains accessible to someone using the same browser profile. Site backups exclude passwords, old local profile hashes and Firebase session credentials.

## Limits and behavior

- File imports and exports are limited to **2 MB**. Firestore documents have a **1 MiB** service limit, so cloud data has a conservative **900 KB** limit including serialized application data. Larger data remains local and produces a visible error.
- Local edits sync after two seconds of inactivity. Wait for **Synced** before closing or navigating away if you need the latest cloud copy. An interrupted save keeps local data; reopening may require choosing between copies.
- The app checks the cloud at sign-in/page load, on reconnection and on focus after 30 seconds. It does not continuously stream remote changes. Transactions detect concurrent changes before overwriting them.
- The data map preserves the existing local storage string values for theme, background, presets, performance mode, games, saved links and viewing history. Metadata adds a schema version, revision and server timestamp around that map.
- Delete history and backup imports participate in sync when it is active. If sync is paused by a conflict or error, those changes stay local until you resolve it.
- Delete all keeps the Firebase login account. It does not delete downloaded backups, external sites' data or files on other devices.

## Checks completed

- 18 automated cloud/account tests: conflict choices, concurrency, offline failures, account switching, debounce, UTF-8 size limits, credential exclusion, deletion and readable errors.
- Five existing checks: backup import, rejection of credentials in imports, rollback on failed storage, history-only deletion and failed local-profile persistence.
- The local Settings/login UI loads the official Firebase SDK without browser errors.
- An unauthenticated request to a nonexistent user-data path in this Firebase project returned permission denied. This alone does not prove all deployed rules are correct.

Leo reports publishing the rules, successfully signing in with the account credentials and seeing **Synced** in the local preview. This confirms the basic live sign-in/sync flow from the user's test. Cross-device synchronization, receipt and completion of a password-reset email, and isolation between two different accounts still need end-to-end checks. The deployed rules have not been independently compared with this file or checked by the Firebase emulator.

Forgot password uses Firebase's real `sendPasswordResetEmail` service, even from the local preview. The default email action page is hosted by Firebase, so resetting a password does not require this laptop's preview server. The generic confirmation message deliberately does not prove that an email address exists or that a message reached the inbox. Check inbox/spam and complete the reset yourself if you want to verify delivery and the full flow; do not share reset links or passwords in chat.

Run tests from this repository folder with Node.js 22 or newer:

```powershell
node --test tests/cloud-sync.test.mjs
node tests/verify-changes.cjs
node tests/check-scripts.cjs
```

## Exact Firestore rules

Copy everything inside this block into the Firestore Rules editor:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function owns(uid) {
      return request.auth != null && request.auth.uid == uid;
    }
    function optionalString(data, key) {
      return !(key in data) || (data[key] is string && data[key].size() <= 900000);
    }
    function validSettings() {
      let doc = request.resource.data;
      let data = doc.data;
      return doc.keys().hasAll(['schemaVersion', 'data', 'revision', 'updatedAt'])
        && doc.keys().hasOnly(['schemaVersion', 'data', 'revision', 'updatedAt'])
        && doc.schemaVersion == 1
        && doc.revision is string && doc.revision.size() == 36
        && doc.updatedAt == request.time
        && data is map
        && data.keys().hasOnly(['theme', 'backgroundUrl', 'customBackgroundPresets',
          'performanceMode', 'customGames', 'tabs_saved_links', 'lastWatched', 'recentImdbMedia'])
        && optionalString(data, 'theme')
        && optionalString(data, 'backgroundUrl')
        && optionalString(data, 'customBackgroundPresets')
        && optionalString(data, 'performanceMode')
        && optionalString(data, 'customGames')
        && optionalString(data, 'tabs_saved_links')
        && optionalString(data, 'lastWatched')
        && optionalString(data, 'recentImdbMedia');
    }
    match /users/{uid}/data/settings {
      allow get: if owns(uid);
      allow create, update: if owns(uid) && validSettings();
      // The app clears the data map instead of deleting its revision marker.
      // Old devices must resolve a conflict before restoring old content.
      allow list, delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

References: [Firebase web SDK](https://firebase.google.com/docs/web/alt-setup), [email/password accounts](https://firebase.google.com/docs/auth/web/password-auth), [Firestore quotas and document limits](https://firebase.google.com/docs/firestore/quotas), [Firestore access conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).
