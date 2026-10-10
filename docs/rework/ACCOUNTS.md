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
- Session tokens: 32 random bytes, stored hashed in memory, 30-day sliding expiry, at most 5 per account, revoked on
  logout, password change and recovery. A server restart ends sessions (players log in again).
- Brute force: 5 failures in 15 minutes lock a username for 15 minutes; 25 per IP; 5 registrations per IP per hour.
- Files: one JSON per account in `DATA_DIR/accounts/<username>.json`, written atomically; registration uses an
  exclusive create so two simultaneous registrations cannot both win. Malformed or mismatched files are skipped.
- Ownership: characters are linked to exactly one account (max 10); claiming is race-safe across accounts. The
  character itself keeps its save format (no migration, `save 14` unchanged).

## Protocol (version 21)

`C2S { t:'auth', op: register | login | resume | logout | recover | password | codes, … }` before `hello`;
`S2C { t:'auth', op, ok, mode, err?, username?, token?, recoveryCodes?, characters? }`. When the mode is not `off`
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
- **Dialog, signed in**: Heroes (the account's characters; Choose fills the name and class), Security (change
  password, new recovery codes; both re-ask the password) and Log out. A "Your heroes" row also sits above the name field.
- **Session**: the token is kept in `localStorage` (`hearthfall.token`, 30-day sliding on the server). On load the
  client resumes it; a server restart ends sessions, so the player simply sees the login form with the username prefilled.
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
DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts reset alice     # new password + codes, printed once
```
Restart the server afterwards (accounts are cached in memory).

## Tests

`server/test/accounts.test.ts`: validation, enumeration-safe login, lockout with a fake clock, racing registrations,
recovery single-use and session revocation, token cap/expiry, exclusive and race-safe ownership, restart and tampered
files, plus two real-server runs (`required` and `optional`) over WebSocket.

## Not done — needs an owner decision or an independent review before any public test

- Email verification and email-based recovery (no mail service, no paid services); passkeys; third-party sign-in.
- Persisting sessions across restarts; device list; account deletion and data export (GDPR flow, roadmap F-ACC-06).
- A second pair of eyes on this file and `session.ts` (the roadmap requires independent review for auth). A self-review
  on 2026-10-10 found and fixed two things (below); it is not the independent review.

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
* **Not done:** email-based recovery, session persistence across restarts, account deletion/export, passkeys.
