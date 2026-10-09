# Save failure handling — evidence before implementation

2026-10-09. This fixes a measured defect, not the whole storage/backup phase.

**Measured:** `checks/save-failure-before.json` records a synthetic rename rejection on the owner's PC. An existing save held gold=11; a later snapshot held gold=99. Both saveCharacter and flushSaves resolved despite the rejection, and loadCharacter returned 11. Source review shows Session clears its dirty flag before writing and never restores it on error. Shutdown prints all-saved even through its catch path. No real saves were read or faulted.

**References:** local persistence/session/shutdown control flow; NODE24-FS's asynchronous write/error and sequencing contract; roadmap F-SAV-02 and backup/restore requirements. TL2-BACKUP reinforces checking item/storage scope but is not an online persistence specification.

**Change:** preserve per-character serialization and synchronous JSON snapshots. Return write failures to callers; retain the latest failed JSON plus error in memory. Later writes continue after failure. Reconnect/load and flush retry the retained snapshot once, and reject if it still cannot be written rather than load stale data. Successful later writes clear obsolete failures. Live sessions mark themselves dirty for the existing autosave interval and report the outage once plus recovery. Shutdown reports success only after flush succeeds. No automatic endless retry or invented timing/backoff.

**Boundaries:** keep current file format, paths, name identity, autosave interval and original atomic temp/rename implementation. No database migration, new account ownership, real-save repair or gameplay change. This does not provide a journal surviving process/power loss: retained snapshots are in memory. Disk synchronization, backup rotation, restore drills and independent review remain separate work. Avoid adding an unmeasured fsync cost to every save in this defect fix.

**Acceptance:** failed save rejects; old file bytes and item IDs remain intact; load cannot silently return stale data while failure persists; retry after recovery writes captured latest state; failed queued write cannot poison its successor or another character; flush distinguishes failure and recovery; Session retries and does not flood messages; shutdown log cannot claim all-saved on error. Fault injection is local to test processes using fresh DATA_DIRs. Full server/simulation regression runs after implementation.

**Removal/effect/rollback:** remove swallowed-success behavior and unconditional success log, because callers otherwise cannot distinguish progress saved from progress lost. Future systems may now rely on explicit failure, but cannot yet assume crash durability or cross-character transactions. Revert this slice together if necessary; no save migration required.
