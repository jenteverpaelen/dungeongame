# Documented cautions and the rule they support

C063, 2026-10-09. Reported defects are versioned evidence of a failure class, not proof that the reference game or Hearthfall still has that bug. A research guard below is adopted now; a future implementation obligation is not falsely marked shipped. Claim IDs link through [CLAIMS.csv](CLAIMS.csv) and [SOURCES.csv](SOURCES.csv).

| Case | Evidence and limit | Rule / status here |
|---|---|---|
| Item protection lost on consumption/restart | TBH-03:1.2.7/1.2.8 reported Synthesis/restart corrections; TBH-08:1.2.6 equipment could lose lock or icon. June footage predates fixes | Future lock must persist through all consumers, movement, equip and reload. Existing C053 bulk-salvage guard is implemented; general item lock remains open |
| Correct-looking text, wrong applied effect | TBH-06 separates displayed caps, healing/damage bugs and server-wait feedback; POE2-02 reports visual/effect and partial-cost discrepancies | Assert text and actual effect separately. C025 corrected measured local descriptions; it does not certify all future effects |
| Preview reward differs from operation | TBH-07 distinguishes expected-gain display errors from eligibility/lock defects | Check preview and committed conservation separately; a later receipt is not a persistence test. Future durable operations remain open |
| Objective completed without its intended action | POE2-04:0.5.5 reports interaction/boss-completion repairs | Credit authoritative qualified actions, not nearby entities or generic presentation events. C040/C041 map current boundaries; no live quest engine yet |
| Timer promises a duration it does not deliver | IDLE-06 reports a timed kill task sometimes received less than its promised interval; rolling feed year/build limited | Future timers need a defined start, server deadline and reconnect semantics. No new time limit is selected |
| Reward encourages hoarding instead of ordinary play | IDLE-05 records developer rationale for removing a combo stockpiling incentive; not a controlled outcome study | Before adding streak/reward multipliers, test behavior at save, reset and claim boundaries. No copied multiplier or retention claim |
| Per-reward waiting becomes unwanted friction | TBH-04:1.2.4 removes mandatory chest waits but retains a period quantity limit | Do not infer that every cooldown is bad or import a replacement timer. New pacing gates need their own purpose and evidence |
| A build creates a rendering cost | D3-08:2.6.1 developer explanation for a projectile-heavy rune redesign | Profile worst-case supported builds, not just idle scenes. Does not prove a performance fix on this laptop |
| Authoritative-looking documentation is stale | POE-02/05 contradict older no-gold/socket-colour rules; POE2-01 supersedes the2024 uniqueness text | Keep version and subsystem beside every rule; do not merge footage with later rules. Adopted in the registers and digests |
| A new character is mistaken for a new account | D3-28/31 show inherited Paragon, resource assistance and difficulty changes | Video offset is not ordinary progression time. All current recording timing-eligibility flags remain false |
| Sources disagree on an unlock | IDLE-02/13:guides report10; footage shows Warrior8, neither current rule established | Preserve contradiction and mark unresolved; do not average values or replace10 with8 |
| Study result is generalized beyond its sample | TL2-12 developer loot study explicitly provisional and condition-sensitive | Keep kill source, class, difficulty, capacity and acquisition conditions with measurements. C027 finite-bag results are not population income targets |
| Restore omits part of ownership | TL2-05 separates character and shared-stash files; it does not describe MMO-safe storage | Restore checks must cover the whole selected ownership scope. Local C038/C048/C054 are bounded experiments, not a release recovery certification |

These rules explain scope and future consequences without removing working content. They are also acceptance questions for future work, not a claim that every listed system should be added. No external numerical target is adopted.

## Wider incident cases — C066

| Case | Evidence and limit | Rule / status here |
|---|---|---|
| Correction applies the wrong ownership scope | DSO-01:developer acknowledges account/character aggregation error | Future repair must use the original rule’s scope and support review; no sanctions selected |
| Partial delivery and staged repair | DSO-02:documented package incident | Reconcile delivery against durable operation records; no payment subsystem proposed |
| Bundle/conversion friction | IMM-02/03:publisher revision and attributed consumer criticism | Keep no-payment scope; do not hide an operation’s effective cost behind unexplained conversions |
| Fixed-group participation friction | IMM-04:historical membership requirement revised | Evaluate mixed membership/availability before social gating; no group size copied |
| Service lifetime and chronology | CASE-03/04:shutdown announcement with conflicting page/body dates | Plan export/recovery; do not infer actual shutdown or its causes from metadata alone |

Developer incident reports do not quantify prevalence or retention. Consumer criticism is not a court ruling. No policy for penalties,compensation,paid currency or hosting lifetime is adopted from these cases.

## Ownership transitions — C067

| Case | Evidence and limit | Rule / status here |
|---|---|---|
| Character transfer leaves shared storage behind | D2R-04:versioned publisher recovery instructions | Future migrations must inventory every selected container and preserve recovery; no live migration selected |
| Temporary withdrawal storage expires | D2R-05:historical seasonal policy | Do not silently introduce item deletion; Hearthfall has no selected season/reset rule |
| Similar labels conceal different owners | WOW-01–03:documented scope distinctions | State actor,account and binding scope explicitly; current character stash remains |

These are documented rules and scope hazards, not measured defect prevalence or proof that the same failures occur here.
