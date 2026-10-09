# Earned first decisions — local observation

2026-10-09. Plan: FIRST-DECISIONS-PLAN.md; evidence L40. All nine final1920×1080 screenshots opened and inspected. Own installed Chrome154.0.8037.99, Node24.19.0, fresh profile and empty saves at `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-first-decisions-mPBDqB`. Debug disabled, BACKUP_DIR empty, camera620, document visible. Chrome uses its headless renderer; this is no foreground performance benchmark. No production code changed.

## Observed [M]

The script enters through class/name controls and the physical Waypoint. Its field movement is explicitly assisted using replicated entities/map and normal input/server movement. No item/XP grants, save seeding, teleports or loot deletion.

| State | Observed result |
|---|---|
| Field entry | L1, no inventory items or kills |
| End field observation | L3,16 credited kills,5 items,118gold,2skill points, no deaths |
| Return through field portal | L3, same kills/items,136gold; more nearby gold picked up on return |
| Hover earned bracers | Comparison shows +2.6% Damage and +2.7% Toughness; green bag arrow |
| Right-click equip | Same item ID moves from bag to empty wrist slot, becomes bound; bag5→4 |
| Derived values | Sheet DPS4.9938→5.12295 (+2.5862%); Toughness254.39556→261.27111 (+2.7027%); rounded comparison agrees |
| Select Seeker rune | Selection confirmed by server; points remain2 |
| Buy first Magic Missile tier | Points2→0; tier1; displayed coefficient230%→345% including rune |
| Refund | First click leaves points0 and shows confirmation; focus change cancels; new confirmation returns2points and clears tiers, keeps rune |
| Reconnect | Same equipped ID/bound state, Seeker selected,2points, no tiers; description299% for rune alone |

Screens01–09 and trace.json retain full synthetic character/derived/UI snapshots. This trace ends about35.1script seconds after launch, including build/startup and scripted actions. Field observations are sampled about once per second: first positive kill count appears at2.136s, first sampled L2 at9.087s and first sampled item at11.062s after the field loop begins. These are sampled observations, not exact event timestamps or human pacing targets. The end-of-field capture is about12seconds after its entry capture. No time-to-discover/control-comprehension claim.

## Visual findings and limits

The comparison, equipped slot, available/locked rune cards, paid tier, refund prompt and reload states fit the existing panels at1080p. No style changes. The field level-up effect is visually intense; this observation supports auditing reduced-flash options, not changing the default effect or claiming a photosensitivity threshold. The item comparison does not itself teach the right-click action in this frame; script knowledge must not be mistaken for discoverability. Locked text is dim; contrast and assistive-input usability remain unmeasured.

This covers one Mage and one earned wrist item. It does not cover unsuitable items, occupied/two-handed swaps, full-bag failures, drag/drop, all classes, human understanding, reference-game UI or combat effect size. Existing invariant/simulation tests cover additional rules separately; this flow does not replace them.

## Harness correction and validation

Pilot `hf-first-decisions-wiphp3` earned L3 and7items before a harness TypeError: it queried nonexistent `map.structures` instead of actual `map.portals`. Preserved `pilot-portal-field.json`; corrected from MapData/game interaction code and reran from a fresh directory. No game defect inferred. The final flow passed its UI/server assertions; a separate trace audit confirms item-count/identity conservation, exact derived comparison and persisted point/rune state. Existing Vite chunk-size warning remains. No whole-suite rerun for this research-only addition; last production verify is C025.

Addition/rollback: separate observation harness and evidence only; no content removed or balance changed. Remove the harness independently if needed, retain historical evidence. Next: reduced-flash behavior audit and unfamiliar-player protocol, alongside reference first-use footage and remaining roadmap foundations.
