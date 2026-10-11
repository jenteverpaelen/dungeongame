# Privacy runbook — recovery without email, data requests, deletion (owner procedures)

Not legal advice. Grounding: GDPR Art. 12(3) (answer a request within one month), Art. 15 (access), Art. 17 (erasure),
Art. 20 (portability: structured, commonly used, machine-readable); EDPB "respect individuals' rights" (verify identity
when in doubt, protect other people's data); OWASP Logging Cheat Sheet (no secrets in logs). What the code does is in
`docs/rework/ACCOUNTS.md`; this file is what the owner does.

## 1. A player forgot their password

1. **They have a recovery code** → Account → Recover (username + one code + new password). Every other session ends, the
   code is used up, and the account's Devices tab shows "Recovery code used". Nothing for the owner to do.
2. **No codes left / lost them** → owner-assisted reset. There is no email, so identity must be proven another way. Ask
   for things only the real owner knows and the server can check, at least two of:
   - the exact names and classes of their heroes, and roughly their levels;
   - a recent in-game detail (last zone, guild name, a legendary they own — `export-character` shows it);
   - the device they usually play on (Devices list via `accounts-admin.ts activity <user>`).
   Never accept "I own it" alone; never reveal account details while checking. If convinced:
   `DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts reset <user>` (prints a new password and eight new codes once;
   every session ends; the activity list records "Password reset by the server owner"). Restart the server. Hand the
   password over privately and tell them to change it and store the new codes.
3. **Suspected takeover** (the real owner reports unknown activity): `revoke-sessions <user>`, then `reset <user>` after the
   identity check above.

## 2. A player asks for their data (access / portability)

- Signed-in players do it themselves: Account → Your data → Download (password re-asked). The file contains the account,
  every hero save, guild data, reports they filed, pending deletions and their telemetry lines.
- On request (e.g. they cannot log in): identity check as in §1.2, then
  `accounts-admin.ts export <user> out.json` (or `export-character <Name> out.json` for an unowned hero in name-only mode).
  The file is written once (`wx`, never overwritten). Answer within one month (Art. 12(3)).
- Other players' data is not included (reports others filed about them, other players' friend lists).

## 3. A player asks to be deleted (erasure)

- Self-service: Account → Your data → Delete account (username + password), or a single hero from the Heroes tab.
  Grace period `DELETION_GRACE_DAYS` (default 14); they can cancel by logging in. After it, the hourly purge erases.
- On request: identity check, then `accounts-admin.ts delete <user>` (grace period) or `delete <user> --now` (immediate;
  stop the server first, or restart it afterwards). Heroes: `delete-character <Name> [--now]`. Check with `pending`.
- What is erased: account file, sessions, every owned hero save and its quarantined copies, their telemetry lines, guild
  membership (leadership passes to an officer or the oldest member). What remains: the SHA-256 digest of the erased id with
  the time (so a restored backup is erased again), and reports *others* filed (30-day moderation retention, then gone).
- **Backups**: copies made before the erasure age out with rotation. With `BACKUP_KEEP=14` daily backups, a deleted
  person is gone from every backup at most 14 days after the purge — 14 + 14 = 28 days, inside one month. Before activating
  any restored directory run `npm run saves:backup -- apply-erasures <restored-dir> <DATA_DIR>/privacy/ledger.json`; the
  server also re-applies the ledger at start-up.

## 4. Retention defaults (proposals the owner can change)

| Data | Default | Setting |
|---|---|---|
| Sessions | 30-day sliding, max 5 per account | code constant |
| Account activity | last 20 events | code constant |
| Deletion grace | 14 days | `DELETION_GRACE_DAYS` (0–30) |
| Telemetry (only when `TELEMETRY=1`) | 30 days | `TELEMETRY_RETENTION_DAYS` |
| Reports / moderation audit | 30 days | code constant (existing) |
| Backups | off unless `BACKUP_DIR`; recommended `BACKUP_KEEP=14` | `BACKUP_KEEP` |

The 14-day grace matches the cancellation window some large publishers use for account deletion [K, not re-checked].
