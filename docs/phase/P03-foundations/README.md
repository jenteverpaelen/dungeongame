# Foundations

Start with [state](STATE.md), [evidence](REFERENCES.md), [decisions](DECISIONS.md) and [verification](REPORT.md). The independent subset is progressing while P01 research continues. No authentication, account claim or real-save migration is implied.

## Verification

Run `npm run verify`. It uses installed tools and fresh temporary save directories, preserves logs/report JSON and fails on any failure. On Windows, `npm run verify -- --allow-known-windows-shutdown` permits only the two exact existing SIGTERM failures and reports `passed-with-known-failures`; it never calls that a clean pass. Unknown or extra failures still fail.

`npm run test:foundations` requires an explicit isolated DATA_DIR. `node scripts/capture-foundations.mjs` supplies its own temporary saves and Chrome profile, uses installed Chrome and writes only synthetic screenshots/reports under this phase.

Debug commands are now disabled by default. For an intentional local development server, set `$env:ENABLE_DEBUG='1'` before starting it. `$env:DISABLE_DEBUG='1'` overrides opt-in. The bot/capture scripts opt in only for servers they spawn; an external server retains its own policy. This switch is not an admin identity system.
