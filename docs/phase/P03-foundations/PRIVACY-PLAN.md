# Data inventory scope — C035

2026-10-09. L46 and primary guidance precede this work. Inspect source definitions and actual consumers, not real saves, personal browser storage or deployment logs. Record field groups, purpose inferred from code, storage/access/retention behavior and export/deletion gaps. Distinguish existing data from proposed account data and synthetic test evidence. Do not invent legal bases, retention durations or release policy.

Use an isolated synthetic save to confirm current keys/unknown-field preservation and corrupt-parser diagnostics if needed; DATA_DIR must be a fresh temporary path and BACKUP_DIR cleared. Keep synthetic markers in evidence only, never gameplay. A separately scoped design and regression must precede any logging change. No automatic pruning, migration, export or deletion endpoint in this audit. Account ownership, hosting, support and legal acceptance remain open.
