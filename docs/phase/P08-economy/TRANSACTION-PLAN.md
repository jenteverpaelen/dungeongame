# C094 transaction implementation plan

L114/D052 precede code. No database migration or third-party download.

1. Optional command state: revision1, persistent random epoch, safe sequence, one bounded completed-outcome receipt, paid pending enchant. Identity is character + epoch + expected sequence + token; intent is the canonical operation/arguments hash. Exact latest retries return the saved response, older sequence requests fail without mutation. Future/malformed records are preserved and block persistent actions safely.
2. Client sends the expected character state and random token, serializing persistent actions. Server retains its existing connection-local failure/duplicate protections. A pending save blocks additional persistent mutation; repeated packets wait for its outcome.
3. Valid expected persistent commands capture the whole character and receipt together, then await flushed temporary-file replacement before char/response publication. Login also waits before welcoming/revealing offline grants. Existing save recovery retains failed snapshots; failure does not send success. No rollback over combat/pickups occurring during I/O.
4. Pending Mystic choices survive reconnect in the same save snapshot, and the existing enchant UI resumes them. No reroll of paid choices.
5. Focused concurrent/stale/reconnect/write-failure checks and restart evidence in disposable DATA_DIRs; full owner playtest remains theirs. Report process-restart guarantees separately from untested power-loss/multi-process/backup-rewind behavior.
