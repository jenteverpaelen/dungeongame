# Placeholder and prototype registry

Inspected 2026-10-09, solo. This records actual substitutes and development seams; it does not label all unfinished roadmap features as placeholders. Evidence: source inspection and `rg` for TODO/FIXME/placeholder/stub in client, server and shared TypeScript. No content removed.

| ID | Location / current role | Exposure and limitation | Replacement or removal condition |
|---|---|---|---|
| PH-01 | `client/src/render/art/townBlockout.ts`, flat layout renderer | Historical layout-stage renderer; labeled blockout. The collision overlay in the same module is still used by the current scene. | Keep while layout fixtures need it. Do not delete the module merely because final art exists; retain/extract the useful collision overlay first. Town is frozen. |
| PH-02 | `client/src/dev/galleryVfx.ts`, placeholder entity shapes | Explicit development gallery targets, not evidence of final character art or live combat cost. | Replace only if testing requires real rigs; preserve a cheap isolated VFX test mode. |
| PH-03 | `client/src/dev/galleryPanels.tsx`, mock save and command API | UI preview with synthetic progression; cannot establish server authorization, proximity or persistence. | Keep as a development fixture; all gameplay acceptance also runs through a real server. |
| PH-04 | `server/test/stubInstance.ts` selected by `SIM_STUB=1` in `server/src/world.ts` | Explicit infrastructure-only simulation; not valid for combat correctness or gameplay load claims. | Keep for world-manager tests; use the real simulation for gameplay/load acceptance. Never silently fall back when real simulation fails. |
| PH-05 | `client/src/main.ts`, autostart query and window inspection handles | Development convenience currently bundled; no account authentication boundary. Server must validate every command. | Reassess at account/release hardening; preserve test access deliberately instead of assuming globals grant authority. |
| PH-06 | `client/src/render/art/adventure.ts`, Rillwake/Bracken first-pass mill, banks and floodgate | Playable original geometry art, documented as a first pass. Plain low walls, static wheel and angular shore are not final environment quality. Existing forest and Mossback body art are reused, including the new named keeper. | Replace after a sourced environment-art pass preserving shared collision; keep the playable route and quest tests. |
| PH-07 | `client/rillwake-qa.html` and `src/dev/rillwake-qa.ts` | Local Vite-only movement/interaction harness; not a production build input. Uses ordinary input/commands and explicit debug-gated HP. Steering can be unreliable at low frame cadence; do not equate helper failure with player movement failure. | Retain for route regression until a broader browser test kit replaces it; no gameplay authority bypass. |

The HTML input `placeholder` attributes and the mushroom `stubFoot` drawing function are not unfinished content and are excluded. The remaining roadmap features live in `docs/EXECUTION.md`; unknown performance targets live in the relevant phase records.

Adding a real temporary substitute requires its purpose, label, exposure, limitation and replacement condition here. Removal must also be recorded in `docs/CODEX_CHANGELOG.md` with effect and rollback.
