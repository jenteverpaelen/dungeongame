# Backup scale measurements — C048

2026-10-09, source3d48a3e. [Plan](BACKUP-SCALE-PLAN.md)/L59 precede the [standalone harness](../../../scripts/benchmark-backups.ts). No production code or retention policy changed.

## Measured on the owner's PC

Windows, Node24.19.0, Ryzen7 7435HS,16,849,272,832bytes physical memory reported. Six fresh child processes under `hf-backup-scale-oLzPFQ`, with separate marked synthetic DATA_DIRs and cleared BACKUP_DIR. Actual JSON snapshot/backup/verify/restore functions, no game server or personal data.

All three classes cycle through generated level70 characters with60 inventory slots,60 stash slots and five equipped starter items:125items each, plus an unknown synthetic extension. These are serialization fixtures, not representative builds. Two independent rounds agree on all source/restore hashes and item/byte counts. Every restored file equals its archived original. A real queued save submitted inside the snapshot boundary persists afterward; the archived cut keeps its earlier gold/unknown bytes and every other source file is unchanged.

| Stored characters | Character bytes | Snapshot ms, rounds1/2 | Later save completion ms | Create+verify ms | Separate verify ms | Restore+verify ms |
|---|---:|---|---|---|---|---|
|3|219,837|13.483 /11.970|16.633 /15.144|32.009 /28.674|6.239 /6.429|14.606 /12.889|
|100|7,323,501|81.479 /78.637|85.223 /82.334|351.317 /299.675|100.707 /92.402|328.573 /276.955|
|1000|73,339,716|716.939 /692.046|728.861 /695.230|2838.162 /2791.111|869.059 /887.815|2810.628 /2717.734|

Create includes internal verification. Restore includes source validation and copied-byte validation, but not server startup, operator decisions or network/login recovery. Snapshot timing includes submission/serialization of the one queued save in the instrumented wrapper. Later-save completion includes its actual write after the barrier releases.

At1000 characters, sampled process RSS peaks during creation were226.61 /226.12MiB; separate verification157.26 /156.52MiB; restore182.40 /187.73MiB. The recorded process baseline/GC state differs by stage, so these are not allocations or precise peak guarantees. Highest interval-mode event-loop histogram samples across the six cases were22.315ms; short cases include very few samples and the explicit final monitor turn. These measurements **do not certify a20Hz tick budget,100-player town, FPS, disk durability or live-server concurrency**.

The experiment explicitly used3 for class coverage,100 for the existing population question and1000 as a tenfold archive-size stress case. Stored character count is not concurrent player count. No cache eviction or forced GC; filesystem cache, antivirus and other PC activity affect both rounds. Timing is observational, without an invented pass threshold.

## Evidence and consequence

[Raw report](checks/backup-scale.json) records every stage, histogram sample count and root. Fixture/restore hashes:3=`f023de89b0e031f723f86335088f39ad9383afb6de98e9a86fc84c460910fd0f`;100=`5027508ebfaa6b8d54d543eabd4eccb816547a803541d8223ab2995ad590995c`;1000=`44a83a0e42b59d6d15cbcfde26e89b36fb003ab71ad42dd32048dede76ad89f7`. Standalone strict TypeScript check passed. All six runtime cases completed with byte/conservation assertions. No production changes warrant a repeated server/browser suite for this harness alone.

**Inference:** current same-disk raw backup/restore is feasible at these measured archive sizes on this PC; the snapshot can defer a later save for roughly0.7seconds in the1000-character fixture. This supplies a cost baseline, not a reason to choose a retention count or rewrite storage. Full-bundle memory remains proportional to archive size. No optimization is justified solely by an arbitrary memory target.

Retention, off-device/encrypted copies, backup age monitoring, recovery objectives, power loss/disk failure, restore activation and authentication/claim revocation remain open. External CISA bodies were inaccessible; the NIST demo did not expose control text, so neither is counted as a fully read source. The read [Node monitoring documentation](https://nodejs.org/download/release/v24.19.0/docs/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions) supports the instrumentation interpretation only.

Nothing was removed, including backups. No configured path, cadence, save, town, camera or UI changed. Rollback removes the measurement harness; preserve this report as dated evidence. Keep actual retention deletion disabled until a supported recovery policy and explicit operator configuration exist.
