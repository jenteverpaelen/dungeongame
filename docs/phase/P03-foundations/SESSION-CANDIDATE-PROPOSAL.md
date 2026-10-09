# Isolated session candidate — download proposal C050

2026-10-09. Research at dc8ccce, L61. This makes C037's raw-Node integration question concrete without migrating accounts, adding production endpoints or replacing the server. The owner has not yet approved this specific download.

## Exact proposed downloads

All files come from the official npm registry. Compressed sizes were read using HTTP HEAD with Range bytes=0-0 on2026-10-09; no archive body was fetched. Total **82,439bytes** (82.439kB). The [metadata manifest](checks/session-candidate-manifest.json) records individual integrity hashes, repository commits, declared licences and dependencies. Package installation overhead is not included in compressed transfer sizes.

| Package | Pinned version | Compressed bytes | Source |
|---|---|---:|---|
|express-session|1.19.0|20,130|[archive](https://registry.npmjs.org/express-session/-/express-session-1.19.0.tgz)|
|cookie|0.7.2|8,220|[archive](https://registry.npmjs.org/cookie/-/cookie-0.7.2.tgz)|
|cookie-signature|1.0.7|2,097|[archive](https://registry.npmjs.org/cookie-signature/-/cookie-signature-1.0.7.tgz)|
|debug|2.6.9|16,514|[archive](https://registry.npmjs.org/debug/-/debug-2.6.9.tgz)|
|depd|2.0.0|8,374|[archive](https://registry.npmjs.org/depd/-/depd-2.0.0.tgz)|
|ms|2.0.0|2,874|[archive](https://registry.npmjs.org/ms/-/ms-2.0.0.tgz)|
|on-headers|1.1.0|3,607|[archive](https://registry.npmjs.org/on-headers/-/on-headers-1.1.0.tgz)|
|parseurl|1.3.3|3,952|[archive](https://registry.npmjs.org/parseurl/-/parseurl-1.3.3.tgz)|
|random-bytes|1.0.0|2,673|[archive](https://registry.npmjs.org/random-bytes/-/random-bytes-1.0.0.tgz)|
|safe-buffer|5.2.1|9,972|[archive](https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz)|
|uid-safe|2.1.5|4,026|[archive](https://registry.npmjs.org/uid-safe/-/uid-safe-2.1.5.tgz)|

These exact pins form a fixture resolution satisfying the inspected dependency ranges, including debug→ms and uid-safe→random-bytes. This is not an assertion that every version is the latest or vulnerability-free. No typings, Express framework, package scripts, paid service or extra dependency download is implied. If the manifest changes, stop and reassess rather than silently expand the download.

## Source findings that the experiment must resolve

The [v1.19.0 middleware](https://raw.githubusercontent.com/expressjs/session/v1.19.0/index.js) uses Node request/response APIs, wraps response end and continues without a session when the store reports disconnected. Its debug namespace can expose session identifiers and complete cookie values. **Inference:** raw Node integration may work, but sensitive routes must explicitly await persistence, require authenticated state and suppress secret-bearing diagnostics. This is source analysis, not a runtime result or broad security verdict.

The [store regeneration method](https://raw.githubusercontent.com/expressjs/session/v1.19.0/session/store.js) calls generation after destruction's callback and passes the error onward. The [Session methods](https://raw.githubusercontent.com/expressjs/session/v1.19.0/session/session.js) expose explicit save/reload/destroy/regenerate callbacks. An adapter must test failures and refuse successful login/recovery on incomplete state transitions. Cookie middleware alone cannot revoke an already-authorized game socket.

The complete [Cookie source](https://raw.githubusercontent.com/expressjs/session/v1.19.0/session/cookie.js) also leaves Secure and SameSite to configuration; its cookie lifetime is not a server-side revocation policy. Validate explicit options and trusted TLS termination rather than adopt defaults as product decisions.

## Individual licence and advisory review

All eleven upstream licence bodies have now been read individually. Each is MIT, requiring retention of its notices and disclaiming warranty. This is a source-text review, not verification of the still-undownloaded archive contents. GitHub's public API resolved renamed repository/file paths after web retrieval failures; direct HTTPS text reads succeeded for the seven commit-pinned rows below.

| Package | Exact upstream text read | Notice holder as published |
|---|---|---|
|express-session|[v1.19.0 LICENSE](https://raw.githubusercontent.com/expressjs/session/v1.19.0/LICENSE)|TJ Holowaychuk; Douglas Christopher Wilson|
|cookie|[v0.7.2 LICENSE](https://raw.githubusercontent.com/jshttp/cookie/v0.7.2/LICENSE)|Roman Shtylman; Douglas Christopher Wilson|
|cookie-signature|[registry gitHead Readme.md, License](https://raw.githubusercontent.com/tj/node-cookie-signature/432ea0c14fbdd8d24354820faff2c6f6d2426757/Readme.md)|LearnBoost|
|debug|[2.6.9 LICENSE](https://raw.githubusercontent.com/debug-js/debug/2.6.9/LICENSE)|TJ Holowaychuk|
|depd|[registry gitHead LICENSE](https://raw.githubusercontent.com/dougwilson/nodejs-depd/6d59c85d093092e65ec77033576417d743079fa0/LICENSE)|Douglas Christopher Wilson|
|ms|[registry gitHead license.md](https://raw.githubusercontent.com/vercel/ms/9b88d1568a52ec9bb67ecc8d2aa224fa38fd41f4/license.md)|Zeit, Inc.|
|on-headers|[registry gitHead LICENSE](https://raw.githubusercontent.com/jshttp/on-headers/4b017af88f5375bbdf3ad2ee732d2c122e4f52b0/LICENSE)|Douglas Christopher Wilson|
|parseurl|[registry gitHead LICENSE](https://raw.githubusercontent.com/pillarjs/parseurl/0a5323370b02f4eff4069472d1e96a0094aef621/LICENSE)|Jonathan Ong; Douglas Christopher Wilson|
|random-bytes|[registry gitHead LICENSE](https://raw.githubusercontent.com/crypto-utils/random-bytes/3dcd47425a3dfe858ee8debcd4db0c1222110bc3/LICENSE)|Douglas Christopher Wilson|
|safe-buffer|[v5.2.1 LICENSE](https://raw.githubusercontent.com/feross/safe-buffer/v5.2.1/LICENSE)|Feross Aboukhadijeh|
|uid-safe|[registry gitHead LICENSE](https://raw.githubusercontent.com/crypto-utils/uid-safe/e15ef6049b23826eabe2d88e9f1835436e54e0d9/LICENSE)|Jonathan Ong; Douglas Christopher Wilson|

The official npm bulk advisory endpoint returned an empty object for these exact eleven pins at 2026-10-09T07:36:36Z; [the request and response are recorded](checks/session-candidate-advisories.json). This means that query returned no listed advisories, not that the packages are safe or all advisory databases agree. Recheck at eventual installation. Archive integrity, actual licences/source agreement, unsafe files and execution behavior remain pending. Existing production notice approval is not extended to this tree.

## Scope after approval

Download only these archives into an ignored isolated workspace, enforce the recorded byte totals and registry integrity hashes, reject unsafe archive paths/links and inspect actual package contents/licences. No lifecycle scripts, root package-lock changes, live routes, real characters or credential collection. Use installed Node and synthetic credentials/state with fresh DATA_DIRs for tests.

Then test a minimal raw Node HTTP/session-store fixture: signed-cookie tampering, explicit secure-cookie behavior, regeneration/save failures before response, missing/disconnected store denial, concurrent logout versus a stale save, expiry/revocation including an already-open synthetic WebSocket, and diagnostics redaction. Cookie options and deadlines are fixture inputs; final game idle/expiry/recovery policies are not selected by this experiment. If a concurrent stale save can recreate revoked state, require a durable revocation/tombstone boundary before considering production adoption.

Use a synthetic store and then the worker candidate only as needed to test the integration. Keep source observations distinct from runtime assertions. The current owner-population question still controls eventual legacy migration, not this isolated experiment. Security review, privacy, password/recovery implementation, account backup/restore and rollback acceptance remain outstanding even if the fixture passes.

Removal: none. No download or implementation has occurred. Rollback abandons the candidate and preserves its findings; the working game's dependencies/login/saves/UI are unchanged.
