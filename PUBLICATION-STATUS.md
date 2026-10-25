# Current publication status — October 25, 2026

This release includes the device-only saving message, distinct logout color and Account section sidebar refinement. See the latest main commit and GitHub Actions for the exact release/deployment result.

- GitHub: https://susysam.github.io/
- Firebase: https://susysam-2ae6e.web.app/ and https://susysam-2ae6e.firebaseapp.com/
- Repository/Actions: https://github.com/susysam/susysam.github.io/actions

Leo deployed Firebase Hosting himself, and both public addresses were verified with the latest UI changes. Leo subsequently reported completing publication of the updated Firestore rules. That rules publication is owner-reported; real account isolation/reset-email/cross-device tests have not been repeated by Codex.

Automatic saving already exists: device writes happen immediately; signed-in cloud changes are debounced by two seconds. Conflicts require explicit selection. No billing changes are needed.

Validation of this code: 25 scripts parse, 28 unit/build tests, 7 backup regressions, 68 isolated browser checks. Those browser checks simulate Firebase responses.

Future assistant: inspect Git status, the latest commits and this file before changing anything. Continue from this version; do not repeat Firebase installation/deployment or ask the owner to publish rules already reported complete. New publishing or deployment requires the owner's instruction for that work.
