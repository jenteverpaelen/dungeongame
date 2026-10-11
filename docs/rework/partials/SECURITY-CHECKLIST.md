# Security checklist (F-OPS-05) — roadmap §12.3, item by item

Status on `claude/partials`, 2026-10-11. **Met** = implemented and covered by a test or a measurement; **Partial** =
part of it; **Open** = not done. This is a self-assessment; the roadmap's last item, an independent review, is still open.

| §12.3 item | Status | Evidence |
|---|---|---|
| Authentication and sessions | Met | scrypt passwords, recovery codes, sessions stored as SHA-256 hashes with device labels and per-device sign-out, pair lockout (name + IP 5 / 15 min) and an account-creation ceiling (NIST SP 800-63B §5.2.2) — `server/src/accounts.ts`, `docs/rework/ACCOUNTS.md`; tests `accounts`, `accountPrivacy` |
| Rate limits on login, chat, commands | Met | login: pair lockout + creation ceiling; chat: 5-message burst, 1 / s refill, 200 chars (`shared/src/social.ts`); every socket: 60 messages / s shared by text and binary frames, flood kick (`messageBudget.test.ts`); per-IP socket cap 20 (`securityHardening.test.ts`) |
| Input validation and size limits on every message | Met | 64 KiB message cap, typed argument parsers in `server/src/commands.ts` (`str`, `int`, `slotArg`, refusing on any bad field), command request validation `shared/src/commandState.ts`; `commandCrash.test.ts`, `messageBudget.test.ts` |
| Server authority for every state change | Met | the client sends inputs and commands only; NPC services re-check live position and line of sight (`requireNear`, `townServices.test.ts` incl. spoofed positions); stash tabs re-check tab number and price (`stashTabs.test.ts`) |
| Idempotent commands | Met | persisted command identities / results (`shared/src/commandState.ts`, `persistedCommands.test.ts`, `commandReplay.test.ts`); every op is classified (TypeScript `Record<CmdOp, boolean>`) |
| No debug commands in production | Met | debug ops need `ENABLE_DEBUG=1` and refuse with `DISABLE_DEBUG=1` (`server/src/commands.ts`); verify runs with debug off |
| Admin actions audit-logged | Partial | community moderation keeps an audit trail in its ledger (`server/src/community.ts`); account admin actions run only from the operator's shell (`scripts/accounts-admin.ts`) and are not written to a separate operator audit file yet |
| Secrets outside the repo | Met | no secrets in code; `.env`, `server/data/`, `.local/` ignored; accounts hold only hashes |
| `npm audit` and pinned versions | Partial | `npm audit`: 0 vulnerabilities in 99 packages (2026-10-11, read-only); exact versions pinned by `package-lock.json`, `package.json` uses `^` ranges; licence audit `scripts/license-audit.ts` (verify stage) |
| WebSocket origin and message-size limits | Met | `WS_ALLOWED_ORIGINS`, trusted-proxy handling (`server/src/net/clientIp.ts`), 64 KiB cap; `origin.test.ts`, `connectionRuntime.test.ts` |
| No HTML injection from chat / names | Met | Preact renders text nodes; the only `innerHTML` uses are in the dev gallery (`client/src/dev/galleryArt.ts`, not shipped to players' screens); the analytics page escapes names (`telemetryAnalytics.ts`); CSP on documents (`server/src/net/static.ts`) |
| Save-file path safety | Met | ids checked by `validCharacterId` before any path is built (`server/src/storage/jsonCharacterStore.ts`) |
| Backups with restore drills | Met | scheduled backups, mirror, automatic restore drill with custody comparison and a drill log; timed (100 characters 0.62 s, 1,000 characters 6.5 s) — `BACKUP-RUNBOOK.md`, `backupDrill.test.ts` |
| Log hygiene | Met | no passwords, tokens or IPs in the account activity log; telemetry schema allowlist and 30-day retention (`TELEMETRY-SCHEMA.md`, `telemetrySchema.test.ts`) |
| DoS basics | Partial | per-IP socket cap, message budget, flood kick, login lockout, slow-client kick; no load test at a target concurrency yet (D-29, P16) |
| Replay / race tests for trade and crafting | Partial | crafting / commands: `commandReplay.test.ts`, `drill-transactions.ts`; combat determinism `combatReplay.test.ts`; trading does not exist yet (D-21) |
| HTTP hardening (added) | Met | nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP on every response, CSP on documents (`securityHardening.test.ts`) |
| Independent review | Open | needs a person outside this project |

## Upgrade proposals (not applied — owner decision, nothing installed)

From `npm outdated` (read-only, 2026-10-11):

| Package | Installed | Proposal | Why / risk |
|---|---|---|---|
| vite | 8.3.2 | 8.3.4 (patch) | patch releases within the range; build-only tool; low risk, run `npm run verify` after |
| @types/node | 26.6.4 | 26.6.5 (patch) | type definitions only |
| preact | 10.29.8 | stay on 10.x for now | 11.0.1 is a new major: API changes need a dedicated pass over the UI |
| typescript | 5.9.3 | stay on 5.9 for now | 7.0.2 is two majors ahead (new compiler); evaluate separately |

`tsx` / `esbuild` run with `npm start` but are missing from the third-party notices (licence finding, `docs/licenses/AUDIT-2026-10-11.md`).
