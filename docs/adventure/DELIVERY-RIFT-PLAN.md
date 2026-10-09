# Delivery and rift objective adapters — C079

L93/D034 precede code. Preserve current authored definitions and add delivery/rift schema and validation. Delivery uses exact item base/rarity and one batch bounded by inventory capacity. UI selects named bag items, previews them, then explicitly confirms their consumption; server checks current revision/step, proximity, exact IDs, unique ownership, protection and pending enchantment before any mutation. Return embedded gems as existing item consumers do. Build the next state/reserved reward first, then update one character's inventory/gems/progress synchronously. This is not a new durable store.

Rift completion credit attaches to the actual server completion path once. Use existing present-member eligibility and existing difficulty, not kill range or nonexistent rank. No before-acceptance/after-completion/reconnect credit; no client completion command. Guide outside-rift objectives toward the existing Obelisk.

Focused tests cover forged/stale/remote/partial/duplicate/protected/wrong-item delivery, gem conservation, save/reload, repeated turn-in and four-client completion eligibility plus difficulty filtering. Type/content/build once, existing relevant quest/protection tests, labelled local Chrome1920x1080 delivery gallery, no full campaign replay. Record remaining P5 and persistence limits. Whole roadmap continues.
