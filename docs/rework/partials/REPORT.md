# Finishing Codex's partial features: report for the owner (2026-10-11)

Codex's tracker (`docs/CODEX_ROADMAP_STATUS.md`) listed 32 features as *partial*. One agent took the 28 that were not part of
the skills/items or quest work. Result: **19 done, 1 waiting for your sign-off, 1 waiting for your name picks, 6 partly
done (each needs you, real people or later work), 1 not started (blocked by your town freeze)**. All of it is merged into
`claude/town-ui-rework`; the full test suite passes.

## Done

| Area | What you get |
|---|---|
| **Accounts** | Logins survive a server restart; see your devices and sign them out; lockouts can no longer be abused by strangers to lock *you* out; an activity log as a security notice (no email needed) |
| **Privacy (GDPR)** | Download all your data; delete a hero or the whole account with a 14-day grace period; deletions stay deleted even if an old backup is restored |
| **Saves and backups** | Every save version has a test file and a migration check; after every backup the server test-restores it automatically and reports the result |
| **Names and licences** | An originality check fails the build if a borrowed name sneaks in; Diablo's elite names and "Treasure Goblin" were replaced (Swift, Hulking, Kilnborn… and the **Hoardling**); licence list checked |
| **Settings** | Graphics presets with measured cost (Low ≈ 105–110 fps, High 42–72 fps on this PC); colour-blind palettes (rarity colours now 2–3× easier to tell apart for colour-blind players) plus shapes on rarity labels; gamepad support with remapping (tested with a simulated pad only) |
| **Stash tabs** | 5 tabs of 60 slots; tabs 2–5 cost 170 K / 1.1 M / 2.4 M / 4.6 M gold (about one hour of play each at that level) |
| **Offline rewards** | Rewards now based on what *your* hero really earns per minute (Codex's numbers were about 7× too generous); logging in more often can never earn more |
| **Telemetry and speed checks** | A local analytics page for you; the test suite now fails if the server gets slower or network messages get bigger; recorded fights replay exactly, which makes bugs reproducible |
| **Monsters** | Enrage and summon behaviours are shared building blocks (the Rift Guardian uses them) |
| **Security** | Safer web headers; a security checklist; dependencies audited (0 known vulnerabilities; four small upgrade proposals, nothing installed) |

## Waiting for you

| What | Your choice | Where |
|---|---|---|
| **Names** (pick one per row; first option is the recommendation) | Difficulty: *Story · Normal · Hard · Severe · Ordeal I–X* / fire names / weather names. Paragon → *Lantern Ranks* / Wayfarer / Legacy. Cube → *Glass Reliquary* / Old Crucible / Tinker's Engine. Rift → *Faultline* / Rent / Deepway. Mystic → *Glasswright* / Enchanter / Loomkeeper. Health Globe → *Mending Orb* / Heartbloom / Life Spark | `NAME-REGISTER.md` B1–B6 |
| **Combat rules freeze** | 16 rows that lock how combat works (so balance can be tuned on a fixed base) | `COMBAT-FREEZE.md` |
| **Time-to-kill targets** | how long an elite/boss should take per level band (measured today, needs your target) | `bot-metrics/BOT-METRICS.md` |
| **Stash** | tab price (½ / 1 / 2 hours of play) and tab count (5 / 6 / 10); account-wide stash yes/no | `docs/rework/partials/LOG.md` |
| **Offline rewards for alts** | the fairness model | `AFK.md` |
| **Town extras** (F-WLD-06) | you froze the town on 2026-10-09; a proposal for showing new systems in town is ready if you unfreeze | `PLAN.md` |

## Still partly done (needs real people or later work)

* **Combat feel**: the options exist; only a playtest with you can sign it off.
* **Security**: checklist done; an independent person must still review accounts before a public test.
* **Low-spec PCs**: low mode done; testing on other browsers/PCs still open.
* **Translations**: Settings is ready for translation; the rest waits until the new class content is in.
* **Gamepad**: needs a test with a real controller.
* **Monster shields**: need one engine hook (assigned to the engine work).

## One bug found after the merge (fixed)

After merging, the server simulation was up to twice as slow. The cause: a new monster feature added fields to
monsters after they were created, which slowed every later monster lookup in the JavaScript engine. Fixed, with a test that
guards it; measured back at the old speed (1.9 ms vs 1.8 ms per tick).

Details per row: `LOG.md` (technical log), `PLAN.md` (what Codex left and what was done better), and the row texts in
`docs/CODEX_ROADMAP_STATUS.md`. Screenshots: `docs/rework/partials/shots/`.
