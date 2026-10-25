# Firebase backup links — short guide

**Yes.** These can be alternate addresses for SUSYSAM:

- https://susysam-2ae6e.web.app/
- https://susysam-2ae6e.firebaseapp.com/

Both show **one Firebase-hosted copy**. GitHub Pages stays your main site. You don't need another repository. Pushing to GitHub does not automatically update Firebase yet.

## One-time setup

1. Open the [Firebase Hosting page](https://console.firebase.google.com/project/susysam-2ae6e/hosting). Confirm the site ID is `susysam-2ae6e` and the plan is **Spark (free)**. If the ID differs, update the configuration first.
2. Open a terminal in the website folder. With Node.js installed, run `npm install -g firebase-tools`, then `firebase login`. Finish Google's sign-in yourself.
3. Run `node scripts/build-site.mjs`, then `firebase deploy --only hosting:susysam-2ae6e --project susysam-2ae6e`.
4. Open both links above. Test Home and Settings, then sign in with your existing account. Add the links to bookmarks or your GitHub README once they work.

Each later website update needs the build and Hosting deploy commands again. Automatic GitHub deployment to Firebase is prepared but disabled. No paid plan is needed within Spark's limits.

## One separate database update

The timezone feature adds a field to saved cloud data. Open [Firestore → Rules](https://console.firebase.google.com/project/susysam-2ae6e/firestore/rules), replace the editor with this folder's entire `firestore.rules` file, and click **Publish**. This is separate from publishing the website. Existing owner-only access stays in place. Until updated, saving a changed timezone may show a cloud permission error; your device copy remains.

Each website address has separate browser storage and needs its own sign-in. Cloud data uses the same Firebase account. Export a backup before choosing between different device/cloud copies.

These alternate addresses help if GitHub hosting is unavailable. They share Firebase hosting, accounts and cloud storage; keep JSON exports as separate data backups.

This turn publishes no Firebase Hosting release or database rules. See FIREBASE-HOSTING.md for advanced details. [Firebase documentation](https://firebase.google.com/docs/hosting/default-site) explains the two default domains.
