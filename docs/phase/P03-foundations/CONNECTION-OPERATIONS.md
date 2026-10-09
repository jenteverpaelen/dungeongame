# Connection configuration

`WS_ALLOWED_ORIGINS` is an exact browser Origin allowlist for the game `/ws` endpoint. Unset: HTTP localhost/127.0.0.1/[::1] on server PORT (default2567) and Vite5173. Set: replace all defaults. Empty/malformed entries stop startup before save-directory initialization. Use serialized origins: `https://play.example`, not a URL path, wildcard, trailing slash or explicit default `:443`. Browser ports and schemes matter.

PowerShell example for an isolated local server on another port:

```powershell
$env:PORT='2577'
$env:WS_ALLOWED_ORIGINS='http://localhost:2577,http://127.0.0.1:2577,http://localhost:5173'
# Set DATA_DIR to an isolated directory for tests; never use real saves in a test.
npm start
```

For the normal defaults, remove that environment override. A Vite automatically selected fallback port, LAN address or public hostname needs its exact origin added. Changing config requires restarting the server. Never use an incoming Host/X-Forwarded-Host value as permission. The browser's visible page origin is relevant, not the backend proxy target. HTTPS hosting uses an HTTPS origin even though the WebSocket itself uses WSS. Production TLS/reverse-proxy configuration is still an operator prerequisite and has not been deployed or verified here.

Session logs now show only the actual socket peer. X-Forwarded-For is ignored; behind a reverse proxy the peer is the proxy. Trusted-client attribution is deliberately unfinished until the real topology and spoofing controls can be verified. No new IP-based throttle or identity claim is introduced.

Origin validation blocks unlisted browser pages; native clients can forge the header. Existing name-only character access remains unauthenticated. Accounts, legacy ownership, recovery, durable transactions, TLS, privacy/retention and independent security review remain open. No real saves or ownership records are migrated by this change.
