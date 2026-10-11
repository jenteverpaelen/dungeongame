# Local event log — schema, retention, privacy (F-TEL-04)

Off unless `TELEMETRY=1`. One JSON line per event in `DATA_DIR/telemetry/events-YYYY-MM-DD.jsonl` (UTC day). Written by
`server/src/telemetry.ts`; every event passes `sanitizeEvent` against `EVENT_SCHEMA` first.

## Common fields

| Field | Type | Meaning |
|---|---|---|
| `t` | number | epoch ms (server clock) |
| `s` | number | schema version (1) |
| `e` | string | event kind (below) |
| `c` | string | character id (lower-case name, `^[a-z0-9]{1,16}$`) — pseudonymous, not anonymous |

## Events (schema v1)

| `e` | Fields | Written when |
|---|---|---|
| `login` | `fresh` bool, `cls` str, `lvl`, `playMs`, `afkMs?`, `afkKills?`, `afkLevels?` | a character enters the world |
| `logout` | `lvl`, `playMs`, `kills`, `deaths` | it leaves |
| `level` | `lvl`, `playMs`, `zone`, `kills`, `deaths`, `gold` | one per level gained |
| `death` | `lvl`, `playMs`, `zone`, `n` | deaths since the last per-second look |
| `legendary` | `lvl`, `playMs`, `zone`, `n` | legendary/set items gained |
| `zone` | `lvl`, `playMs`, `zone`, `from`, `to` | zone change |
| `quest` | `lvl`, `playMs`, `zone`, `q`, `a` (accept/step/claim), `step` | quest progress |

Rules: unknown kinds are refused (so chat, IPs or credentials cannot be logged by mistake); fields not in the schema are
dropped; strings are cut to 40 characters; numbers must be finite; refused events are counted (`Telemetry.rejected`).

## Retention and rights

- Day files older than `TELEMETRY_RETENTION_DAYS` (default **30**, a proposal for playtests) are deleted at start-up and
  once a day — also when logging is off, so old files do not linger.
- A player's export contains their characters' lines; erasing a character rewrites the day files without its lines.
- No IP addresses, user agents, chat, account names or credentials are ever logged.

## Reading it

`npx tsx scripts/analyze-telemetry.ts <DATA_DIR>/telemetry` (Markdown report) and
`npx tsx scripts/analyze-telemetry.ts <DATA_DIR>/telemetry --html out.html` (owner analytics page, F-TEL-05).
