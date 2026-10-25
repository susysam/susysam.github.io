# Firebase Hosting preparation — not deployed

Checked October 25, 2026. GitHub Pages remains the primary site at https://susysam.github.io. This update, the Hosting configuration, and the timezone rules change are local only. No Firebase deployment or new workflow was enabled.

## Findings

- Before this work there was no `firebase.json`, `.firebaserc`, Hosting build directory, or Firebase deployment workflow. The existing GitHub Actions workflow deployed the repository to Pages.
- Both `https://susysam-2ae6e.web.app/` and `https://susysam-2ae6e.firebaseapp.com/` returned HTTP 404 with **Site Not Found** during a public HTTP check. Neither currently serves SUSYSAM.
- Authentication's authorized-domain list is not a website deployment. The observed response is consistent with a missing live Hosting release. A deleted/disabled site or empty previous release cannot be excluded without inspecting the project's Hosting console/release history. Previous private deployments and the actual site ID were not authenticated-console verified.
- Firebase documents that a default Hosting site serves both `SITE_ID.web.app` and `SITE_ID.firebaseapp.com`. These are two addresses for one deployment/CDN, not two independent backups. GitHub Pages is a separate hosting platform. A GitHub outage can leave Firebase available; a Firebase hosting outage can affect both Firebase URLs. Cloud login/saving on all three still depends on Firebase Authentication and Firestore.
- The repository's client configuration consistently targets project `susysam-2ae6e`. It uses email/password Authentication and Firestore, with no Functions, server rendering, phone auth, or Cloud Storage requests. The `storageBucket` string in the public client configuration does not mean the app uses Cloud Storage.

## Free plan

Use **Firebase Hosting**, not **Firebase App Hosting**. Static Hosting, email/password auth, and the existing Firestore usage can fit Spark. Keep Spark; no billing upgrade was performed or is required for this preparation.

The current [pricing table](https://firebase.google.com/pricing) lists **10 GB Hosting storage** and **360 MB/day transfer** on Spark. The [Hosting quota guide](https://firebase.google.com/docs/hosting/usage-quotas-pricing) instead describes **10 GB/month transfer**, disabling sites after a grace period when exhausted, and blocking new deployments when storage is full. These official pages disagree on the transfer accounting period. Check the project's Hosting Usage panel before launch; do not assume unlimited hosting or guarantee uninterrupted free availability. Quotas are shared across a project's sites/releases. Spark caps service rather than charging overages; intentionally upgrading to Blaze changes that.

[Firestore's free quota](https://firebase.google.com/docs/firestore/quotas) includes one database, 1 GiB data, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB outbound/month. Auth has its own abuse/usage limits; [password-reset emails](https://firebase.google.com/docs/auth/limits) are limited to 150/day on Spark. Cloud-saving transactions consume reads and writes. Frequent reloads and many active users can exhaust quotas. No permanent-free or 100%-availability guarantee is possible.

## Prepared files

- `firebase.json`: explicitly selects site `susysam-2ae6e`, serves `dist/`, runs the public build before deployment, and sets revalidation/nosniff/referrer headers. No catch-all SPA rewrite: this is a multipage site. `/` serves `index.html`, original `.html` URLs remain, and missing URLs use `404.html`.
- `.firebaserc`: project `susysam-2ae6e`.
- `scripts/build-site.mjs`: copies 28 explicitly named public files into `dist/`, including images, clock/account modules, and the `/games/` redirect. It refuses unsafe output paths/symlinks and missing inputs. Documentation, rules, tests, package files, credentials, and Git metadata are excluded.
- `.gitignore`: excludes build/dependency/test output and common private local configuration.
- `.github/workflows/static.yml`: retains the existing Pages deployment and its trigger; adds checks and uploads the same `dist/` output. This change has not been pushed or enabled remotely.
- `deployment/firebase-hosting.yml.disabled`: inactive manual deployment template. It is outside `.github/workflows` and cannot execute there.
- `firestore.rules`: retains owner-only access and adds the optional bounded `timeZone` string. The published old rules will reject saves containing that new field until updated.

## Exact steps after approval

Use a terminal in this repository. Install Node.js/npm and the official Firebase CLI if absent (`npm install -g firebase-tools`). Do not paste credentials into chat or files. These commands require your own Firebase login:

```text
firebase login
firebase projects:list
firebase hosting:sites:list --project susysam-2ae6e
```

In [this project's Hosting console](https://console.firebase.google.com/project/susysam-2ae6e/hosting), check that the site ID is **susysam-2ae6e**, view any existing release history, and confirm the plan is **Spark**. Firebase changed default-site creation in October 2026; a project ID alone is not proof of the Hosting site ID. If the listed site differs or is absent, stop and review/create the intended site with the owner rather than deploying to a guessed target. See [default Hosting sites](https://firebase.google.com/docs/hosting/default-site). Do not run `firebase init` over these files or accept an overwrite of `index.html`.

Verify Authentication → Settings → Authorized domains contains all three exact hostnames, without schemes or paths:

```text
susysam.github.io
susysam-2ae6e.web.app
susysam-2ae6e.firebaseapp.com
```

Leo reports these are already listed; the current list was not independently inspected. Also authorize `localhost` or `127.0.0.1` if used for real local auth tests.

First validate the local build:

```text
node tests/check-scripts.cjs
node --test tests/*.test.mjs
node tests/verify-changes.cjs
node scripts/build-site.mjs
firebase emulators:start --only hosting --project susysam-2ae6e
```

Open `http://127.0.0.1:5000`. **Hosting-only emulation still uses the real Auth/Firestore backend** if you sign in. Use disposable test data and export backups before conflict choices. This command is local, not a public preview-channel deployment. The Firebase CLI/emulator was not run during this work.

After explicit approval, publish the updated `firestore.rules` in [Firestore → Rules](https://console.firebase.google.com/project/susysam-2ae6e/firestore/rules), or use the rules-only command below. Do not relax owner checks. Then publish the matching site version:

```text
firebase deploy --only firestore:rules --project susysam-2ae6e
firebase deploy --only hosting:susysam-2ae6e --project susysam-2ae6e
```

These are instructions, **not commands already executed**. Publish the same reviewed version to GitHub `main` when approved; the existing Pages workflow will build it. Do not use a broad `firebase deploy` that could deploy unintended services.

## Account/data behavior and verification

All three deployments use the same Firebase project, existing email/password accounts, default Firebase-hosted password-reset handler, and `users/{uid}/data/settings` path. Owner-only rules check the authenticated UID, not the hosting origin. No new user database or weaker rules are needed.

Each origin has separate local storage and persisted auth sessions. Sign in separately on each address. Cloud data can then be accessed from the same account. If local and cloud differ, the existing explicit conflict choice remains; neither copy is silently overwritten. Export before replacing either copy. Local-only preferences do not transfer by changing URLs; use a backup import or cloud account. Logging out keeps local data.

After deployment, on **each** address verify root/home/games/Settings/Movie + TV, login, refresh persistence, password-reset email receipt and completion, logout, local saving, and cloud saving. Test the same account from a second browser/device; choose the desired copy only after reviewing backups. Test pending/offline/conflict states and owner isolation with disposable accounts. These live cross-domain checks are still outstanding because Hosting is not deployed. Old site versions do not recognize `timeZone`; update both hosting platforms together before using the preference, and refresh old tabs. Old clients should stop with an unsupported-data error rather than drop the field.

## Automatic deployments

Recommended eventually, after one successful manual deployment and live checks. Keep independent Pages and Firebase jobs/workflows so Firebase failure cannot roll back or block the Pages job. Both use `scripts/build-site.mjs`. Review and pin action revisions before enabling.

The [official Firebase GitHub integration](https://firebase.google.com/docs/hosting/github-integration) can create a limited deployment service account and store its JSON only as a GitHub Actions secret. Never commit/download a private key into public files. The disabled template references `FIREBASE_SERVICE_ACCOUNT_SUSYSAM_2AE6E`; no secret was created, read, or installed. Configure a `firebase-production` GitHub environment with approval protection where available. Move/rename the template into `.github/workflows` only after explicit authorization; it starts manual-only. Later add a `push` trigger for `main` if approved. Do not grant deployments to untrusted fork PRs or use `pull_request_target` with untrusted checkout code. A separately reviewed short-lived OIDC credential setup is an alternative to a stored key.

GitHub Actions usage is subject to the repository/account's own limits. No paid services or additional public deployment triggers were enabled.
