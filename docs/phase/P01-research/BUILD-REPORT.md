# Existing build choices — measured inventory

2026-10-09, solo, owner's Windows PC / Node24.19.0. `BUILD-MEASUREMENT-PLAN.md` and L36 precede the audit. No skill, rune, level, cost, text or combat behavior changed.

## Reproduction / scope

`scripts/audit-builds.ts` requires an explicit empty isolated DATA_DIR and leaves it empty. It enumerates actual definitions and exercises shared purchase/refund functions and server context helpers with unequipped synthetic characters. 18 skills × four rune states (none plus three choices) × four tier states gives **288 helper combinations**; all 54 tiers and 54 runes are included. Two fresh-directory runs produce SHA256 `EC62B74A976CD025F6681D63F195F08379FECD07E512685731DE898423692EEB` for `checks/build-audit.json`; standalone strict script typecheck passes.

This is not 288 combat simulations. Rune flags having code consumers does not prove correct execution. There are 38 distinct declared behavior flags and each has a lexical consumer candidate, subsequently usable as an audit index. The existing 382-check simulation remains separate evidence with its own fixtures.

## Availability and points [M]

Each class has one automatic primary and five other skills competing for four slots. All four slots exist from character creation; availability and automatic filling are separate. Per class, skills unlock at 1/2/4/6/9/12. Each skill's three runes unlock at its level +2/+5/+9, ending at level21. These are character levels, not minutes.

Tiers cost 2, then4, then6 points: cumulative2/6/12. Assuming no other spending, their earliest affordable levels are `max(skill unlock,3/7/13)`; the harness confirms this through actual purchase calls. Points earned from leveling to70 total69. Buying all tiers of all six skills costs72, so **ordinary level points cannot master everything**. The deterministic audit buys in unlock order:66 spent,3 left, then reset returns69. A second reset adds nothing. This order is a fixture, not a recommended build.

Server reset refunds purchased tiers with no gold cost and keeps runes/slot assignments. The Skills panel uses an explicit second click to confirm. Skill/rune changes are not NPC-bound. Current checks reject wrong-class and locked choices; slots swap existing assignments. Existing points/refunds and selection freedom remain unchanged.

## What tiers actually declare [M]

| Modifier field | Tiers containing it | Examples / consumer scope |
|---|---:|---|
| Damage bucket | 17 | Additive with rune and skill-specific bonuses; not a final DPS multiplier |
| Resource cost | 8 | Applies before global cost reduction; two buffs become free |
| Radius | 7 | Skill-specific use: areas, cone angle/length, or acquisition; not always a circle |
| Cooldown | 5 | Combined skill modifiers then global CDR, with server floors |
| Duration | 5 | Buff/summon/ground context determines resulting damage or uptime |
| Explicit behavior flag | 4 | Cleave stacking speed, Rend spread, stronger Battle Rage and Magic Weapon buffs |
| Resource generation | 3 | Cleave/arrow cast or hit behavior; Magic Missile restores on hit |
| Maximum summons | 3 | Additional Sentry, Companion, Hydra |
| Projectile count | 3 | Extra arrow, volley arrows or missile |

Counts overlap: the Sentry's final tier affects both duration and summon capacity. A number-changing modifier can still change tactics; this table does not classify enjoyment or depth by counting flags.

Examples from code/runtime: Star Pact's +50% cost and Meteor tier3's −25% cost add before multiplication: base40 becomes50 before equipment reduction. Magic Missile Split's −40% and tier1's +20% damage add to80% of the base coefficient per missile, rather than multiplying two independent factors. These are current combination rules, not externally validated balance choices.

## Description and behavior follow-ups

Source tracing finds several distinctions requiring focused tests before a broad tooltip rewrite:

- Frost Hydra's text says frost cones; `summons.ts` currently emits a cold `fireball` projectile rendered as a shard, with zero splash and a chill bit. `projectiles.ts` applies the chill on collision. This is a concrete source mismatch; exact live footprint should be probed before choosing between correcting copy and changing the attack.
- Skill detail calculations include runes/tiers but omit equipment/set extras and global CDR/RCR. They cannot be presented as a complete effective-build calculator. Whether to add another clearly labeled value requires a small design and inspected UI candidate.
- Buff descriptions retain base10% text while their behavior flags can raise the actual buff. Rune/tier cards separately describe the change, but the consolidated summary can mislead. Preserve behavior and investigate a shared summary model.
- Geometry fields are overloaded: Seismic Slam's radius modifier changes both angle and capped length; Sentry/Hydra use targeting fields; zero-coefficient buffs still alter subsequent damage. Do not rank builds from the generic helper output alone.

These are recorded findings, not silent removals or completed fixes. No new class/tree or delayed unlock is justified merely because all runes are available by21.

## Reference interpretation / next work

D3's 2.6.1 preview reports replacing projectile-heavy behavior for performance reasons and clarifying a range synergy (D3-08). Its Armory preview scopes which build components are restored (D3-09). PoE2's 0.4.0 notes add compatibility information before choosing supports (POE2-02). Torchlight II's historical rank milestones and TBH's historical investment/rune distinction remain separately versioned. None supplies a target tier count, coefficient or respec price for Hearthfall.

Next: focused behavioral probes for the distinctions above; first actual gear/rune/tier decisions in the local browser; equivalent versioned external flows; usage and human observations. P4 build lock, target pacing and G1 remain incomplete. Rollback is documentation/harness-only; retain historical measurements if future rules change.
