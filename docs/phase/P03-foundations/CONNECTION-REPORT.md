# Connection boundary — measured before and after

2026-10-09; C031, L42/AUTH-06. Design and references preceded implementation. No UI, town, camera, gameplay, save schema or ownership migration.

## Reproduction and regression

Isolated pre-change root `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-connection-before-a1817a1a6e594639ac25aa34ee86e483`: all three runtime tests failed as expected. A foreign Origin received101 instead of403; the proposed override was not enforced; a forged X-Forwarded-For appeared as the login IP. Exact failures are retained in `checks/connection-before.txt`. These are actual local HTTP upgrades/session log results, not inferred vulnerabilities from static text alone.

First implementation passed seven targeted checks and typecheck in `hf-connection-after-3a750c7307bc4812aa94c7da8608843b`. Review then added default-port canonicalization, explicit rejected-socket cleanup and a real invalid-startup test. Final strict verification passed all18 stages with no known-failure allowance, including eight connection checks,747 server and382 simulation checks, typecheck/build. Evidence root `C:\Users\LAPTOP~1\AppData\Local\Temp\hearthfall-verify-x8aOTI`; `checks/connection-verify.json` and final `connection-after.txt`. Build still reports the existing bundle-size advisory.

Actual network cases cover foreign/missing/null/path/suffix/list/duplicate origins, spoofed Host/forwarded headers, exact overrides replacing defaults, wrong route404 and unchanged health endpoint. Known default local origins receive101; rejected cases receive403. Invalid configured wildcard prevents listening and save-directory creation. Native clients send their known HTTP origin; there is no test-only production bypass. No production TLS termination, external proxy or capacity result follows from localhost tests.

## Browser check

`scripts/capture-connections.mjs` used installed Chrome154.0.8037.99, Node24.19.0,1920×1080,DPR1, a fresh profile and isolated DATA_DIR in `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-connection-ui-W5wMh5`; BACKUP_DIR empty and debug off. The actual built client and actual Vite WebSocket proxy connected using an explicit two-origin configuration on temporary ports. A third, unlisted local browser page failed the game handshake with403. The native runtime checks separately cover default Vite5173 origin acceptance.

Both captures were opened and inspected: characters reached the existing town with normal HUD, minimap and fixed620 camera. document.hidden=false, but Chrome was headless; no foreground rendering, FPS, human usability or crowd benchmark is claimed. The trace's character-name/capture-name metadata was clarified after capture without changing measured state or pixels. Owned browser/server/Vite/fixture processes were stopped. No personal Chrome tab, real player save, account or public deployment was touched.

## Operational effect and remaining scope

LAN, hosted or custom-port clients now need an explicit exact `WS_ALLOWED_ORIGINS` list; see CONNECTION-OPERATIONS.md and README. Defaults preserve documented localhost workflows. Logs use the socket peer, so a reverse proxy appears as the peer until topology-specific trusted attribution is implemented. Removing untrusted attribution does not introduce IP-based access control.

Origin can be forged by native clients. Name-only saves remain unauthenticated; account ownership/recovery, durable transactions, deployment/TLS, privacy and independent review are unfinished. This is a bounded browser connection check, not a security certification. Rollback and future proxy requirements are recorded in CONNECTION-DESIGN.md.
