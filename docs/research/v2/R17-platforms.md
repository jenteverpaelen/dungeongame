# R-17 — Platforms

Read 2026-10-09. Browser-first remains the current product; no Steam purchase, upload or wrapper added.

[STEAM-COMPAT](https://partner.steamgames.com/doc/steamhardware/compat) now covers Deck and Machine. Its criteria include complete default controller navigation, matching input glyphs, controller-accessible text entry and playable default performance. Deck-specific text/resolution criteria are a separate check. These are platform review requirements, not evidence Hearthfall already meets them.

## Hearthfall inference

A desktop wrapper does not solve input navigation, server availability, text entry, save ownership or performance. Keep the browser build working and isolate any future packaging layer. Client cloud files must not become authority for server-owned character progression.

## Charter gaps

- Steam SDK/wrapper licence, integration, review, cloud saves and achievements: pending.
- Browser compatibility: installed Chrome locally verified for prior captures; Edge/Firefox/Safari and low-spec devices not certified.
- Controller/Deck: no hardware test or controller UI completed.
- Localization: C047 adds123 scoped English Settings/control keys and catalogue checks, with exact before/after browser comparison. Full text inventory, languages and translation cost remain pending; see the [report](../../phase/P03-foundations/TEXT-CATALOGUE-REPORT.md).

No published capacity or platform badge based on a headless browser screenshot. Maintain the approved UI style while making future interactions reachable on each input method.

## Text context and formatting boundary

W3C's [string reuse](https://www.w3.org/International/articles/text-reuse/) and [composite message](https://www.w3.org/International/articles/composite-messages/index.en.html) guidance supports context-specific complete messages and reorderable runtime values. Equal English words do not establish interchangeable translations. C047 therefore keeps complete per-action sentences instead of inserting translated action names into shared grammar. This is an implementation inference, not a chosen language list.

The [Unicode MessageFormat2 quick start](https://messageformat.unicode.org/docs/quick-start/) documents variables, formatting, markup and matching beyond literal string replacement (read through matcher introduction). Our bounded helper implements none of that standard. Actual multilingual/plural/number requirements need a maintained formatter assessment and language/layout review before expansion.
