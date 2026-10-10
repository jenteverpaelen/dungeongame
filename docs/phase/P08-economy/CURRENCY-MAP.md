# Economy v1 currency and policy map — C093

Evidence before design: L113/D051, C021/C027 current audits and C090–C092 additions. Actual resource flows must be measured at acquisition/payment, not at ground-drop generation. No new currency.

| Resource | Current sources | Current sinks / conversions | Transfers that are not sinks |
|---|---|---|---|
| Gold | Ground pickup (ordinary/elite/boss/goblin), offline grants, authored contracts, selling owned gear | Stock purchases/buyback, enchant/empower/transmute/extract/reforge/socket, gem removal/fusion | None between characters; no player trading |
| Scrap / dust / crystal | Eligible loot salvage, offline grants, declarative quest bundles if authored | Recipe-specific artisan/Cube costs | No loose-material player transfer |
| Souls | Eligible legendary/set salvage, declarative quest bundles if authored | Higher rarity crafting/extract/reforge costs | No player transfer |
| Death's Breath | Eligible monster ground pickups, declarative quest bundles if authored | Higher crafting/upgrade costs | No player transfer |
| Five gem types by rank | Ground pickup, declared quest bundles if authored | Fusion converts three equal rank into one higher rank and spends gold; explicit retained-item release can remove socketed gems | Insertion/removal, equip/unequip, stash and retained sale/buyback preserve gem custody; destroy/salvage return socketed gems |
| Gear | Drops when picked up, reserved quest rewards when claimed, deterministic camp stock | Salvage, extract, explicit destroy/release; transmute replaces one identity; reforge changes properties | Equip/stash/sale/buyback retain exact identity, binding/protection/provenance |

Debug grants are separate test/admin creation, never ordinary earning-rate evidence. Generated or expired ground loot was never acquired wealth. Level/skill/Paragon/Cube XP are progression, not spendable gold/materials; they keep their existing counters.

## Closed v1 design choices

D20: retain hybrid binding and server ownership checks, with bound items still allowed at NPC sale/buyback. There is no implemented player trade/account transfer to certify. D22: no durability/repair, consumable upkeep or chance shop in v1. Existing globes/regeneration remain. No travel/respec fee. This avoids adding an unmeasured upkeep burden to the owner's no-required-repeat story; it is not a claim that every later sink is unnecessary. D24: retain60 per-character stash, revisit account/tabs in P14 with ownership. D25: separate physical artisan service identities and existing per-operation proximity, while Cube XP is the longer shared progression. Do not fabricate three new artisan leveling currencies.

None of these decisions removes existing game content. They close optional decision branches in v1 and may be reopened only with evidence and recorded effect/rollback. D21 player trading remains P15; D23 item pool is P11. P8 acceptance still needs source/sink distributions, durable boundaries, concurrent/soak evidence, an owner economy band and independent human review.
