# Optional manual skill keys — C085

Implemented Claude F-CMB-05 / §10.1 A2 for the existing four slots. L99/D040 and [plan](MANUAL-SKILLS-PLAN.md) preceded code. Settings → Controls offers a browser-local, default-off opt-in and four rebindable physical keys. Existing custom bindings survive; missing new actions receive unused keys. The HUD and Help show actual keyboard-layout labels when enabled. Automatic combat remains the default. Town, camera and UI style remain unchanged.

## Why and scope

Claude's optional-assist recommendation and the local brain/cost/receipt paths define this implementation. The [historical Blizzard preview](https://news.blizzard.com/en-gb/article/23746020/diablo-ii-resurrected-patch-2-3-highlights-coming-soon), indexed D2R-QUICKCAST-2021 / D2R-QUICKCAST-01, supports optional direct keys and visible bindings. It does not prove current D3 behavior or Hearthfall balance. No reference assets, text, skill counts or numeric values imported.

The server accepts one slot-and-skill request for the next simulation tick. It rechecks life/control state, exact slot, class and unlock at execution, then uses the existing targeting, cost, cooldown and Patient Thief path. A successful manual start uses that tick's single slotted-cast budget; failed requests report a reason and ordinary automatic evaluation continues. Requests cannot accumulate, survive travel/reconnect or spend at acceptance. Connection receipts prevent a repeated request ID from re-queuing. No mouse aiming, held-repeat casting, save field or new combat number. Protocol7 matches client/server; save4 remains.

Manual intent bypasses automatic trigger conditions, including per-slot pause/still restrictions. An explicit channel start is marked manual so movement or an automatic pause does not cancel it. The same key stops it with the existing400ms recovery; normal resource drain, no-enemy grace, unequip, stun and death still apply. Later automatic starts follow the selected automatic mode. Input ignores typing, capture, modifiers, repeats and open game panels.

## Measured checks

On the owner's PC, isolated saves only:38 focused tests passed across manual casts, prior auto conditions, save fixtures, input/preferences and catalogue integrity. All15 slotted skills executed their real paths with auto paused. Seven manual tests were rerun after correcting two test-type issues (TypeScript control-flow narrowing and receipt response shape). Typecheck, content validation, existing combat simulation and production build passed. Existing Vite config/chunk warnings remain. The initial sandbox test launch failed before tests at Windows user-info lookup; the same checks ran normally outside that sandbox. No RAM-failure claim.

Paired two-tick fixture: default1 slotted cast versus manual2, both75 resource remaining. Each tick stayed within one slotted cast. The difference is a zero-cost Frost Nova manually triggered below its automatic density requirement, followed by the normal buff. This demonstrates tactical differences, not parity or a measured overall advantage. Full class/build effectiveness and owner feel review remain open.

Actual Chrome on the owner's PC: opt-in initially off; enable; rebind slot1 to Y; Meteor with no target rejected; slot3 begins its11-second cooldown; immediate repeated attempts produce cooldown/pending feedback; reload retains enabled/Y; Help lists current keys; pressing through Help produces no cooldown; close Help and casting works. Infinite HP restored after reconnect. Original Digit1 binding and default-off opt-in restored without resetting other controls. No captured console warnings/errors. Synthetic PumpC075 had offline progress on reconnect; it was claimed in the isolated preview only.

Inspected [controls](../../adventure/tour/c085-manual-controls.jpg) and [cooldown feedback](../../adventure/tour/c085-manual-cast.jpg), both1920×1080. The existing narrow panel fits this viewport; explanatory text remains small. A third premature, non1080p spell capture was moved to ignored local scratch rather than presented as visual proof. No live field/channel video, sustained performance benchmark or broad accessibility acceptance claimed.

Temporary data roots: hf-c085-focused-863fb6d93d2d4f88addddc6444af6e7a (sandbox launch failure), hf-c085-focused-edf47d3c885641dbb6b3528a3e6e0ac7, hf-c085-build-117c3ae47d2048f6b420446142c5912d (test-type failure), hf-c085-build-bd7aee1bda5e4a7b82cf01482a932cda, hf-c085-manual-final-ff1dfb4c729d4a068af0b58608ffd183. Browser remains on the pre-existing isolated hf-pump-browser-da62d181bbb24ae4ae06b78ec15ae7b6 root. No real saves read or modified.

## Remaining work and rollback

F-CMB-05 functionality is implemented; full P4 balance/feel/spec acceptance is separate. Advanced automatic rules, utility/passive design and the wider roadmap remain. No game content removed. The automatic cast block was factored into one shared function to prevent manual/auto cost drift; its trigger order and primary attacks remain. Disable the opt-in to restore original controls. Full rollback removes both command and client entry together while retaining harmless browser preferences; no character-save downgrade. No dependency or download.

The roadmap ledger now separates current status from the historical baseline. Conservative classification after this checkpoint:4 implemented scopes,56 partial/research,87 open among147 feature rows. These counts are not effort percentages or completed-phase claims. The previous15–20% estimate included partial work/research and should not have been read as completed features.
