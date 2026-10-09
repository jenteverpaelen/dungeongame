# Foundation evidence, read 2026-10-09

- **FND-01 [M/O]**: roadmap §2.2 and P3 explicitly identify F-TEL-01, F-SAV-01/02 and F-ADM-01 as independent work. Owner now directs continuing the entire file with supported autonomous changes. Local `package.json` has separate checks, no verify runner; `server/src/commands.ts` enables debug unless DISABLE_DEBUG=1; `persistence.ts` normalizes unversioned JSON.
- **FND-02 [S]**: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), Deny by Default / Validate Permissions on Every Request, live undated guidance. Recommends explicit default denial and enforcement for every request. Used for opt-in debug guard, not a claim that this implements accounts or makes public hosting safe.
- **FND-03 [M]**: existing Windows regression records two SIGTERM failures. The runner must preserve the actual exit code/logs and distinguish these from passing checks. No automatic blanket suppression.
- **FND-04 [M]**: local Node v24.19.0; installed tsx/TypeScript/Vite already execute the existing tests. Use their local entry points via process.execPath, without package downloads or Windows .cmd shell quoting.
- **FND-05 [M]**: `normalizeSave` pads inventory/stash, repairs defaults and retains excess item slots. A schema version must preserve that behavior and item identities. Future-version files must remain untouched, including by the corruption quarantine path. Fixtures are synthetic and generated from current code, never copied from actual saves.

**FND-06 [M]**: a future save can change class IDs or field names. Inspect its version before legacy field validation; otherwise the old validator can quarantine a valid future format. Add a fixture covering that boundary.

**FND-07 [M]**: source search identifies explicit development blockout/gallery/stub seams. A registry should distinguish these from normal input placeholder text and from unfinished roadmap features. Keep the collision overlay and infrastructure fixtures; indiscriminate deletion would remove useful checks.

Later-foundation research is in `docs/research/v2/R12-technology.md`. The matching Node v24.19.0 documentation now marks SQLite Stability 1.2 (release candidate); the earlier v24.10.0/1.1 finding is historical. Authentication/storage adoption still needs measurements and design.
