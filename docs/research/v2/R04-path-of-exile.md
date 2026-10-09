# Path of Exile 1 and 2 — R-04, first evidence pass

Read 2026-10-09. These are separate games and version histories. Overview L1 and patch details L2; current 2026 builds and observed onboarding remain Q. Claims POE-01–03 and POE2-01.

## Findings

PoE1's [official overview](https://www.pathofexile.com/game) describes skill/support gems in equipment sockets and a shared passive tree. Its no-gold economy description is stale: [3.26.0 core Settlers notes](https://www.pathofexile.com/forum/view-thread/3787013) explicitly include monster-dropped gold and its uses. An official URL is not sufficient proof of current rules. [S; POE-OVERVIEW/326]

[PoE1 3.0.0](https://www.pathofexile.com/forum/view-thread/1930316/filter-account-type/staff) introduced help pages unlocked through play with integrated tutorials. This is evidence of a teaching pattern, not its success rate. [S; POE-300]

[PoE2 0.3.0](https://www.pathofexile.com/forum/view-thread/3826682/filter-account-type/staff) removed the one-copy-per-character support restriction and introduced support tiers. Failing a support's attributes disables that support instead of the whole skill. Neither older launch constraints nor PoE1's equipment model should be silently attributed to the other game. [S; POE2-030]

## Application to Hearthfall [P]

Separate the player's active skill from optional modifiers, and make unavailable modifiers understandable. Our runes already provide a smaller build-choice surface [M; HF-AUDIT]; adding a huge tree is not automatically an improvement. Reuse existing panels for any future explanations. Currency/trade changes need their own economy and persistence research.

## Unfinished

Both games need versioned first-ten-level traces, recovery/respec rules, loot-filter and inventory error flows, and separate ownership/reset tables. Economy policing, maps/Atlas and public anti-abuse evidence remain out of this pass. Next: source the current versions, then inspect gem acquisition/equipping/invalid-support recovery without conflating their implementations.
