# Account boundary and legacy-character ownership

2026-10-09. Research/design note for roadmap F-ACC-01–07 and D-30/D-31. **Not implemented or a security acceptance report.** Evidence recorded first in L33 and the v2 source register. No real saves were read, enumerated, assigned or migrated. Town/style/camera remain frozen. The owner was asked whether other players already have characters; independent work continues while that answer is pending.

## Current boundary [M: code inspection and isolated login]

`Session.onHello` accepts name, class and protocol version; lowercased name selects the stored character. `World.reserve` excludes a second simultaneous connection for that name, but provides no ownership proof. The fresh/returning browser drills exercise this path. The short `Session.sessionId` is a log identifier, **not** an authentication token.

`main.ts` checks upgrade path and total connection count, with no Origin or credential check. Its client-IP value trusts a supplied X-Forwarded-For header; the current rate limits are connection-based, so these are not proven account/IP login limits. The built client and WebSocket share an origin; Vite currently proxies `/ws` only. Introducing HTTP account endpoints therefore also requires dev-proxy and cookie tests.

Character files, quarantine and backup bundles currently contain character state only. Ordered JSON operations and connection-local receipts do not atomically couple an account record, ownership assignment, recovery consumption and character write. Backups do not yet contain account ownership. These facts determine the migration boundary; they do not justify changing players' data today.

## Read guidance [S]

- [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): stable identity and chosen username serve different purposes; use protected transport, non-enumerating failures, reauthentication for sensitive changes and bounded login attempts. Account lockout can itself deny access. This does not establish who owns a pre-authentication save.
- [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): use unpredictable server-controlled session secrets and restricted cookies; invalidate server-side at logout/expiry. Keep secrets out of URLs, logs and browser Web Storage. Cookie flags do not replace CSRF controls. Its sample expiry times are not game-specific targets. Prefer reviewed session mechanisms over unnecessary custom machinery.
- [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): protect reset identifiers, avoid enumeration and excessive requests, consume codes once, and invalidate compromised access. Offline recovery still requires backend verification. A request alone must not modify the account.
- [NIST password verifier requirements](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/): for single-factor passwords, minimum 15 characters; support at least 64, permit password-manager use, compare the full secret, block common/compromised values, and avoid composition rules or arbitrary periodic changes. Unicode normalization and length counting must be consistent. This is guidance input, not a claim of NIST compliance.
- [NIST recovery](https://pages.nist.gov/800-63-4/sp800-63b/events/): saved codes use randomness, protected storage, throttling and replacement after use. Without prior identity proofing, reproofing cannot be invented later. Its notification requirements expose a limitation of a no-email design: an in-game notice does not independently warn an absent owner. No assurance-level certification follows.

## Proposed implementation direction [P]

Use a separate account identity, password and saved recovery code, with display names remaining presentation. This fits the no-paid-service constraint and does not require email collection or third-party sign-in. A password-manager-friendly existing-style panel would precede character selection. Passkeys remain an alternative requiring recovery/device/library evaluation; mandatory external identity is outside current scope. Losing both password and recovery evidence must not produce a name-based reset loophole.

Evaluate a maintained free session implementation against our small Node/WebSocket stack before selecting a dependency. If it cannot meet the integration constraints, document the rejection before using a minimal internal adapter. Built-in asynchronous Argon2id is already locally measured; preserve algorithm/parameters/salt in a versioned verifier and bound concurrent hashing. Use the published OWASP configuration already measured as a candidate, not unbenchmarked defaults. Actual login-load and denial-of-service measurements remain required.

Browser session: opaque random secret, server-side verifier and revocation, HttpOnly/Secure/SameSite cookie over HTTPS. Authenticate the HTTP upgrade, validate configured origins, then associate each game connection with a verified account. Character selection checks ownership before loading gameplay state. Logout/recovery revoke all affected live sockets as well as future upgrades. Revalidate expiry/revocation for actions; a socket opened earlier is not permanent authorization. Local HTTP testing needs an explicit loopback-only fixture mode with separate cookie behavior; it must never silently weaken a public configuration.

Use an explicit trusted-proxy configuration; untrusted forwarding headers cannot supply identity or throttling keys. Bound pending upgrades and hash jobs separately from in-game messages. Determine throttle/timeouts from abuse tests and intended idle-play behavior before selecting values. Continuous pings must not grant indefinite authentication by accident. Keep only purposeful, redacted security events; no credentials, recovery codes or raw session secrets in telemetry.

Storage candidate: worker-owned SQLite for account/ownership/session/recovery transactions, informed by the measured main-thread stall and worker result. A production choice is still pending realistic payload, crash, corruption and restore tests. Avoid a half-migration where ownership and character state live in unrelated commits. Test an integrated snapshot/restore covering both domains before any rollout. Current JSON saves remain operational until the cutover is validated.

## Legacy migration: ownership cannot be inferred [P/Q]

Do **not** offer first-visitor-wins claiming by a character's public name. Existing files lack a prior credential. The safe candidate is an operator-issued single-use claim tied to a specific legacy record after the operator establishes its owner outside the old name-only login. If only the owner has played, they can map their own records during a reviewed local import. The number/identity of actual players is pending their answer; no personal files are read to guess it.

Migration should operate on a verified copy into a new destination, keep the source intact and emit a dry-run manifest of old ID → new stable ID, owner assignment status and content checksums. Preserve item IDs, equipped/inventory/stash counts, progression, skills, Cube state and unknown fields. Unclaimed records remain inaccessible in account mode and recoverable by the operator; they are not deleted. Consumption of a claim and ownership assignment must commit together. A second use or concurrent claimant must fail without partial assignment.

At cutover, stop legacy writes, verify the final snapshot, validate imported counts/content and only then activate account mode. Never allow name-only fallback against protected records. Rollback after new play needs a reverse/export procedure that preserves later progress and ownership; restoring an old backup alone would discard new progress. Do not enable the feature until that procedure exists.

## Acceptance work still required

| Area | Concrete check before rollout |
|---|---|
| Ownership | Account A cannot select, mutate, export or delete B's character by name or ID; guessed names grant nothing |
| Sessions | Fixation, expired/revoked token, logout replay, recovery revocation and already-open sockets; wrong/missing Origin |
| Recovery | Wrong/reused code; two concurrent uses; storage failure before/after commit; lost-response retry; redacted logs |
| Login load | Unknown-user/wrong-password behavior, account and network throttles, bounded queue/memory, healthy 20 Hz game loop |
| Migration | Duplicate/corrupt/future records; concurrent claim; exact item/field preservation; interrupted import and rollback |
| Backup | Consistent account+character restore, revoked-secret handling after restoring older state, recovery drill |
| Browser | Real 1080p fresh/returning/recovery/error states; password manager/paste; original UI and camera preserved |
| Release | Independent security review, deployment/TLS/proxy configuration and privacy/retention policy |

The account note is now concrete enough to guide implementation, but account ownership, deployment and recovery support assumptions remain explicit gaps. Continue isolated prototypes, library evaluation and the other research charters without migrating or silently assigning live saves.
