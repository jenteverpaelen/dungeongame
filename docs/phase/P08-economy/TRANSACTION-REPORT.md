# C094 — Saved commands and paid enchant recovery

Implemented on the existing single-authority JSON backend. L114/D052 and TRANSACTION-PLAN.md preceded code. No dependency, service, asset, price or camera change.

## What now works

- Persistent menu operations carry a character epoch, expected sequence, random token and canonical intent fingerprint. Each valid expected request that reaches its handler records its completed outcome, including rule rejection/interruption. Exact latest retries return that outcome; changed intent and older requests cannot mutate again. Unknown future or malformed records remain intact and block persistent mutation.
- The whole character and receipt are captured together. JSON storage flushes the temporary file before replacement; character/response publication waits for it. Write failure never reports success, disconnects for recovery, and preserves the existing failed-snapshot recovery. A pending commit blocks new persistent mutations while movement/combat continue. This does not make every combat pickup independently transactional.
- Login waits for the offline grant and its updated last-seen boundary to save before welcome. Paid Mystic choices are saved and restored; the existing panel selects the retained owned item and displays the same choices after reconnect.
- Client persistent commands are serialized, retain their original arguments, use the existing60-message budget as the queue cap, and discard queued actions across reconnect. World movement/casts remain immediate. Save11/protocol14 and synthetic v11 golden fixture preserve earlier data.

## Measured checks

27 distinct focused checks passed across commandReplay, persistedCommands, commandCrash, saveFailures, shutdownFailures and foundations. Repeated overlapping runs are not counted twice. Evidence includes actual Session reconnect with paid choices; paused replacement proving no premature char/response; duplicate concurrent requests spending once; mismatched intent/stale requests; refusal after write failure; v0–v11 fixtures; a real disposable server abruptly stopped after acknowledging a grant, restarted, then receiving the same request without double granting. All data was disposable with backups disabled.

Typecheck and production build passed. Main bundle1,235.33kB /401.95kB gzip; existing large-chunk warning remains. Earlier test harness errors (missing WebSocket Origin, mock typing and cleanup placement) were corrected without weakening production policy. No full human replay was performed.

[Mystic presentation](ENCHANT-RESUME.jpg) was inspected in local Chrome at1920×1080: all three choices and inventory fit, no scroll or overlap. It is explicitly labelled synthetic presentation data, with identical option values used to prove restoration display, not a sampled enchant distribution. Actual persisted-choice execution is covered by the Session test. Viewport reset and owned preview tab closed.

## Limits and future effects

This is process-restart evidence on the owner's PC, not a disk-power-loss guarantee. Flush semantics depend on OS/device; multiple independent writers, manual backup rewind, account ownership and independent human review remain outside this guarantee. Old connection receipts still handle nonpersistent world actions. New saved-resource commands must be explicitly classified in the persisted command table. Future backup restoration must preserve command history or deliberately rotate identity; never strip receipt state to reopen old requests.

Removed behavior: premature menu-success publication and reconnect loss of paid enchant choices. No game content, gear, saved balances, prices or existing features were deleted. Rollback requires a matched client/server and an explicit compatible save export preserving commands and pending choices; do not downgrade by deleting new fields.
