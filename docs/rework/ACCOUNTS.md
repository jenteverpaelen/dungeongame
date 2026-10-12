# Accounts (roadmap P3 / F-ACC) — server side, off by default

Until now a character was identified by its name only: anyone who typed a name opened that character. This adds real
accounts on the server **without changing today's behaviour unless you switch it on**. The client login, register,
recovery and account screens are on the select screen (see "Client screens" below).

## Modes (`ACCOUNTS` environment variable)

| Mode | Behaviour |
|---|---|
| `off` (default) | exactly as before: name-only login, no account files, no extra messages |
| `optional` | players may register and log in; characters **linked** to an account refuse name-only login; unlinked characters still open by name |
| `required` | every login needs an account; a character nobody owns yet stays closed unless `ALLOW_LEGACY_LOGIN=1` |

Migration path for the existing playtest characters: run `optional` (or `required` + `ALLOW_LEGACY_LOGIN=1`), have
each player register, then link their old characters with the operator tool (below) or let them claim them during the
legacy window; finally switch to `required` without the legacy flag.

## What it does

- Username (3–20 of `a-z 0-9 _`, case-insensitive, a few reserved names refused) + password (10–128 characters).
- Passwords: `scrypt` (N=2¹⁵, r=8, p=1, 64-byte key, random 16-byte salt), compared in constant time; an unknown user
  costs the same as a wrong password and gets the same answer.
- Eight one-time recovery codes at registration (only their SHA-256 is stored). A code resets the password, is
  consumed, and revokes every session. Codes can be regenerated after proving the password.
- Session tokens: 32 random bytes, 30-day sliding expiry, at most 5 per account, revoked on logout, password change and
  recovery. **Since 2026-10-11 they survive a restart**: only the SHA-256 of each token is kept, in memory and in
  `DATA_DIR/accounts/.sessions.json` (atomic write, one second after a change). A copy of that file cannot be replayed —
  finding a 256-bit random token from its hash is not feasible — and it is a dotfile, so neither the account loader nor
  the aux backup picks it up (sessions never come back from a backup). `ACCOUNT_SESSIONS=memory` restores the old
  behaviour. Each session stores a coarse device label ("Chrome on Windows", parsed from the User-Agent at login; the
  header itself is never kept) and first/last use, shown under **Devices**, where the player can sign one device or
  every other device out.
- Brute force (2026-10-11): 5 failures in 15 minutes lock that **username for that connection** (pair lock); 50 failures
  from all connections lock the account for 15 minutes (NIST SP 800-63B §5.2.2 asks verifiers to limit failed attempts on
  one account to no more than 100 consecutive); 25 per connection; 5 registrations per connection per hour. Before this,
  anyone could lock a player out for 15 minutes with five guesses. Re-asking the password (password change, new codes,
  export, deletion) has its own counter (5 in 15 minutes).
- Client address: the socket peer. Behind a reverse proxy set `TRUSTED_PROXIES=<proxy ip>[,…]`; only then the right-most
  untrusted `X-Forwarded-For` hop is used. One address may hold at most `MAX_CONNECTIONS_PER_IP` sockets (default 20,
  loopback exempt).
- Activity log: the last 20 security events per account (created, signed in + device, password changed, recovery code used,
  new codes, devices signed out, data downloaded, deletion requested/cancelled, hero deletion/restore, owner reset). No IP
  addresses. This is the email-free replacement for "your password was changed" mails: the Devices tab shows it.
- Files: one JSON per account in `DATA_DIR/accounts/<username>.json`, written atomically; registration uses an
  exclusive create so two simultaneous registrations cannot both win. Malformed or mismatched files are skipped.
- Ownership: characters are linked to exactly one account (max 3 since 2026-10-12, docs/rework/ui/CHARACTER_SCREENS.md); claiming is race-safe across accounts. The
  character itself keeps its save format (no migration, `save 14` unchanged).

## Personal data: export and deletion (F-ACC-06, 2026-10-11)

- **Your data → Download** (password re-asked): one JSON file, `format: hearthfall-personal-data` — the account
  (username, created, heroes, codes left, activity, devices), every hero's exact save, its guild membership and the
  reports it filed, pending deletions, and its telemetry lines if a playtest logged any. Password hash, salt and
  recovery-code hashes are secrets and are left out; IP addresses are never stored. (GDPR Art. 15 access + Art. 20
  portability: structured, machine-readable.)
- **Delete account** (type the username + password): scheduled, not immediate. The account's heroes cannot be played and
  other devices are signed out; logging in still works and shows a banner with **Cancel deletion**. After
  `DELETION_GRACE_DAYS` (default 14, 0–30) the hourly purge erases the account file, sessions, every hero save
  (including quarantined copies), their telemetry lines and guild membership. A **hero** can be deleted the same way from
  the Heroes tab and restored until its date.
- **Erasure ledger** `DATA_DIR/privacy/ledger.json`: pending requests plus the SHA-256 digest and time of each erased id —
  no names. At start-up the server erases any save or account file older than its erasure (a restored backup), while a
  new hero who later took the freed name is newer and stays. The aux backup copies the ledger; the restore CLI has
  `apply-erasures` for a restored directory. Procedures: `docs/rework/partials/PRIVACY-RUNBOOK.md`.

## Protocol (version 23)

`C2S { t:'auth', op: register | login | resume | logout | recover | password | codes | sessions | revoke | export |
deleteAccount | cancelDeletion | deleteCharacter | restoreCharacter, … }` before `hello`;
`S2C { t:'auth', op, ok, mode, err?, username?, token?, recoveryCodes?, characters?, info?, sessions?, events?, data? }`.
When the mode is not `off`
the server sends `op:'status'` with the mode right after the socket opens, and allows five minutes (instead of ten
seconds) for the login screen. Details: `shared/src/protocol.ts`.

## Client screens (select screen)

The client reads `GET /api/config` (`{"accounts":"off"|"optional"|"required"}`, no secrets) before it connects, so a
server in `off` mode shows nothing new and opens no extra socket. With accounts on:

- **Top-right chip**: "Log in" (optional: "or play as a guest") or the logged-in username. Opens the account dialog.
- **Dialog, signed out**: Log in / Register / Recover. Register asks for the password twice and shows the eight
  one-time recovery codes once (copy, download as text, and a "I stored these" box before it can be closed; Escape does
  not dismiss it). Recover takes username + one code + a new password. In `required` mode the dialog cannot be dismissed
  and the Enter button reads "Log in to play".
- **Dialog, signed in**: Heroes (the account's characters; Choose fills the name and class; Delete… / Restore),
  Security (codes left, change password, new recovery codes; both re-ask the password), Devices (signed-in devices,
  sign out one or all others, recent activity), Your data (download, delete account) and Log out. A pending account
  deletion shows a banner with Cancel deletion above the tabs. A "Your heroes" row also sits above the name field.
- **Session**: the token is kept in `localStorage` (`hearthfall.token`, 30-day sliding on the server). On load the
  client resumes it, also after a server restart.
  Passwords are never stored client side. The login socket is reused for `hello` and re-resumes when it was idle past the
  server's five-minute pre-login window.
- Account management is only reachable before entering the world (the server refuses account changes once `hello` is
  done); leaving the world returns to the select screen.

Input rules (`USERNAME_RE`, 10–128 character passwords) are mirrored in `client/src/net/account.ts` for quick feedback;
`server/test/accounts.test.ts` fails if they drift from `server/src/accounts.ts`.

## Operator tool

```
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts list
DATA_DIR=<saves> HF_PASSWORD='…' npx tsx scripts/accounts-admin.ts create alice
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts link alice OldHeroName
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts reset alice              # new password + codes, printed once
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts activity alice           # devices + security activity
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts revoke-sessions alice
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts export alice out.json    # GDPR copy (check identity first)
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts export-character Name out.json
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts delete alice [--now]
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts delete-character Name [--now]
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts cancel-delete alice|Name
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts pending | purge
```
Account changes need a restart afterwards (accounts are cached in memory); scheduled deletions merge with a running
server and are picked up within an hour.

## Tests

`server/test/accounts.test.ts`: validation, enumeration-safe login, lockout with a fake clock, racing registrations,
recovery single-use and session revocation, token cap/expiry, exclusive and race-safe ownership, restart and tampered
files, plus two real-server runs (`required` and `optional`) over WebSocket.
`server/test/accountPrivacy.test.ts` (2026-10-11): device labels; sessions survive a restart with only hashes on disk,
revoke/logout durable, expired/tampered entries dropped, memory mode; the pair lock keeps the owner in while a guesser is
locked, the account ceiling engages and expires; activity without IPs; grace bounds; deletion inside/after the grace
period and cancel; a restored file is erased again but a newer hero with the freed name stays; restore tooling; export
without secret values; a real server: restart keeps the session, devices list, export re-asks the password, hero
deletion blocks `hello` until restored, account deletion blocks play until cancelled.

## Not done — needs an owner decision or an independent review before any public test

- Email verification and email-based recovery (no mail service, no paid services); passkeys; third-party sign-in.
- A second pair of eyes on this file and `session.ts` (the roadmap requires independent review for auth). Self-reviews
  on 2026-10-10 and 2026-10-11 are not the independent review.
- Usernames can still be enumerated through registration ("taken") — inherent to choosing a public name.

## Backups

The character backup format (`server/src/backups.ts`) is strict and unchanged. Accounts and the community ledger are
copied by `server/src/backupAux.ts` into sibling `aux-<time>-<uuid>` directories of the same `BACKUP_DIR` on the same
schedule (startup and every 24 h), with their own manifest and checksums, the same exclusive-create / re-read /
"incomplete" marker discipline, and retention by `BACKUP_KEEP` (newest N verified; anything it cannot verify is left
alone). Restore is explicit and never touches the live directory:

```
npm run saves:backup -- aux-verify  <BACKUP_DIR>\aux-…
npm run saves:backup -- aux-restore <BACKUP_DIR>\aux-… <NEW-destination-directory>   # then copy accounts\ and social\ into DATA_DIR, server stopped
```

## Self-review notes (2026-10-10)

* **Fixed — hashing could starve saves.** scrypt runs on libuv's four-thread pool, the pool that also writes character
  files. At most two hashes now run at once, up to 32 wait, and the rest get a retryable "server is busy"
  (`AccountsBusyError`). Test: 12 simultaneous logins never exceed two active hashes.
* **Fixed — a stolen session token could guess the password online.** Changing the password or regenerating recovery codes
  re-asks for the password; wrong answers now count like login failures (5 in 15 minutes lock the account for 15).
* **By design, document before exposing:** the client IP is the socket address (never `X-Forwarded-For`), so behind a
  reverse proxy every player shares one IP and the 25-failure IP lock applies to them together — add a trusted-proxy
  setting before putting this behind one. Anyone can lock a *username* for 15 minutes with five wrong guesses (the IP
  limit stops one source, not many). Usernames can be enumerated through registration ("taken").
  **Resolved 2026-10-11:** `TRUSTED_PROXIES`; pair lock + 50-failure account ceiling; persisted sessions; export/deletion.
