// Paper parity + diversity model v2 for docs/rework/depth/BUDGET.md (PROPOSAL, not game code; imports nothing from the game).
// Run: node docs/rework/depth/budget-model.mjs [--class warrior|ranger|mage] [--json]
// Env: SIX / CSIX (6-piece multipliers), MS (scale of legendary skillMore), GS (scale of generic-bucket items), R (restarts).
//
// Damage buckets mirror server/src/sim/damage.ts baseMult():
//   coef × (1+main) × (1+skillPct) × (1+ele) × (1+generic) × own(mult) × vulnerability × crit
// Per kit and skill i:  F_i = (100+S_i)/(100+S0) × (100+G)/(100+G0) × (100+E_i)/(100+E0) × Πmore_i × Πvuln × Πbeh_i
// A fixture = one MAIN skill + one SUPPORT skill (searched) + the class primary; shares 0.6 / 0.2 / 0.2
// (a primary as main: 0.8 / 0.2). Fixtures are internal test cases, never shipped builds.
// For every main skill the search tries: no set; each set at 6; each set at 4 with 2 slots free (all assignments);
// 4+2 and 2+2+2 mixes; and with the set-reduction ring: 5 pieces for the 6-piece bonus, 3+3 for two 4-piece bonuses.
// Items fill the free slots by local search (coordinate ascent, R random restarts); equipped legendaries roll the
// middle of their range, Cube powers the maximum (shared/src/stats.ts). Cross-skill comparison assumes equal base DPS
// per main skill in a rare kit (the coefficient-tuning target), so the numbers measure how evenly ITEMS lift skills.

const args = process.argv.slice(2);
const ONLY = args.includes('--class') ? args[args.indexOf('--class') + 1] : null;
const JSON_OUT = args.includes('--json');
const S0 = 100, G0 = 25, E0 = 15;
const SIX = +(process.env.SIX ?? 1.25), CSIX = +(process.env.CSIX ?? 0.35), MS = +(process.env.MS ?? 1), GS = +(process.env.GS ?? 1);
const RESTARTS = +(process.env.R ?? 24);
const SLOTS = ['mainhand','offhand','head','shoulders','chest','hands','wrists','waist','legs','feet','neck','ring1','ring2'];
const FP_STD = ['head','shoulders','chest','hands','legs','feet'];
const FP_ALT = ['head','shoulders','chest','hands','waist','wrists'];
const mid = (r) => (r[0] + r[1]) / 2;

// ── Skills and tags (see ITEMS-SHARED.md §1) ──
const SK = {
 warrior: {
  cleave:['Primary','Strike','Area','Physical'], tolling_blow:['Primary','Strike','Stun','Physical'],
  whirlwind:['Channel','Spender','Strike','Area','Physical'], ironplough:['Channel','Spender','Strike','Area','Displace','Physical'],
  rend:['Spender','Area','Bleed','Physical'], sawtooth_hatchet:['Spender','Projectile','Piercing','Bleed','Physical'],
  ground_stomp:['Cooldown','Area','Stun','Physical'], seismic_slam:['Spender','Area','Displace','Physical'],
  cairnfall:['Cooldown','Aerial','Area','Stun','Physical'],
 },
 ranger: {
  hungering_arrow:['Primary','Projectile','Piercing','Physical'], skipstone_bolt:['Primary','Projectile','Piercing','Physical'],
  multishot:['Spender','Projectile','Piercing','Physical'], cluster_arrow:['Spender','Projectile','Area','Fire'],
  overcast_volley:['Spender','Aerial','Area','Physical'], rain_of_vengeance:['Cooldown','Aerial','Area','Ground','Physical'],
  sentry:['Summon','Device','Cooldown','Projectile','Physical'], spring_snare:['Summon','Device','Trap','Area','Stun','Physical'],
  pitch_mortar:['Summon','Device','Area','Ground','Burn','Fire'], companion:['Summon','Beast','Physical'],
  murmuration:['Cooldown','Summon','Beast','Area','Physical'],
 },
 mage: {
  magic_missile:['Primary','Projectile','Arcane'], rime_needles:['Primary','Projectile','Chill','Cold'],
  meteor:['Spender','Aerial','Area','Ground','Burn','Fire'], stormglass_orb:['Spender','Projectile','Area','Lightning'],
  thrumming_ray:['Channel','Spender','Piercing','Arcane'], black_hole:['Cooldown','Area','Ground','Displace','Arcane'],
  frost_nova:['Cooldown','Area','Chill','Cold'], rimefield:['Cooldown','Area','Ground','Chill','Cold'],
  hydra:['Summon','Projectile','Fire'], cinderkin:['Summon','Area','Burn','Fire'], orrery:['Cooldown','Summon','Area','Arcane'],
 },
};
const PRIMARY = { warrior: 'cleave', ranger: 'hungering_arrow', mage: 'magic_missile' };
const BUFF_UP = { warrior: 0.95, ranger: 0, mage: 0.95 }; // Battle Rage / Magic Weapon assumed slotted; ranger has no pure buff
const MARK_UP = { warrior: 0.2, ranger: 0.5, mage: 0 };   // Grudge Holder passive / Quarry Mark assumed slotted

// ── Items. s: '*' | 'skill_id' | {any:[tags]} | {all:[tags]};  b: add|gen|ele|more|vuln|beh ──
// v: number or (roll, U) => number, U = condition uptimes of the fixture.
const P = {};
const def = (id, cls, named, slot, cube, roll, fx, extra = {}) => { P[id] = { id, cls, named, slot, cube, roll, fx, ...extra }; };
const pct = (k = 1) => (r) => r * k;
const more = (key) => (r, U) => 1 + (r / 100) * (key ? U[key] : 1);
const moreK = (k) => (r) => 1 + (r / 100) * k;
const T = (...t) => ({ any: t });
const TA = (...t) => ({ all: t });

// Existing shared items (unchanged)
def('ouroboros_loop',null,false,'ring','jewelry',[60,80],[{s:'*',b:'beh',v:(r)=>1+r/100*0.2}]);
def('witching_cord',null,false,'waist','armor',[45,50],[{s:'*',b:'beh',v:(r)=>(1+0.5*(3+r/100))/(1+0.5*3)}]);
def('mountain_fists',null,false,'hands','armor',[40,50],[{s:'*',b:'beh',v:(r)=>1+0.2*(r/100)*1.45}]);
def('hellforge_talisman',null,false,'neck','jewelry',[30,40],[{s:'*',b:'gen',v:pct(0.4)}]);
def('patient_thief',null,false,'ring','jewelry',[0.75,1],[{s:T('Cooldown'),b:'beh',v:(r)=>1+r*0.25}]);
// New shared items (v2: keyed on tags or mechanics)
def('patchwork_signet',null,false,'ring','jewelry',[2,3],[],{noSet:true});
def('journeymans_ring',null,false,'ring','jewelry',[1,1],[],{setReduce:true});
def('watchkeepers_hood',null,false,'head','armor',[20,30],[{s:T('Projectile','Aerial'),b:'more',v:(r,U)=>1+r/100*U.ranged}]);
def('kilnwatch_spaulders',null,false,'shoulders','armor',[15,20],[{s:'*',b:'gen',v:(r,U)=>r*U.cooldown}]);
def('hearthguard_coat',null,false,'chest','armor',[20,30],[{s:'*',b:'gen',v:(r,U)=>r*Math.max(U.channel,U.ground)}]);
def('ink_stained_gloves',null,false,'hands','armor',[50,75],[{s:T('Primary'),b:'add',v:pct()},{s:T('Primary'),b:'beh',v:1.15}]);
def('causeway_waders',null,false,'legs','armor',[25,35],[{s:T('Summon','Ground'),b:'more',v:(r,U)=>1+r/100*U.still}]);
def('ridgewalker_boots',null,false,'feet','armor',[4,6],[{s:T('Spender'),b:'more',v:(r)=>1+5*r/100*0.6}]);
def('surveyors_plumb',null,false,'neck','jewelry',[20,30],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*U.mark}]);
def('signal_horn_charm',null,false,'neck','jewelry',[15,25],[{s:T('Summon'),b:'more',v:moreK(1)}]);
def('brine_tally',null,false,'ring','jewelry',[15,20],[{s:'*',b:'beh',v:(r,U)=>1+r/100*0.6*U.dot}]);
def('lockglass_cincture',null,false,'waist','armor',[20,30],[{s:T('Channel'),b:'beh',v:(r)=>1+r/100*0.4}]);
def('wardkeepers_cuffs',null,false,'wrists','armor',[12,18],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*Math.max(U.stun,U.chill,U.displace)}]);

// ── Warrior: 12 named signatures (incl. existing), 22 tag/mechanic items ──
def('faultcleaver','warrior',true,'mainhand','weapon',[150,200],[{s:'seismic_slam',b:'add',v:pct()},{s:'seismic_slam',b:'beh',v:1.15}],{twoHanded:true});
def('ninefold_gale','warrior',true,'mainhand','weapon',[150,200],[{s:'whirlwind',b:'add',v:pct()},{s:'whirlwind',b:'beh',v:1.15}],{twoHanded:true});
def('bloodwake','warrior',true,'mainhand','weapon',[150,200],[{s:'rend',b:'add',v:pct()}]);
def('eternal_gyre','warrior',true,'waist','armor',[40,50],[{s:'whirlwind',b:'beh',v:(r)=>1+r/100*0.4}]);
def('anvil_vambraces','warrior',false,'wrists','armor',[25,30],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*U.stun}]);
def('last_light','warrior',true,'offhand','armor',[200,250],[{s:'ground_stomp',b:'add',v:pct()},{s:'ground_stomp',b:'beh',v:1.1}]);
def('millwheel_edge','warrior',true,'mainhand','weapon',[150,200],[{s:'cleave',b:'add',v:pct()},{s:'cleave',b:'beh',v:1.3}]);
def('bellwrights_maul','warrior',true,'mainhand','weapon',[150,200],[{s:'tolling_blow',b:'add',v:pct()},{s:'tolling_blow',b:'beh',v:1.2}]);
def('grinning_saw','warrior',true,'mainhand','weapon',[150,200],[{s:'sawtooth_hatchet',b:'add',v:pct()},{s:'sawtooth_hatchet',b:'beh',v:1.3}]);
def('quartermasters_cuirass','warrior',true,'chest','armor',[20,30],[{s:T('Primary'),b:'more',v:moreK(0.85)}]);
def('coulter_blade','warrior',true,'mainhand','weapon',[150,200],[{s:'ironplough',b:'add',v:pct()},{s:'ironplough',b:'beh',v:1.15}],{twoHanded:true});
def('cairnwrights_hammer','warrior',true,'mainhand','weapon',[150,200],[{s:'cairnfall',b:'add',v:pct()},{s:'cairnfall',b:'beh',v:1.6}]);
def('kilnmaw','warrior',true,'mainhand','weapon',[150,200],[{s:T('Burn'),b:'add',v:pct()}],{twoHanded:true});
def('ashgrip_gauntlets','warrior',false,'hands','armor',[25,40],[{s:T('Primary'),b:'more',v:more('bleed')},{s:T('Bleed'),b:'beh',v:1.05}]);
def('threshers_knot','warrior',false,'ring','jewelry',[0.05,0.1],[{s:TA('Stun','Cooldown'),b:'beh',v:(r)=>1+r*3*1.4}]);
def('gale_stitched_legguards','warrior',false,'legs','armor',[6,8],[{s:T('Channel'),b:'more',v:(r)=>1+5*r/100*0.8}]);
def('tanners_pauldrons','warrior',false,'shoulders','armor',[15,25],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*U.bleed}]);
def('red_ledger','warrior',false,'neck','jewelry',[3,5],[{s:T('Bleed'),b:'beh',v:(r,U)=>1+0.15*Math.min(1,U.bleed*1.2)}]);
def('quakestep_sabatons','warrior',false,'feet','armor',[60,80],[]); // after a Movement skill: invisible to a non-dashing harness bot
def('fissure_lined_breastplate','warrior',false,'chest','armor',[30,45],[{s:T('Spender'),b:'more',v:more('stun')}]);
def('tremor_signet','warrior',false,'ring','jewelry',[0.2,0.3],[{s:T('Cooldown'),b:'beh',v:(r,U)=>1+0.3*U.displace}]);
def('brass_warhorn_helm','warrior',false,'head','armor',[8,12],[{s:T('Primary','Strike'),b:'beh',v:(r,U)=>1+r/100*U.buff}]);
def('furycord_belt','warrior',false,'waist','armor',[60,90],[{s:T('Spender'),b:'add',v:(r,U)=>r*U.buff}]);
def('seething_sigil','warrior',false,'neck','jewelry',[10,15],[{s:'*',b:'gen',v:(r,U)=>r*0.6*U.buff}]);
def('belfry_pauldrons','warrior',false,'shoulders','armor',[30,40],[{s:T('Stun'),b:'beh',v:(r)=>1+r/100*0.35}]);
def('woodcutters_grips','warrior',false,'hands','armor',[25,35],[{s:T('Bleed'),b:'more',v:more('bleed')},{s:T('Bleed'),b:'beh',v:1.08}]);
def('sawyers_ring','warrior',false,'ring','jewelry',[60,80],[{s:T('Bleed'),b:'beh',v:(r,U)=>1+r/100*0.25*U.bleed}]);
def('ward_pennant_shield','warrior',false,'offhand','armor',[15,20],[{s:'*',b:'gen',v:(r,U)=>r*Math.max(U.ground,0.3*U.buff)}]);
def('rally_knot','warrior',false,'ring','jewelry',[20,30],[{s:T('Spender'),b:'beh',v:(r,U)=>1+0.06*U.buff},{s:T('Cooldown'),b:'beh',v:(r,U)=>1+0.08*U.buff}]);
def('yoke_greaves','warrior',false,'legs','armor',[25,35],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*U.displace}]);
def('ox_harness_belt','warrior',false,'waist','armor',[15,20],[]);
def('stonecount_gauntlets','warrior',false,'hands','armor',[15,25],[{s:'*',b:'gen',v:(r,U)=>r*U.stun}]);
def('slagforged_helm','warrior',false,'head','armor',[20,30],[{s:'*',b:'gen',v:(r,U)=>r*0.25*U.buff}]);
def('coalheart_locket','warrior',false,'neck','jewelry',[30,40],[{s:T('Burn'),b:'more',v:(r,U)=>1+r/100*U.buff}]);

// ── Ranger ──
def('rainspindle','ranger',true,'mainhand','weapon',[30,40],[{s:'rain_of_vengeance',b:'beh',v:(r)=>1.1/(1-r/100*0.8)}],{twoHanded:true});
def('sappers_pack','ranger',true,'offhand','armor',[30,40],[{s:'sentry',b:'add',v:pct()},{s:'sentry',b:'beh',v:1.4}]);
def('gearwright_heart','ranger',true,'chest','armor',[30,40],[{s:'sentry',b:'beh',v:1.3}]);
def('thunderhead','ranger',true,'mainhand','weapon',[150,200],[{s:'multishot',b:'add',v:pct()}],{twoHanded:true});
def('hunters_mark','ranger',true,'mainhand','weapon',[15,20],[{s:'*',b:'vuln',v:moreK(0.6)}]);
def('powderkeg_crossbow','ranger',true,'mainhand','weapon',[150,200],[{s:'cluster_arrow',b:'add',v:pct()},{s:'cluster_arrow',b:'beh',v:1.35}],{twoHanded:true});
def('kennelwood_bow','ranger',true,'mainhand','weapon',[150,200],[{s:'companion',b:'add',v:pct()},{s:'companion',b:'beh',v:1.5}],{twoHanded:true});
def('riverstone_repeater','ranger',true,'mainhand','weapon',[100,150],[{s:'skipstone_bolt',b:'add',v:pct()},{s:'skipstone_bolt',b:'beh',v:1.25}]);
def('tripline_crossbow','ranger',true,'mainhand','weapon',[150,200],[{s:'spring_snare',b:'add',v:pct()},{s:'spring_snare',b:'beh',v:1.4}],{twoHanded:true});
def('highcloud_longbow','ranger',true,'mainhand','weapon',[150,200],[{s:'overcast_volley',b:'add',v:pct()},{s:'overcast_volley',b:'beh',v:1.5}],{twoHanded:true});
def('mortarmans_pack','ranger',true,'offhand','armor',[30,40],[{s:'pitch_mortar',b:'add',v:pct()},{s:'pitch_mortar',b:'beh',v:1.5}]);
def('starling_longbow','ranger',true,'mainhand','weapon',[150,200],[{s:'murmuration',b:'add',v:pct()},{s:'murmuration',b:'beh',v:1.4}],{twoHanded:true});
def('featherguard_cuffs','ranger',false,'wrists','armor',[20,30],[{s:T('Piercing'),b:'more',v:(r)=>Math.pow(1+r/100,0.8)}]);
def('hawkfeather_cap','ranger',false,'head','armor',[50,75],[{s:T('Primary'),b:'add',v:pct()},{s:T('Primary'),b:'beh',v:1.2}]);
def('boltthrowers_arbalest','ranger',false,'mainhand','weapon',[100,150],[{s:T('Device'),b:'add',v:pct()},{s:T('Device'),b:'beh',v:1.1}],{twoHanded:true});
def('bowyers_gloves','ranger',false,'hands','armor',[25,35],[{s:T('Projectile'),b:'more',v:moreK(0.7)}]);
def('bandolier_belt','ranger',false,'waist','armor',[60,90],[{s:TA('Spender','Projectile'),b:'add',v:pct()},{s:TA('Spender','Projectile'),b:'beh',v:1.05}]);
def('fuseburnt_boots','ranger',false,'feet','armor',[25,35],[{s:TA('Projectile','Area'),b:'more',v:moreK(1)}]);
def('powder_horn','ranger',false,'neck','jewelry',[20,30],[{s:TA('Projectile','Area'),b:'beh',v:(r)=>1+r/100*0.5}]);
def('squallcatcher_pauldrons','ranger',false,'shoulders','armor',[25,40],[{s:T('Aerial'),b:'more',v:moreK(0.7)},{s:T('Aerial'),b:'beh',v:1.05}]);
def('raincount_ring','ranger',false,'ring','jewelry',[60,90],[{s:T('Ground'),b:'add',v:pct()}]);
def('trailhide_breeches','ranger',false,'legs','armor',[25,40],[{s:T('Beast'),b:'more',v:more('mark')},{s:T('Beast'),b:'beh',v:1.3}]);
def('whistle_charm','ranger',false,'neck','jewelry',[20,30],[{s:T('Beast'),b:'beh',v:(r)=>1+r/100}]);
def('skimmers_leggings','ranger',false,'legs','armor',[15,25],[{s:T('Projectile'),b:'more',v:(r,U)=>1+r/100*U.pierce}]);
def('skipping_stone_quiver','ranger',false,'offhand','armor',[40,60],[{s:T('Piercing'),b:'beh',v:(r)=>1+r/100*0.4}]);
def('snarehand_gloves','ranger',false,'hands','armor',[25,40],[{s:T('Trap','Device'),b:'more',v:more('stun')}]);
def('coiled_wire_bracers','ranger',false,'wrists','armor',[30,50],[{s:T('Trap'),b:'beh',v:(r)=>1+r/100*0.6},{s:T('Device'),b:'beh',v:1.04}]);
def('overcast_hood','ranger',false,'head','armor',[25,35],[{s:T('Aerial'),b:'more',v:moreK(0.8)}]);
def('weathervane_ring','ranger',false,'ring','jewelry',[60,90],[{s:T('Aerial'),b:'add',v:pct()}]);
def('spotters_repeater','ranger',false,'mainhand','weapon',[10,15],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*U.mark*1.3}]);
def('huntsmans_pauldrons','ranger',false,'shoulders','armor',[30,40],[{s:T('Summon'),b:'more',v:(r,U)=>1+r/100*0.5*Math.min(1,U.mark*2)}]);
def('tarstained_jerkin','ranger',false,'chest','armor',[25,35],[{s:T('Device'),b:'more',v:(r,U)=>1+r/100*Math.max(0.4*U.groundSkill,0.2)}]);
def('fuse_cord_belt','ranger',false,'waist','armor',[25,35],[{s:T('Device'),b:'beh',v:(r)=>1+r/100*0.6}]);
def('wingbeat_boots','ranger',false,'feet','armor',[25,40],[{s:T('Beast'),b:'more',v:moreK(0.6)}]);
def('roost_charm','ranger',false,'neck','jewelry',[3,5],[{s:T('Cooldown'),b:'beh',v:(r,U)=>1+r*0.05*U.summon}]);

// ── Mage ──
def('lanternroot','mage',true,'mainhand','weapon',[150,200],[{s:'hydra',b:'add',v:pct()},{s:'hydra',b:'beh',v:1.5}],{twoHanded:true});
def('cindervane','mage',true,'mainhand','weapon',[150,200],[{s:'meteor',b:'add',v:pct()},{s:'meteor',b:'beh',v:1.12}],{twoHanded:true});
def('void_heart','mage',true,'offhand','armor',[20,25],[{s:'*',b:'vuln',v:(r,U)=>1+r/100*0.35*U.groundSkill},{s:'black_hole',b:'beh',v:1.1}]);
def('starfall_mantle','mage',true,'shoulders','armor',[30,40],[{s:'meteor',b:'beh',v:(r)=>1+r/100*0.8}]);
def('thousand_missiles','mage',true,'mainhand','weapon',[100,150],[{s:'magic_missile',b:'add',v:pct()},{s:'magic_missile',b:'beh',v:1.7}]);
def('undertow_staff','mage',true,'mainhand','weapon',[150,200],[{s:'black_hole',b:'add',v:pct()},{s:'black_hole',b:'beh',v:1.1}],{twoHanded:true});
def('frostlocked_wand','mage',true,'mainhand','weapon',[150,200],[{s:'frost_nova',b:'add',v:pct()},{s:'frost_nova',b:'beh',v:1.6}]);
def('hoarneedle_wand','mage',true,'mainhand','weapon',[100,150],[{s:'rime_needles',b:'add',v:pct()},{s:'rime_needles',b:'beh',v:1.5}]);
def('resonant_staff','mage',true,'mainhand','weapon',[150,200],[{s:'thrumming_ray',b:'add',v:pct()},{s:'thrumming_ray',b:'beh',v:1.15}],{twoHanded:true});
def('kindling_rod','mage',true,'mainhand','weapon',[150,200],[{s:'cinderkin',b:'add',v:pct()},{s:'cinderkin',b:'beh',v:1.6}]);
def('cistern_staff','mage',true,'mainhand','weapon',[150,200],[{s:'rimefield',b:'add',v:pct()},{s:'rimefield',b:'beh',v:1.2}],{twoHanded:true});
def('stormglass_prism','mage',true,'offhand','armor',[150,200],[{s:'stormglass_orb',b:'add',v:pct()},{s:'stormglass_orb',b:'beh',v:1.3}]);
def('armillary_staff','mage',true,'mainhand','weapon',[150,200],[{s:'orrery',b:'add',v:pct()},{s:'orrery',b:'beh',v:1.4}],{twoHanded:true});
def('runeweaver_cuffs','mage',true,'wrists','armor',[10,15],[{s:T('Primary'),b:'beh',v:(r)=>1+r/100}]);
def('glasswrights_wraps','mage',false,'hands','armor',[25,40],[{s:T('Projectile'),b:'more',v:moreK(0.5)},{s:T('Projectile'),b:'beh',v:1.12}]);
def('echoing_bead','mage',false,'ring','jewelry',[20,30],[{s:T('Primary'),b:'beh',v:(r)=>1+r/100}]);
def('craterheart_amulet','mage',false,'neck','jewelry',[60,90],[{s:T('Aerial'),b:'add',v:pct()},{s:T('Aerial'),b:'beh',v:1.05}]);
def('horizon_cowl','mage',false,'head','armor',[40,60],[{s:T('Ground'),b:'add',v:pct()}]);
def('winterbound_robe','mage',false,'chest','armor',[25,40],[{s:T('Cold'),b:'more',v:more('chill')}]);
def('rimecourt_band','mage',false,'ring','jewelry',[2,3],[{s:TA('Chill','Cooldown'),b:'beh',v:(r)=>1+r*0.1}]);
def('coiled_pauldrons','mage',false,'shoulders','armor',[20,30],[{s:T('Summon'),b:'more',v:moreK(1)},{s:TA('Summon','Projectile'),b:'beh',v:1.15}]);
def('lanternkeepers_sash','mage',false,'waist','armor',[30,40],[{s:T('Summon'),b:'beh',v:(r)=>1+r/100*0.5}]);
def('glyphstone_orb','mage',false,'offhand','armor',[10,15],[{s:'*',b:'gen',v:(r,U)=>r*U.buff}]);
def('spellwrights_circlet','mage',false,'head','armor',[0.1,0.2],[{s:T('Cooldown'),b:'beh',v:(r,U)=>1+r*2*U.buff}]);
def('frostthread_gloves','mage',false,'hands','armor',[25,40],[{s:T('Primary'),b:'more',v:(r,U)=>1+r/100*U.chill*0.8}]);
def('snowglobe_pendant','mage',false,'neck','jewelry',[60,80],[{s:T('Chill'),b:'beh',v:(r,U)=>1+r/100*0.4*U.chill}]);
def('hornlistener_circlet','mage',false,'head','armor',[25,40],[{s:T('Piercing'),b:'more',v:moreK(0.6)}]);
def('signal_coil','mage',false,'ring','jewelry',[60,90],[{s:T('Channel'),b:'add',v:pct()},{s:T('Channel'),b:'beh',v:1.08}]);
def('firekeepers_gloves','mage',false,'hands','armor',[25,35],[{s:T('Burn'),b:'more',v:moreK(0.8)},{s:T('Summon'),b:'beh',v:1.08}]);
def('rimewalker_slippers','mage',false,'feet','armor',[25,35],[{s:T('Ground'),b:'more',v:moreK(0.5)}]); // the after-Movement copy is invisible to the bot
def('conductors_legwraps','mage',false,'legs','armor',[25,35],[{s:T('Lightning'),b:'more',v:moreK(1)},{s:T('Lightning'),b:'beh',v:1.15}]);
def('static_loop','mage',false,'ring','jewelry',[60,90],[{s:T('Spender'),b:'add',v:pct()},{s:T('Spender'),b:'beh',v:1.08}]);
def('starchart_robe','mage',false,'chest','armor',[25,40],[{s:T('Arcane'),b:'more',v:(r,U)=>1+r/100*U.still},{s:T('Summon'),b:'beh',v:(r,U)=>1+0.3*U.still}]);
def('clockmakers_ring','mage',false,'ring','jewelry',[15,20],[{s:T('Cooldown'),b:'beh',v:(r)=>1/(1-r/100)}]);

// ── Sets (tag-keyed building blocks) ──
const SETS = {
 warrior: {
  endless_storm:{fp:FP_STD,fx:{2:[{s:T('Channel'),b:'beh',v:1.2}],4:[{s:T('Channel'),b:'beh',v:1.4}],6:[{s:T('Channel'),b:'more',v:()=>SIX},{s:T('Channel'),b:'beh',v:1.08}]}},
  fault_warden:{fp:FP_STD,fx:{2:[{s:T('Stun'),b:'beh',v:1.2}],4:[{s:T('Spender'),b:'beh',v:(r,U)=>1+0.5*U.stun},{s:T('Stun'),b:'more',v:1.15}],6:[{s:'*',b:'more',v:(r,U)=>1+CSIX*U.stun},{s:'*',b:'beh',v:1.03}]}},
  cinder_oath:{fp:FP_STD,fx:{2:[{s:T('Bleed','Burn'),b:'beh',v:1.12}],4:[{s:T('Primary'),b:'more',v:(r,U)=>1+0.2*U.dot},{s:T('Bleed','Burn'),b:'beh',v:1.25}],6:[{s:T('Bleed','Burn'),b:'beh',v:1.05},{s:T('Bleed','Burn','Primary'),b:'more',v:()=>SIX}]}},
  hearthbanner:{fp:FP_STD,fx:{2:[{s:T('Primary'),b:'beh',v:(r,U)=>1+0.1*U.buff},{s:'*',b:'beh',v:(r,U)=>1+0.03*U.buff}],4:[{s:T('Primary'),b:'more',v:(r,U)=>1+0.25*0.85*U.buff}],6:[{s:T('Primary'),b:'beh',v:(r,U)=>1+0.1*U.buff},{s:T('Primary','Burn'),b:'more',v:(r,U)=>1+(SIX-1)*U.buff}]}},
  furrowmark:{fp:FP_ALT,fx:{2:[{s:T('Displace','Channel'),b:'beh',v:1.15}],4:[{s:T('Displace'),b:'more',v:(r,U)=>1+0.35*U.displace},{s:T('Displace'),b:'beh',v:1.1}],6:[{s:T('Displace'),b:'beh',v:1.05},{s:T('Displace'),b:'more',v:()=>SIX}]}},
 },
 ranger: {
  siegebreaker:{fp:FP_STD,fx:{2:[{s:T('Device'),b:'beh',v:1.2}],4:[{s:TA('Spender','Projectile'),b:'beh',v:(r,U)=>1+U.devices*0.2}],6:[{s:T('Device','Spender'),b:'more',v:(r,U)=>1+0.1*Math.min(4,U.devices)},{s:T('Device'),b:'beh',v:1.1}]}},
  farwatch:{fp:FP_STD,fx:{2:[{s:T('Piercing'),b:'beh',v:1.2}],4:[{s:TA('Spender','Projectile'),b:'beh',v:1.25},{s:T('Piercing'),b:'more',v:1.15}],6:[{s:T('Projectile'),b:'beh',v:1.12},{s:T('Projectile'),b:'more',v:()=>1+CSIX*0.8}]}},
  rainkeeper:{fp:FP_STD,fx:{2:[{s:T('Aerial'),b:'beh',v:1.1},{s:TA('Aerial','Cooldown'),b:'beh',v:1.25}],4:[{s:T('Spender'),b:'beh',v:(r,U)=>1+0.12*U.aerialSkill},{s:T('Aerial'),b:'more',v:1.15}],6:[{s:T('Aerial'),b:'beh',v:1.08},{s:T('Aerial'),b:'more',v:()=>1+CSIX*0.8}]}},
  thicket_kin:{fp:FP_STD,fx:{2:[{s:T('Beast'),b:'beh',v:1.05}],4:[{s:T('Beast'),b:'beh',v:1.35}],6:[{s:T('Beast'),b:'beh',v:1.2},{s:T('Beast'),b:'more',v:()=>SIX}]}},
  snarewright:{fp:FP_ALT,fx:{2:[{s:T('Trap'),b:'beh',v:1.25}],4:[{s:T('Device'),b:'beh',v:(r,U)=>1+0.15*U.stun},{s:T('Trap'),b:'more',v:1.15}],6:[{s:T('Trap'),b:'beh',v:1.15},{s:'*',b:'more',v:(r,U)=>1+CSIX*U.stun}]}},
 },
 mage: {
  fallen_star:{fp:FP_STD,fx:{2:[{s:T('Aerial'),b:'beh',v:1.45},{s:T('Spender'),b:'beh',v:1.05}],4:[{s:'*',b:'gen',v:20}],6:[{s:T('Spender'),b:'beh',v:1.08},{s:T('Aerial','Spender'),b:'more',v:()=>SIX}]}},
  glass_concord:{fp:FP_STD,fx:{2:[{s:T('Projectile'),b:'beh',v:1.15}],4:[{s:T('Projectile'),b:'beh',v:(r,U)=>1+0.8*0.3*U.groundSkill},{s:T('Projectile'),b:'more',v:1.1}],6:[{s:T('Projectile'),b:'beh',v:1.12},{s:T('Projectile'),b:'more',v:()=>SIX}]}},
  lantern_garden:{fp:FP_STD,fx:{2:[{s:T('Summon'),b:'beh',v:1.35}],4:[{s:T('Summon'),b:'beh',v:1.15}],6:[{s:T('Summon'),b:'beh',v:1.15},{s:T('Summon'),b:'more',v:()=>SIX}]}},
  hoarfrost_vigil:{fp:FP_STD,fx:{2:[{s:T('Chill','Ground'),b:'beh',v:1.2}],4:[{s:'*',b:'vuln',v:(r,U)=>1+0.2*U.chill*0.6}],6:[{s:'*',b:'more',v:(r,U)=>1+CSIX*U.chill},{s:T('Chill'),b:'beh',v:1.05}]}},
  hollowstar_choir:{fp:FP_ALT,fx:{2:[{s:T('Channel'),b:'beh',v:1.3}],4:[{s:'*',b:'gen',v:(r,U)=>15*U.buff},{s:T('Spender'),b:'beh',v:1.1},{s:T('Channel'),b:'more',v:1.15}],6:[{s:T('Channel'),b:'beh',v:1.12},{s:T('Channel','Arcane'),b:'more',v:()=>1+CSIX*0.85}]}},
 },
};

const OFFHAND_OK = { warrior: (mh) => !mh || !P[mh].twoHanded, ranger: () => true, mage: (mh) => !mh || !P[mh].twoHanded };

function uptimes(cls, fx) {
  const tags = (sk) => SK[cls][sk] ?? [];
  const has = (t) => Object.keys(fx).some((sk) => tags(sk).includes(t));
  const u = {
    stun: has('Stun') ? 0.6 : 0.1, bleed: has('Bleed') ? 0.9 : 0, chill: has('Chill') ? 0.8 : 0,
    groundSkill: has('Ground') ? 1 : 0, displace: has('Displace') ? 0.6 : 0, summon: has('Summon') ? 1 : 0,
    buff: BUFF_UP[cls], channel: has('Channel') ? 0.8 : 0, mark: MARK_UP[cls], aerialSkill: has('Aerial') ? 1 : 0,
    still: cls === 'warrior' ? 0.3 : 0.5, ranged: cls === 'warrior' ? 0.2 : 0.6, cooldown: has('Cooldown') ? 0.8 : 0.3,
    pierce: has('Piercing') ? 0.8 : 0, devices: Object.keys(fx).filter((sk) => tags(sk).includes('Device')).length ? 3.2 : 0,
  };
  u.dot = Math.max(u.bleed, has('Burn') ? 0.8 : 0);
  u.ground = u.groundSkill ? 0.5 : 0;
  return u;
}

function matches(cls, sel, sk) {
  if (sel === '*') return true;
  if (typeof sel === 'string') return sel === sk;
  const t = SK[cls][sk] ?? [];
  if (sel.any) return sel.any.some((x) => t.includes(x));
  return sel.all.every((x) => t.includes(x));
}

function evaluate(cls, fx, U, state, setCounts) {
  const skills = Object.keys(fx);
  const acc = Object.fromEntries(skills.map((k) => [k, { S: S0, E: E0, more: 1, beh: 1 }]));
  let G = G0, vuln = 1;
  const anySet = Object.values(setCounts).some((n) => n >= 2);
  const apply = (effects, roll, isItem) => {
    for (const e of effects) {
      let v = typeof e.v === 'function' ? e.v(roll, U) : e.v;
      if (isItem && e.b === 'more') v = 1 + (v - 1) * MS;
      if (isItem && e.b === 'gen') v *= GS;
      if (e.b === 'gen') { G += v; continue; }
      if (e.b === 'vuln') { vuln *= v; continue; }
      for (const k of skills) if (matches(cls, e.s, k)) {
        const a = acc[k];
        if (e.b === 'add') a.S += v; else if (e.b === 'ele') a.E += v; else if (e.b === 'more') a.more *= v; else a.beh *= v;
      }
    }
  };
  const equipped = SLOTS.filter((s) => state.slots[s]).length;
  const pos = [...SLOTS.map((s) => [state.slots[s], false]), ...['weapon','armor','jewelry'].map((c) => [state.cube[c], true])];
  for (const [id, cube] of pos) {
    if (!id) continue; const p = P[id];
    if (p.noSet) { if (!anySet) G += (cube ? p.roll[1] : mid(p.roll)) * GS * Math.min(10, equipped); continue; }
    apply(p.fx, cube ? p.roll[1] : mid(p.roll), true);
  }
  for (const [sid, n] of Object.entries(setCounts)) for (const k of [2,4,6]) if (n >= k) apply(SETS[cls][sid].fx[k], 0, false);
  let total = 0;
  for (const k of skills) { const a = acc[k];
    total += fx[k] * ((100 + a.S) / (100 + S0)) * ((100 + G) / (100 + G0)) * ((100 + a.E) / (100 + E0)) * a.more * vuln * a.beh; }
  return total;
}

function rngOf(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const slotOf = (p, slot) => p.slot === slot || (p.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'));

function optimise(cls, fx, U, blocked, setCounts, rng, opts = {}) {
  const pool = Object.values(P).filter((p) => (p.cls === null || p.cls === cls) && (!p.noSet || !opts.noSignet) && (!p.setReduce || opts.ring));
  const positions = [...SLOTS, 'cube:weapon', 'cube:armor', 'cube:jewelry'];
  const cands = {};
  for (const s of SLOTS) cands[s] = [null, ...pool.filter((p) => slotOf(p, s)).map((p) => p.id)];
  for (const c of ['weapon','armor','jewelry']) cands['cube:' + c] = [null, ...pool.filter((p) => p.cube === c && !p.noSet && !p.setReduce).map((p) => p.id)];
  const get = (st, q) => q.startsWith('cube:') ? st.cube[q.slice(5)] : st.slots[q];
  const put = (st, q, v) => { if (q.startsWith('cube:')) st.cube[q.slice(5)] = v; else st.slots[q] = v; };
  const valid = (st) => {
    const used = new Set();
    for (const q of positions) { const id = get(st, q); if (!id) continue; if (used.has(id)) return false; used.add(id); }
    for (const b of blocked) if (st.slots[b]) return false;
    if (st.slots.offhand && !OFFHAND_OK[cls](st.slots.mainhand)) return false;
    if (opts.ring && !SLOTS.some((s) => st.slots[s] === 'journeymans_ring')) return false;
    return true;
  };
  let best = null;
  for (let r = 0; r < RESTARTS; r++) {
    const st = { slots: Object.fromEntries(SLOTS.map((s) => [s, null])), cube: { weapon: null, armor: null, jewelry: null } };
    if (opts.ring) st.slots.ring1 = 'journeymans_ring';
    if (r > 0) for (const q of positions) { const c = cands[q]; const prev = get(st, q); put(st, q, c[Math.floor(rng() * c.length)]); if (!valid(st)) put(st, q, prev); }
    if (!valid(st)) continue;
    let cur = evaluate(cls, fx, U, st, setCounts), improved = true;
    while (improved) {
      improved = false;
      for (const q of positions) {
        const prev = get(st, q); let bv = prev, bt = cur;
        for (const v of cands[q]) { put(st, q, v); if (!valid(st)) continue; const t = evaluate(cls, fx, U, st, setCounts); if (t > bt + 1e-9) { bt = t; bv = v; } }
        put(st, q, bv); if (bv !== prev) { cur = bt; improved = true; }
      }
    }
    if (!best || cur > best.total + 1e-9) best = { total: cur, st: JSON.parse(JSON.stringify(st)) };
  }
  return best ?? { total: 0, st: null };
}

// All ways to place `counts` pieces of sets into their footprints; unique by the resulting blocked-slot set.
function placements(cls, counts) {
  const ids = Object.keys(counts); const out = new Map();
  const combos = (arr, k, start = 0, acc = []) => k === 0 ? [acc] : arr.slice(start).flatMap((x, j) => combos(arr, k - 1, start + j + 1, [...acc, x]));
  const rec = (i, used) => {
    if (i === ids.length) { const key = [...used].sort().join(','); if (!out.has(key)) out.set(key, [...used]); return; }
    const fp = SETS[cls][ids[i]].fp.filter((s) => !used.has(s));
    for (const c of combos(fp, counts[ids[i]])) rec(i + 1, new Set([...used, ...c]));
  };
  rec(0, new Set());
  return [...out.values()];
}

function configs(cls) {
  const ids = Object.keys(SETS[cls]); const list = [{ name: 'no set', counts: {}, ring: false }];
  for (const a of ids) {
    list.push({ name: `${a} 6`, counts: { [a]: 6 }, ring: false });
    list.push({ name: `${a} 4 + 2 free`, counts: { [a]: 4 }, ring: false, hybrid: true });
    list.push({ name: `${a} 5 + ring`, counts: { [a]: 5 }, eff: { [a]: 6 }, ring: true });
    list.push({ name: `${a} 3 + ring (4-piece) + 3 free`, counts: { [a]: 3 }, eff: { [a]: 4 }, ring: true, hybrid: true });
    for (const b of ids) if (b !== a) list.push({ name: `${a} 4 + ${b} 2`, counts: { [a]: 4, [b]: 2 }, ring: false });
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    list.push({ name: `${ids[i]} 3 + ${ids[j]} 3 + ring`, counts: { [ids[i]]: 3, [ids[j]]: 3 }, eff: { [ids[i]]: 4, [ids[j]]: 4 }, ring: true });
    for (let k = j + 1; k < ids.length; k++) list.push({ name: `${ids[i]} 2 + ${ids[j]} 2 + ${ids[k]} 2`, counts: { [ids[i]]: 2, [ids[j]]: 2, [ids[k]]: 2 }, ring: false });
  }
  return list;
}

function fixtureShares(cls, main, support) {
  const prim = PRIMARY[cls]; const isPrim = SK[cls][main].includes('Primary');
  if (isPrim) return { [main]: 0.8, [support]: 0.2 };
  const fx = { [main]: 0.6 }; fx[support] = (fx[support] ?? 0) + 0.2; fx[prim] = (fx[prim] ?? 0) + 0.2; return fx;
}

function runClass(cls) {
  const rng = rngOf(4242);
  const mains = Object.keys(SK[cls]);
  const rows = [];
  for (const main of mains) {
    let bestSup = null; // 1) support skill: best legendary-only kit over all candidates (cheap, documented)
    for (const sup of mains) {
      if (sup === main) continue;
      const fx = fixtureShares(cls, main, sup); const U = uptimes(cls, fx);
      const r = optimise(cls, fx, U, [], {}, rng);
      if (!bestSup || r.total > bestSup.total) bestSup = { sup, total: r.total };
    }
    const fx = fixtureShares(cls, main, bestSup.sup); const U = uptimes(cls, fx);
    const results = []; // 2) full configuration search
    for (const c of configs(cls)) {
      const eff = c.eff ?? c.counts; let best = null;
      for (const blocked of placements(cls, c.counts)) {
        const r = optimise(cls, fx, U, blocked, eff, rng, { ring: c.ring });
        if (!best || r.total > best.total) best = { ...r, blocked };
      }
      results.push({ cfg: c, ...best });
    }
    const noSig = optimise(cls, fx, U, [], {}, rng, { noSignet: true });
    results.sort((a, b) => b.total - a.total);
    const legOnly = Math.max(results.find((r) => r.cfg.name === 'no set').total, noSig.total);
    const set6 = results.filter((r) => Object.values(r.cfg.eff ?? r.cfg.counts).some((n) => n >= 6))[0];
    const hyb = results.filter((r) => r.cfg.hybrid)[0];
    rows.push({ main, support: bestSup.sup, best: results[0], legOnly, legNoSig: noSig.total, set6, hyb });
  }
  return rows;
}

const f2 = (x) => x.toFixed(2);
const items = (st) => st ? [...SLOTS.filter((s) => st.slots[s]).map((s) => st.slots[s]), ...['weapon','armor','jewelry'].filter((c) => st.cube[c]).map((c) => st.cube[c] + '*')] : [];
const classes = ONLY ? [ONLY] : ['warrior','ranger','mage'];
const all = {};
for (const cls of classes) {
  const rows = runClass(cls); all[cls] = rows;
  if (JSON_OUT) continue;
  const classBest = Math.max(...rows.map((r) => r.best.total));
  console.log(`\n### ${cls[0].toUpperCase() + cls.slice(1)}\n`);
  console.log('| Main skill (support) | Best kit | Best configuration | vs class best | Legendary-only | Best 6-piece kit | Leg / 6-piece | Best 4-piece hybrid | Hybrid check (±5%) |');
  console.log('|---|---:|---|---:|---:|---:|---:|---:|---|');
  for (const r of rows) {
    const s6 = r.set6.total, l = r.legOnly, h = r.hyb.total, lo = Math.min(s6, l), hi = Math.max(s6, l);
    const hc = h >= lo && h <= hi ? 'between' : h >= lo * 0.95 && h <= hi * 1.05 ? 'within 5%' : h > hi ? `above (${f2(h / hi)})` : `below (${f2(h / lo)})`;
    console.log(`| ${r.main} (${r.support}) | ×${f2(r.best.total)} | ${r.best.cfg.name} | ${f2(r.best.total / classBest)} | ×${f2(l)} | ×${f2(s6)} (${r.set6.cfg.name}) | ${f2(l / s6)} | ×${f2(h)} (${r.hyb.cfg.name}) | ${hc} |`);
  }
  const within = rows.filter((r) => r.best.total >= classBest / 1.25).length;
  const counts = {};
  for (const r of rows) for (const id of new Set([...items(r.best.st).map((x) => x.replace('*', '')), ...Object.keys(r.best.cfg.counts).map((s) => 'set:' + s)])) counts[id] = (counts[id] ?? 0) + 1;
  const dom = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log(`\nMain skills within 1.25× of the class best: **${within} / ${rows.length}**.`);
  console.log(`Most frequent pieces across the ${rows.length} top kits: ` + dom.slice(0, 10).map(([k, n]) => `${k} ${n}/${rows.length}`).join(', ') + '.');
  const always = dom.filter(([, n]) => n === rows.length).map(([k]) => k);
  console.log(`Dominance flag (in every top kit): ${always.length ? always.join(', ') : 'none'}.`);
  console.log(`Sets used in top kits: ${dom.filter(([k]) => k.startsWith('set:')).map(([k, n]) => `${k.slice(4)} ${n}`).join(', ') || 'none'}.`);
  console.log('\nTop kits (items, `*` = Cube):');
  for (const r of rows) console.log(`* ${r.main}: ${r.best.cfg.name} — ${items(r.best.st).join(', ')}`);
}
if (JSON_OUT) console.log(JSON.stringify(Object.fromEntries(Object.entries(all).map(([c, rows]) => [c, rows.map((r) => ({ main: r.main, support: r.support, best: r.best.total, cfg: r.best.cfg.name, legOnly: r.legOnly, set6: r.set6.total, hybrid: r.hyb.total, items: items(r.best.st) }))]))));
