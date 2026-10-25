# Current status — read this first

October 25, 2026: the follow-up UI is authorized for GitHub publication in this release. Leo already deployed the matching Firebase Hosting site and reports publishing the updated Firestore rules. Read PUBLICATION-STATUS.md and the current Git log for release evidence. No need to repeat setup. Run git status before editing; preserve subsequent work. Earlier notes about pending publication/rules are historical. Future changes require fresh user instructions to publish.

The follow-up changes are documented in LOCAL-UPDATE.md: clearer device-only saving copy, distinct logout styling, and removal of only the Account sidebar link while keeping the account section and direct link. Automatic device/cloud saving remains in place. Checks: 28 unit/build tests, 7 backup regressions, 68 simulated browser checks.

# SUSYSAM development handoff

Updated October 25, 2026. Owner: Leo / `susysam`. Primary site/repository: https://susysam.github.io / https://github.com/susysam/susysam.github.io. See PUBLICATION-STATUS.md for the current release result.

## Latest follow-up — takes precedence over the earlier implementation notes

The owner explicitly authorized publishing this release to GitHub. Future work needs its own publication approval. Firebase Hosting and database rules remain separate pending steps; no billing changes are authorized.

Settings now shows all public sections together; category links scroll to sections rather than hide them. The authenticated account section follows actual login state. Only Your Data has a signed-out account-entry button. Cloud saving and Device storage sit side by side with Account status below. Home login is teal, and its clock displays time/timezone while editing stays in Settings. The welcome heading is plain, the description is shorter, and duplicate introductory copy is removed. Games use original images with fuller framing and no hover zoom; the wide A1R logo fits its frame.

Verification for this follow-up: 28 unit/build tests, 7 backup regressions and 65 isolated browser checks. These are not proof of live account isolation or reset-email delivery. Read FIREBASE-QUICK-START.md for the short Hosting guide and pending timezone-rule publication.

Backup editor: Antigravity/Gemini 3.8 Flash (High if available). Routine Codex choice: GPT-6.1 Sol Medium. Read AI-RECOMMENDATION.md. The Desktop handoff includes source and the user's saved dictation; the dictation is not published.

Publication is prepared atop the fetched remote main using a separate Git index, preserving the original staged work. The Desktop source copy should be used as one coherent version. Never force-push or discard unrelated work.

## Earlier implementation notes (historical; follow-up above takes precedence)

- Requested UI implementation and Firebase Hosting preparation are complete locally. Read `IMPLEMENTATION-REPORT.md` and `FIREBASE-HOSTING.md` for results, required setup and untested items.
- Latest user instructions require explicit approval before publishing the website, publishing updated rules, or enabling public deployment automation. Earlier authorization applied to the previous version; do not infer authorization for this new update.
- No billing upgrade or deployment credentials were created. Keep Firebase Spark. Never put private service-account keys in the repo. Firebase web config is intentionally public.
- Existing local data is retained on logout. Never automatically resolve cloud/device conflicts, discard another account's device data, clear unrelated storage, or weaken owner-only database rules.
- No framework migration is needed. Use vanilla HTML/CSS/JS, shared modules, and small reviewed changes. No runtime package dependencies were added.
- Repo currently has both pre-existing staged changes and newer unstaged/untracked files on `security/data-controls`. Do not reset/clean/checkout over them. Local HEAD predates two browser-uploaded commits on remote main: `4ae19fb` (previous Firebase/site version) and `c4b53e1` (script checks). Fetch/read the current remote before any future integration; do not blindly pull or force-push. The remaining old test upload was superseded by the new no-deploy brief.

## Architecture and important files

| Files | Responsibility |
|---|---|
| `index.html`, `account-ui.js`, `account-ui.css` | Primary email/password sign-in, create account, password reset, actual account email, conflict/retry UI; plain welcome heading. No logout on welcome. |
| `start27.html` | Home/navigation, sole logout button beside Movie + TV, login route for signed-out users, clock, bottom sync indicator. |
| `settings.html`, `settings-navigation.js`, `settings-layout.css` | General/performance, Appearance/background/reset, Time & Display, Your Data, authenticated-only Account category. Desktop sidebar and mobile jump links; all sections visible. No second sign-in form. |
| `firebase-config.js` | Official modular Firebase 13.1.0 imports, auth initialization/persistence, Firestore adapter, `window.siteCloud` subscription API. No fake success states in production. |
| `cloud-sync-core.js` | Pure `SyncController`, validation, allowlist, size limits, rollback, debounce, transaction revision/conflict handling. |
| `sync-presentation.js` | Shared pure sync-state mapping and accessible CSS icon rendering. Only signed-in `phase === 'synced'` while online gets green. |
| `site-storage.js` | Existing localStorage wrapper with memory fallback; added temporary write/read probe and actual persistence status notifications. |
| `site-data.js` | Version-1 JSON backups, import rollback, history deletion, all-site-data deletion, timezone validation. |
| `time-preferences.js`, `site-clock.js` | Valid IANA timezone preferences and Intl daylight-saving-aware clock. Default America/New_York; Settings-only selector; display-only Home clock. |
| `site-appearance.js`, `site-navigation.css` | Existing theme/color/background/performance behavior and purple Home buttons. |
| `games.html`, `tabs.html`, `movie+tv.html` | Games/artwork, saved links, viewing history/Extras. A1R still opens games.html; duplicate Secret Movie button removed from Tabs, original zstream.mov destination remains in Extras as Cinecat. |
| `firestore.rules` | Owner UID restrictions, schema/version fields, new optional bounded `timeZone`. Must be published before new timezone cloud writes. |
| `scripts/build-site.mjs`, `firebase.json`, `.firebaserc` | 28-file public build in dist, explicit Firebase site/project, Hosting-only predeploy. |
| `.github/workflows/static.yml` | Existing Pages workflow now prepared to check/build the public dist. Not pushed. |
| `deployment/firebase-hosting.yml.disabled` | Inert optional manual Firebase workflow template. Do not enable without approval. |
| `tests/` | Node unit/regression tests, script parsing and isolated Playwright browser checks. |

## Authentication and saved data

Firebase project: **susysam-2ae6e**. Auth domain: **susysam-2ae6e.firebaseapp.com**. Full public client configuration lives in `firebase-config.js`. Only email/password is implemented. Leo previously enabled Email/Password and Firestore, published the previous rules, and reported successful real sign-in and Synced status. Do not ask for passwords or hardcode his email.

Auth uses `browserLocalPersistence`. Firestore uses memory cache and server reads. `window.siteCloud` exposes `state`, `subscribe`, `login`, `signup`, `logout`, `resetPassword`, `retry`, `useCloud`, `useDevice`, `syncNow`, and `beforeDeleteAll`. The UI listens to these real events. `account-ui.js` loads independently of Firebase CDN availability so local navigation remains usable.

Application local keys: `theme`, `backgroundUrl`, `customBackgroundPresets`, `performanceMode`, `customGames`, `tabs_saved_links`, `lastWatched`, `recentImdbMedia`, **`timeZone`**. Values retain their original string format. Credentials, Firebase tokens, legacy login hashes, and `susysamCloudOwner` are never synced/exported. Legacy `local-profile.js` is retained for migration compatibility, not used as cloud auth.

Cloud path: `users/{uid}/data/settings`; envelope `{schemaVersion:1, data, revision, updatedAt}`. Writes use transactions with expected revision, UUID revision and server timestamp. Different copies pause for explicit selection. Reads recheck before applying a selected copy. `generation` prevents stale work after logout/account switching. Changes debounce 2 seconds; reads occur on connect, reconnect, and focus after 30 seconds, not a live remote stream. File backup limit 2 MiB; cloud payload cap 900,000 UTF-8 bytes.

Delete-all writes an empty versioned document rather than physically deleting it, so stale devices cannot silently resurrect data. It keeps the Firebase account. Signed-out deletion affects only that device. Export before destructive testing. There is no global remote-device wipe.

**Migration prerequisite:** publish the new rules allowing `timeZone`, then publish the same new frontend on each hosting platform and refresh old tabs. Old deployed clients reject unknown fields; do not let another assistant work around this by dropping data. Before the rules update, a device saving `timeZone` can receive permission denied and retain its data locally.

## Build, run, test

From this repo, with Node.js 22+:

```text
node tests/check-scripts.cjs
node --test tests/*.test.mjs
node tests/verify-changes.cjs
node scripts/build-site.mjs
```

For browser tests: install dev dependencies (`npm install`), install a test browser (`npx playwright install chromium`), then `npm run test:browser`. On Windows with Edge already installed, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` before running. Optional `$env:REAL_FIREBASE_SMOKE = '1'` checks real SDK initialization in a fresh signed-out context; it does not sign in or write data. Test screenshots go to ignored `test-results/`.

In this Codex environment, Node and Playwright were provided by the bundled runtime. `NODE_PATH` was set to `C:/Users/Leo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`, and Edge was used headlessly. npm itself is not currently on PATH. Do not assume a global Firebase CLI exists; it was not installed/run here.

For a local site, run `python -m http.server 18765 --bind 127.0.0.1 --directory .` from the repo (or serve `dist/` after building). The existing preview may already be at http://127.0.0.1:18765/index.html. Local preview uses real Firebase if signed in. Browser tests start their own temporary server/context and inject a fake adapter only in the test harness; they never use the user's real session or cloud data.

See `FIREBASE-HOSTING.md` for exact console checks, local Hosting emulator, approval-gated rules and Hosting deploy commands, and optional automation.

## Remaining work

1. Owner review of local UI; explicit publication approval still required.
2. Check actual Firebase Hosting site ID/release history and current Spark plan in the authenticated console. Both public Firebase roots were 404 Site Not Found; no existing repo Hosting config was found.
3. Deploy updated owner-only timezone rules only after approval; validate owner/other-user/unauthenticated access in Rules Playground or Firestore emulator. No emulator verification was performed.
4. Deploy the same frontend version to GitHub Pages and the intended Firebase site only after approval. Then verify auth/sync/reset/links on all three origins with disposable data and a second device.
5. Real password-reset email receipt/completion, real cross-device sync and two-user isolation remain unverified for this update. The browser tests simulate service responses; do not report them as live backend verification.
6. Enable the inert automatic-deployment template only after manual Hosting success, credential/environment review and approval. No deployment secrets exist in this repo.

Known limitations: cloud sync is snapshot-based with explicit replacement choices, not automatic per-item merging. Origin-local data and auth sessions are separate across domains. External games/movie providers may block embedding or become unavailable; their availability was not exhaustively tested. Exact rainbow colors are preserved even where light colors have limited contrast; an outline and accessible text help, but this is not a full accessibility certification. Official Firebase pages currently disagree on Hosting transfer accounting (pricing table 360 MB/day vs quota guide 10 GB/month); check Console Usage. See `AI-RECOMMENDATION.md` for the researched continuation recommendation.
