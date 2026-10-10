# Owner moderation operations — C105

Policy approved2026-10-10: the owner manually reviews reports. No automatic penalties. Players can block/mute locally. Reports are allegations; an attached message proves only what the server delivered, not the truth of a description. Rules and retention are visible in Social → Guild & reports → Rules.

Run from the repository with the same explicit DATA_DIR as the server. These are local filesystem operations, not a network admin endpoint or character-name admin privilege. Do not post the ledger, reports, evidence or command-result files publicly. The current login is character-name based, not authenticated account ownership: do not treat these tools as secure public-release moderation.

```powershell
# Set this to the actual intended server's configured directory; examples below do not select it for you.
node --import tsx scripts/community-admin.ts list 0
node --import tsx scripts/community-admin.ts audit 0
node --import tsx scripts/community-admin.ts mute CharacterName 60 'Reason visible in the owner audit'
node --import tsx scripts/community-admin.ts unmute CharacterName 'Review outcome'
node --import tsx scripts/community-admin.ts ban CharacterName 1440 'Reason for suspension'
node --import tsx scripts/community-admin.ts unban CharacterName 'Review outcome'
node --import tsx scripts/community-admin.ts resolve REPORT_UUID 'Reviewed and disposition recorded'
node --import tsx scripts/community-admin.ts filter .local/owner-filter.json
```

Filter file format: `{"phrases":["configured phrase"],"links":true,"reason":"Why this rule is needed"}`. Default phrases empty, links enabled. Matches are case-insensitive substrings; http/https/www links are rejected. This is a configurable deterministic filter, not semantic moderation, a complete profanity dictionary or a promise to catch obfuscation. A filter match never mutes/bans automatically. Report descriptions are not filtered, so reports can describe objectionable material.

Mute/ban duration is integer minutes1–43200;0 means permanent. Mute denies chat/emotes, not gameplay or guild membership. Ban denies login and disconnects online matching characters on maintenance. Local tooling can lift either. Resolve marks the report Reviewed without applying a sanction; a separate sanction requires a separate reason. Appeals go to the owner; no email/web submission service is implied.

Requests are UUID files in DATA_DIR/social/owner-inbox. The running server processes up to five per maintenance pass (normally once per second). **Queued is not success:** inspect the `.json.result` printed by the CLI. Success means the ledger replacement finished and the action was audit-logged. A repeat UUID cannot perform the same action twice while its audit entry is retained. Unknown/malformed/oversized requests do not gain privileges. Fix or remove only the explicitly identified local request if it cannot process; never blanket-delete the data directory. The list/audit command displays eight rows per page. Pending requests and results are local owner material.

Guild/report mutations use flush+atomic rename, serialize in one process and drain on graceful shutdown. A corrupt/unsupported ledger fails startup rather than silently resetting guilds/moderation. Character commands separately retain their existing saved receipts. Abrupt power loss, two servers writing one directory and backup rewind are not certified safe. Do not run multiple writers against one DATA_DIR.

Limits:100 guilds,80 members per guild,4 pending invitations per sender/recipient,60-second invitation lifetime. Reports80 per reporter/8000 total retained entries; audits/sanctions8000 each. Ordinary chat evidence is the last80 delivered messages in session memory. Descriptions/chat/MOTD/reasons200 characters, guild names3–32. These are current engineering budgets, not reference-game optima or a production capacity benchmark.

Reports and attached evidence expire30days after submission, even if unresolved. Audit entries/results expire30days after their timestamps. Startup and running maintenance prune; an offline server does not erase data until started again. Active sanctions stay until expiry or explicit lifting. Ordinary unreported chat is not written to disk. Filesystem snapshots/off-device copies need matching expiry policy; no legal-compliance certification is claimed.

**Recovery boundary:** existing character backup/restore only covers character JSON at its configured root; it does not include DATA_DIR/social/ledger.json. Do not assume guilds/reports are covered by `saves:backup`. Before any wider release, implement and verify a consistent restricted social backup/restore with expiry and owner policy. Until then retain the live ledger, stop the server before any deliberate operator copy, protect access, and do not restore stale reports/sanctions casually. This is explicitly carried into P3/P16, not hidden behind a successful character restore test.

Rollback: SOCIAL_DISABLED_CHANNELS and PARTY_DISABLED_CHANNELS accept comma-separated zone#channel identifiers. They stop new admission/public social operations for those channels while exit/removal/report controls remain. They are not a data deletion or ban substitute. Protocol19 requires matched clients/server; retain save13 and ledger1 when changing versions. Preserve records on any rollback and never deploy the untouched safe-baseline branch over newer save formats.
