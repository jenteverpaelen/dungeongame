# C095 — Economy v1 distribution and loop report

L115/D053 precede the model. **Owner policy: allow savings; prevent exploit loops. No wallet cap.** Stock fills weak slots after a few packs; story never requires repeats. No prices, rewards, crafting rules, currencies or content changed in this checkpoint.

## Reproducible measurements

scripts/audit-economy-v1.ts with an explicit output path requires a fresh empty isolated DATA_DIR and disables backups. [BALANCE-MODEL.json](BALANCE-MODEL.json) contains90 ordinary rows,48 elite rows,28 offline cases, recipe costs/expected attempts and2,100 stock-loop checks.1,809,600 calls to the actual drop generator;200 deterministic trials per row; three classes,15 levels, Normal and highest currently available difficulty. Server difficulty gold multiplier included. No new package or asset.

Each ordinary trial generates100 kills at a fixed level, assumes every drop collected, zero reward affixes and resets pity. Elite trials measure one monster at a time, so they do not represent a long pity history. Item sale and salvage are alternative uses; the model does not add their rewards together. Goblin hit spills, rift bonuses, travel, combat time, inventory limits and player item retention are excluded. This is neither an active gold/hour benchmark nor a human pace estimate.

Normal mage sample (class equipment generation differs; full three-class results are in JSON):

|Level|Mean generated gold/100 kills|p10–p90 gold|Mean items|Additional gold if every item is sold|
|---|---:|---:|---:|---:|
|1|151.9|115–192|7.20|50.4|
|7|692.4|527–850|7.55|241.6|
|20|3825.8|2788–4763|7.07|1222.2|
|35|15297.0|11770–19483|7.44|5230.3|
|50|52775.5|38539–65103|7.70|18283.3|
|70|236828.9|177677–295068|8.03|84864.4|

At20, a Normal champion averages696.07 gold and1.47 items; rare elite1,055.31/2.48; boss2,763.46/6.10. A boss averages2.895 Death's Breath, and salvaging all its gear yields2.19 souls. These are simulated generated quantities, not guaranteed collection. Boss/elite content makes specialist material acquisition distinct from ordinary gold farming.

## Spending interpretation

C092's independent12/24-kill model still supports the owner-selected stock target:44.2–48.55% can afford after12 ordinary kills,88.6–91.45% after24, excluding sales/elite/contracts. No tuning is warranted solely to force a guaranteed purchase by the twelfth kill.

At20 a first rare enchant costs1,700 gold plus1 crystal (~44.4 ordinary-kill gold equivalents); rare+1 costs6,500 plus2 crystals (~169.9). At70 those equivalents are8.3 and31.2 because the inherited gold curve grows faster than recipe base costs. A rare+9→10 starts at20% with Fortune:3.301 expected attempts, never more than15 under the current model. At70 that means~7,088 ordinary-kill gold equivalents plus materials, before difficulty bonuses. Recipe unlocks, material acquisition and gold are separate constraints; a ratio is not a time target.

Existing offline formula assumes900 kills/hour with a12h cap. At20 in Kilnwatch it grants34,291 gold/hour; at70 in the unrestricted Glade2,093,769. An hour also yields22 scrap/22 dust/6 crystal, but no gear/gems/souls/Death's Breath. It ignores equipped weapon DPS and chosen difficulty. These are exact current formula outputs, not active-player performance. A level20 fixture gains10 levels from one hour; P14 must explicitly evaluate this inherited idle progression against the authored story. Preserve it now instead of silently changing the game's idle premise.

## Exploit and custody findings

All2,100 offers (70 input levels ×3 classes ×10 templates) cost strictly more than their resale, with zero salvage/CubeXP. Improvements do not raise resale, so paid enchant/upgrade cannot create a profitable purchase loop. Sell/buyback returns the exact retained identity for the same quoted price; protection, binding, vendor provenance and socket custody remain. Item destruction/salvage may recover previously owned socket gems; that is return of custody, not generation. Fusion destroys three equal-rank gems for one higher-rank gem and gold; removal costs gold. No reverse recipe prints more inputs. C090–C094 actual-handler conservation, stale/replay, concurrent and process-restart checks support these paths; model algebra alone does not certify all hostile inputs or multiple independent servers.

## Conclusions and limits

Keep current prices/rates: the vendor target has measured support, savings are explicitly allowed, and existing premium improvements/material gates supply spending choices. No mandatory tax, repair or respec/travel charge is added. No unmeasured gold/hour band is invented. Local live acquired/spent counters and this simulation provide the selected v1 dashboards; future tuning can use actual owner play and P9/P14 content.

The selected P8 implementation scope is now present; [CHAPTER-REPORT.md](CHAPTER-REPORT.md) maps every row. G6 human1–20 play, an observed active earning band, real longer soak, independent review and account/trade rules remain explicitly unverified. Owner asked to defer full playtesting and continue the roadmap. No global inflation/release guarantee.

Removal/rollback: no game content or systems removed; historical C021/C092 reports remain intact. This report/model can be replaced by newer evidence without changing saves. C094 transaction rollback limitations still apply.
