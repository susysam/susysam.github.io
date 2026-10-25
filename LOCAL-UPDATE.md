# Follow-up release after 28ce098

October 25, 2026. These changes are published to GitHub main and deployed to Firebase Hosting.

- Home sync indicator: removed subtitle line from bottom sync footer; now cleanly shows only `✓ Synced` (or `× Not Synced`) without extra text below.
- Settings formatting & layout spacing: resolved layout collision in `Account status` where `Not signed in` and `Log in or create an account` collided; now laid out via flexbox with ample spacing. Added dedicated vertical spacing (18px/20px) between backup actions and danger buttons, and before the explanation note.
- Timezone short versions: added standard short codes to the timezone select catalog and clock display (`Eastern Time (EST)`, `Central Time (CST)`, `Mountain Time (MST)`, `Pacific Time (PST)`, `UTC`, `London (GMT)`, `Paris (CET)`, `India (IST)`, `Tokyo (JST)`, `Sydney (AEST)`).

Checks: 25 scripts parse, 28 unit/build tests, 7 backup regressions, 69 isolated browser checks.
