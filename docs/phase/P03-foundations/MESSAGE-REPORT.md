# Message boundary results — C039

2026-10-09. L50 and MESSAGE-DESIGN.md preceded implementation. Exact string/own-entry class validation now runs before login reservation and when loading saves. Unsupported text now consumes the existing application-message budget before being ignored. No changed limits, content, save schema, UI styling, camera or town.

## Measured before/after

Before root: `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-message-before-f9f726f8ff374456a02cca3bcee2502c`. [Test output](checks/message-before.txt) and [actual socket observations](checks/message-before-observations.json).

Four inherited names (constructor/toString/__proto__/hasOwnProperty) passed the old guard, triggered unhandled async errors and held the name until the socket closed. Two array forms coercible to class keys entered the world and wrote malformed class values. Six other invalid values already rejected correctly. The two deterministic text-budget tests failed; ordinary binary/occasional-garbage behavior passed. This establishes actual behavior on the local server, not a claim about attacks against a public deployment.

After: all12 invalid wire values reject with the existing Unknown class message before reservation/save creation; a valid all-class rotation reuses each name. Save-load tests quarantine these12 malformed variants byte-for-byte; a newer-format malformed class remains untouched and is refused as newer, not corrupt. Existing golden saves and normal characters pass unchanged.

Deterministic Session checks prove text consumes the same60-message window, over-budget command replies remain intact, short bursts remain connected, the next window recovers and sustained text/binary traffic disconnects at the same existing threshold. Real sockets separately close a text flood with4000 and both whole and fragmented65,537-byte messages with1009; server health remains200 with no save files created.

First after-run:17/18 passed; the new future-save test accidentally used an18-character fixture ID, exceeding the existing16-character rule. Corrected fixture ID only. Retained [pilot output](checks/message-after-pilot.txt); no weakened assertion or production workaround.

Final strict [verification](checks/message-verify.json): all18 stages pass in `C:\Users\LAPTOP~1\AppData\Local\Temp\hearthfall-verify-hyFu6v`, including13 connection/security tests,9 foundation tests,745 server checks and382 simulation checks. Typecheck, content and build pass. Server check count varies with observed test events; these are this run's counts. Existing bundle-size advisory remains.

## Inspected local browser

`capture-connections.mjs --message-boundary` stores a separate evidence folder without replacing prior captures. Installed Chrome154.0.8037.99,1920×1080,DPR1, fresh profile/data at `hf-connection-ui-ED3pmz`, BACKUP_DIR empty. [Trace](checks/messages/trace.json), [built client](checks/messages/01-built-client.png), [Vite proxy](checks/messages/02-vite-proxy.png).

Both images opened and inspected: existing HUD/minimap/service prompt and town render normally; measured view height remains620. Both actual clients receive101; a foreign local page receives403. The startup0FPS label in the first frame is not a measured performance result. Chrome is headless with document.hidden=false: no foreground crowd, human-usability or performance acceptance claimed. Owned processes closed. General browser-control tool still failed kernel startup; no personal tabs inspected.

## Effect and remaining work

Removed accidental acceptance of inherited/coerced classes and text's budget bypass. Invalid old files remain recoverable in quarantine rather than being reinterpreted as valid characters. No legitimate class/character content is deleted. Accounts, authentication throttles, control-frame/connection abuse, parser resource bounds, trusted deployment and independent review remain open. Rollback reverts these guards/tests together; no migration required.
