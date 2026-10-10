# Playtest telemetry — measure real play instead of guessing

Off by default. Start the server with `TELEMETRY=1` and every character leaves a small, local, append-only trail in
`<DATA_DIR>/telemetry/events-YYYY-MM-DD.jsonl` (one file per UTC day). No IP addresses, no chat, no credentials;
files stay on the machine. A telemetry failure never affects play (one console line, then silence).

## What is recorded (one JSON object per line: `t` epoch ms, `c` character id, `e` event)

| Event | Fields | Meaning |
|---|---|---|
| `login` | `fresh`, `cls`, `lvl`, `playMs`, `afkMs/afkKills/afkLevels` | a session started (and any offline report it received) |
| `logout` | `lvl`, `playMs`, `kills`, `deaths` | a session ended |
| `level` | `lvl`, `playMs`, `kills`, `deaths`, `gold`, `zone` | one event per level gained |
| `death` | `n`, `lvl`, `zone`, `playMs` | deaths since the last observation |
| `legendary` | `n`, `lvl`, `zone` | legendaries/sets obtained |
| `zone` | `from`, `to`, `lvl`, `playMs` | a zone change |
| `quest` | `q`, `a` (accept / step / claim), `step`, `lvl`, `playMs` | quest progress |

`playMs` is the character's accumulated active play time, so "time to level 20" is real play minutes, not wall clock.
Changes are noticed once per second, so timestamps are accurate to about a second.

## Read it

```
npx tsx scripts/analyze-telemetry.ts <DATA_DIR>/telemetry                      # prints the report
npx tsx scripts/analyze-telemetry.ts <DATA_DIR>/telemetry --write docs/rework/PLAYTEST_REPORT.md
```
The report shows per character: class, level, play time, kills, deaths, sessions, average session, offline reports;
play minutes to every fifth level (with the median across characters); deaths by zone; and for each quest how many
started/finished, the median and slowest minutes from accept to claim, and the median number of steps.

## Why it exists

`PACING.md` measured an idealised bot. This measures people: where the first hour really stalls, which zone kills,
which quest takes three times longer than its neighbours. Feed it into roadmap decisions D-02 (journey length) and the
stall index in §6.5 of the roadmap.

Tests: `server/test/telemetry.test.ts` (pure diff, writer day-grouping and failure safety, report text, and a live
server run that levels a character and checks login → levels → logout).
