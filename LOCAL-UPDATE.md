# Follow-up release after 8f358cf

October 25, 2026. These changes are included in the approved GitHub release and were deployed to Firebase by Leo. See PUBLICATION-STATUS.md.

- Signed-out status now explains that data stays on the device instead of in the cloud. If device storage fails, it shows that failure instead.
- Removed Account & Cloud Saving only from the Settings sidebar. Its signed-in section, direct #account link, and conflict/retry controls remain available in the page.
- Logout has a distinct burgundy color; login stays teal and navigation stays purple.
- Automatic saving was already implemented and retained: saved changes go immediately to device storage; while signed in and connected, allowed changes queue a cloud write after two seconds. Conflicts/errors pause or report cloud saving. Leo reports publishing the matching Firebase rules.
- First sign-in can move data already saved in this browser to a new account. Exporting a backup first is recommended; import is useful when moving to a different browser/device or restoring a backup.

Checks: 25 scripts parse, 28 unit/build tests, 7 backup regressions, 68 isolated browser checks. Existing cloud tests verify automatic debounced writes and first-account upload. Browser checks simulate Firebase; no real account data was modified.

Next assistant: use Antigravity/Gemini 3.8 Flash, High if available. Preserve this version. The desktop Rules.txt is an exact copy of firestore.rules. Firebase Rules Steps.txt and Firebase Hosting Steps.txt have the exact URLs and commands for this laptop. START-HERE.md now gives one Antigravity workflow.
