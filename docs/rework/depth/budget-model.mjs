// Paper parity model for docs/rework/depth/BUDGET.md (PROPOSAL, not game code; imports nothing from the game).
// Run: node docs/rework/depth/budget-model.mjs   (env SIX / CSIX override the 6-piece multipliers for sweeps)
// Mirrors the bucket order of server/src/sim/damage.ts baseMult():
//   coef × (1+main) × (1+skillPct) × (1+ele) × (1+generic) × own(mult) × vulnerability × crit
// For each kit and each archetype skill i:
//   F_i = (100+S_i)/(100+S0) × (100+G)/(100+G0) × (100+E_i)/(100+E0) × Π more_i × Π vuln × Π beh_i
// Total = Σ share_i × F_i  (shares = damage split of the archetype in a plain rare kit).
// Equipped legendary = mid roll; Cube = max roll (shared/src/stats.ts: cube powers use range[1]).

const S0 = 100, G0 = 25, E0 = 15;
const SIX = +(process.env.SIX ?? 1.25);           // unconditional 6-piece own multiplier [P]
const CSIX = +(process.env.CSIX ?? 0.35);
const MS = +(process.env.MS ?? 1);                // sensitivity: scale of legendary skillMore magnitudes
const GS = +(process.env.GS ?? 1);                // sensitivity: scale of generic-bucket legendary magnitudes          // conditional 6-piece: x(1+CSIX) while the condition holds [P]
const SLOTS = ['mainhand','offhand','head','shoulders','chest','hands','wrists','waist','legs','feet','neck','ring1','ring2'];
const FP_STD = ['head','shoulders','chest','hands','legs','feet'];
const FP_ALT = ['head','shoulders','chest','hands','waist','wrists'];
const mid = (r) => (r[0] + r[1]) / 2;

// effect: {s: skill | '*' | [skills], b: 'add'|'gen'|'ele'|'more'|'vuln'|'beh', v: number | (roll)=>number}
// more/vuln/beh values are multipliers (1.25 = ×1.25); add/gen/ele are percentage points.
const P = {};
const def = (id, slot, cube, roll, effects, extra = {}) => { P[id] = { id, slot, cube, roll, effects, ...extra }; };
const pct = (k = 1) => (r) => r * k;               // add/gen in points
const moreU = (u = 1) => (r) => 1 + (r / 100) * u; // conditional multiplier with uptime u
const costBeh = (k) => (r) => 1 + (r / 100) * k;   // resource/speed → more casts

// ── Shared (existing + new) ──
def('ouroboros_loop','ring','jewelry',[150,200],[{s:'*',b:'beh',v:(r)=>1+r/100*0.2}]);
def('witching_cord','waist','armor',[45,50],[{s:'*',b:'beh',v:(r)=>(1+0.5*(3+r/100))/(1+0.5*3)}]);
def('mountain_fists','hands','armor',[40,50],[{s:'*',b:'beh',v:(r)=>1+0.2*(r/100)*1.45}]); // area: 20% × r% × ~1.45 other enemies averaged over the 3 audit encounters
def('hellforge_talisman','neck','jewelry',[30,40],[{s:'*',b:'gen',v:pct(0.4)}]);
def('patchwork_signet','ring','jewelry',[2,3],[],{noSet:true});
def('watchkeepers_hood','head','armor',[15,20],[{s:'*',b:'vuln',v:moreU(0.6)}]);
def('kilnwatch_spaulders','shoulders','armor',[15,20],[{s:'*',b:'gen',v:pct(0.5)}]);
def('hearthguard_coat','chest','armor',[15,20],[{s:'*',b:'gen',v:pct(0.7)}]);
def('causeway_waders','legs','armor',[20,25],[{s:'*',b:'gen',v:pct(0.5)}]);
def('ridgewalker_boots','feet','armor',[20,25],[{s:'*',b:'gen',v:pct(0.4)}]);
def('surveyors_plumb','neck','jewelry',[25,35],[{s:'*',b:'vuln',v:moreU(0.35)}]);
def('brine_tally','ring','jewelry',[15,20],[{s:'*',b:'beh',v:costBeh(0.5)}]);
def('lockglass_cincture','waist','armor',[20,30],[{s:['whirlwind','ironplough','thrumming_ray'],b:'beh',v:costBeh(0.4)}]);
def('wardkeepers_cuffs_cc','wrists','armor',[15,20],[{s:'*',b:'vuln',v:moreU(0.6)}]);
def('wardkeepers_cuffs_lo','wrists','armor',[15,20],[{s:'*',b:'vuln',v:moreU(0.2)}]);
def('ink_stained_gloves','hands','armor',[75,100],[{s:'@primary',b:'add',v:pct()},{s:'@primary',b:'beh',v:1.25}]);
def('signal_horn_charm','neck','jewelry',[25,35],[{s:'@summons',b:'more',v:moreU(1)}]);

// ── Warrior ──
def('faultcleaver','mainhand','weapon',[150,200],[{s:'seismic_slam',b:'add',v:pct()},{s:'seismic_slam',b:'beh',v:1.15}],{twoHanded:true});
def('ninefold_gale','mainhand','weapon',[150,200],[{s:['dust_devil','whirlwind'],b:'add',v:pct()},{s:'whirlwind',b:'beh',v:1.10}],{twoHanded:true});
def('bloodwake','mainhand','weapon',[150,200],[{s:'rend',b:'add',v:pct()}]);
def('eternal_gyre','waist','armor',[40,50],[{s:'whirlwind',b:'beh',v:costBeh(0.4)}]);
def('anvil_vambraces','wrists','armor',[25,30],[{s:'*',b:'vuln',v:(r)=>1+r/100*U.stun}]);
def('last_light','offhand','armor',[200,250],[{s:'ground_stomp',b:'add',v:pct()},{s:'ground_stomp',b:'beh',v:1.1}]);
def('millwheel_edge','mainhand','weapon',[150,200],[{s:'cleave',b:'add',v:pct()},{s:'cleave',b:'beh',v:1.3}]);
def('ashgrip_gauntlets','hands','armor',[25,40],[{s:'cleave',b:'more',v:moreU(0.9)},{s:'rend',b:'beh',v:1.05}]);
def('threshers_knot','ring','jewelry',[0.05,0.1],[{s:['ground_stomp','cairnfall'],b:'beh',v:(r)=>1+r*3*1.4}]);
def('gale_stitched_legguards','legs','armor',[6,8],[{s:['whirlwind','dust_devil'],b:'more',v:(r)=>1+5*r/100*0.8}]);
def('tanners_pauldrons','shoulders','armor',[15,25],[{s:'*',b:'vuln',v:(r)=>1+r/100*U.bleed},{s:'rend',b:'beh',v:1.05}]);
def('red_ledger','neck','jewelry',[3,5],[{s:'rend',b:'beh',v:1.15}]);
def('quakestep_sabatons','feet','armor',[60,80],[]); // dash-driven: invisible to a non-dashing harness bot
def('fissure_lined_breastplate','chest','armor',[30,45],[{s:'seismic_slam',b:'more',v:moreU(0.6)},{s:'seismic_slam',b:'beh',v:1.05}]);
def('tremor_signet','ring','jewelry',[0.2,0.3],[{s:'ground_stomp',b:'beh',v:1.4}]);
def('brass_warhorn_helm','head','armor',[8,12],[{s:'@primary',b:'beh',v:costBeh(1)},{s:'@spenders',b:'beh',v:1.03}]);
def('furycord_belt','waist','armor',[15,20],[{s:'@spenders',b:'beh',v:costBeh(0.5)}]);
def('seething_sigil','neck','jewelry',[10,15],[{s:'*',b:'gen',v:pct(0.6)}]);
def('bellwrights_maul','mainhand','weapon',[150,200],[{s:'tolling_blow',b:'add',v:pct()},{s:'tolling_blow',b:'beh',v:1.2}]);
def('belfry_pauldrons','shoulders','armor',[30,40],[{s:'tolling_blow',b:'beh',v:(r)=>1+r/100*0.3}]);
def('grinning_saw','mainhand','weapon',[150,200],[{s:'sawtooth_hatchet',b:'add',v:pct()},{s:'sawtooth_hatchet',b:'beh',v:1.3}]);
def('woodcutters_grips','hands','armor',[25,35],[{s:'sawtooth_hatchet',b:'more',v:moreU(0.9)},{s:'sawtooth_hatchet',b:'beh',v:1.1}]);
def('sawyers_ring','ring','jewelry',[60,80],[{s:'sawtooth_hatchet',b:'beh',v:(r)=>1+r/100*0.3}]);
def('ward_pennant_shield','offhand','armor',[10,15],[{s:'*',b:'gen',v:pct(0.8)}]);
def('quartermasters_cuirass','chest','armor',[25,35],[{s:'@primary',b:'more',v:moreU(0.85)}]);
def('rally_knot','ring','jewelry',[20,30],[{s:'@spenders',b:'beh',v:1.05}]);
def('coulter_blade','mainhand','weapon',[150,200],[{s:'ironplough',b:'add',v:pct()},{s:'ironplough',b:'beh',v:1.15}],{twoHanded:true});
def('yoke_greaves','legs','armor',[25,35],[{s:'ironplough',b:'more',v:moreU(0.9)},{s:'ironplough',b:'beh',v:1.1}]);
def('ox_harness_belt','waist','armor',[15,20],[]);
def('cairnwrights_hammer','mainhand','weapon',[150,200],[{s:'cairnfall',b:'add',v:pct()},{s:'cairnfall',b:'beh',v:1.6}]);
def('stonecount_gauntlets','hands','armor',[20,30],[{s:'*',b:'gen',v:pct(0.4)}]);
def('kilnmaw','mainhand','weapon',[150,200],[{s:'kilnheart',b:'add',v:pct()},{s:'kilnheart',b:'beh',v:1.25}],{twoHanded:true});
def('slagforged_helm','head','armor',[25,35],[{s:'kilnheart',b:'beh',v:(r)=>1/(1-r/100)},{s:'*',b:'gen',v:2}]);
def('coalheart_locket','neck','jewelry',[30,40],[{s:'kilnheart',b:'ele',v:pct()}]);

// ── Ranger ──
def('rainspindle','mainhand','weapon',[30,40],[{s:'rain_of_vengeance',b:'beh',v:(r)=>1.1/(1-r/100*0.8)}],{twoHanded:true});
def('sappers_pack','offhand','armor',[30,40],[{s:'sentry',b:'add',v:pct()},{s:'sentry',b:'beh',v:1.4}]);
def('gearwright_heart','chest','armor',[30,40],[{s:'sentry',b:'beh',v:1.5}]);
def('thunderhead','mainhand','weapon',[150,200],[{s:'multishot',b:'add',v:pct()}],{twoHanded:true});
def('hunters_mark','mainhand','weapon',[15,20],[{s:'*',b:'vuln',v:moreU(0.6)}]);
def('featherguard_cuffs','wrists','armor',[20,30],[{s:'hungering_arrow',b:'more',v:(r)=>Math.pow(1+r/100,0.8)}]);
def('hawkfeather_cap','head','armor',[100,150],[{s:'hungering_arrow',b:'add',v:pct()},{s:'hungering_arrow',b:'beh',v:1.35}]);
def('boltthrowers_arbalest','mainhand','weapon',[150,200],[{s:'sentry',b:'add',v:pct()},{s:'sentry',b:'beh',v:1.15}],{twoHanded:true});
def('bowyers_gloves','hands','armor',[25,35],[{s:'multishot',b:'more',v:moreU(0.6)},{s:'multishot',b:'beh',v:1.3}]);
def('bandolier_belt','waist','armor',[30,40],[{s:'multishot',b:'beh',v:costBeh(0.4)}]);
def('powderkeg_crossbow','mainhand','weapon',[150,200],[{s:'cluster_arrow',b:'add',v:pct()},{s:'cluster_arrow',b:'beh',v:1.35}],{twoHanded:true});
def('fuseburnt_boots','feet','armor',[25,35],[{s:'cluster_arrow',b:'more',v:moreU(1)}]);
def('powder_horn','neck','jewelry',[0.3,0.5],[{s:'rain_of_vengeance',b:'beh',v:(r)=>1+r*0.5}]);
def('squallcatcher_pauldrons','shoulders','armor',[25,40],[{s:'rain_of_vengeance',b:'more',v:moreU(0.75)},{s:'rain_of_vengeance',b:'beh',v:1.1}]);
def('raincount_ring','ring','jewelry',[30,50],[{s:'rain_of_vengeance',b:'beh',v:costBeh(1)}]);
def('kennelwood_bow','mainhand','weapon',[150,200],[{s:'companion',b:'add',v:pct()},{s:'companion',b:'beh',v:1.5}],{twoHanded:true});
def('trailhide_breeches','legs','armor',[25,40],[{s:'companion',b:'more',v:moreU(0.5)},{s:'companion',b:'beh',v:1.35}]);
def('whistle_charm','neck','jewelry',[20,30],[{s:'companion',b:'beh',v:costBeh(1)}]);
def('riverstone_repeater','mainhand','weapon',[100,150],[{s:'skipstone_bolt',b:'add',v:pct()},{s:'skipstone_bolt',b:'beh',v:1.38}]);
def('skimmers_leggings','legs','armor',[15,25],[{s:'skipstone_bolt',b:'more',v:moreU(1)}]);
def('skipping_stone_quiver','offhand','armor',[2,3],[{s:'skipstone_bolt',b:'beh',v:1.25}]);
def('tripline_crossbow','mainhand','weapon',[150,200],[{s:'spring_snare',b:'add',v:pct()},{s:'spring_snare',b:'beh',v:1.4}],{twoHanded:true});
def('snarehand_gloves','hands','armor',[25,40],[{s:['spring_snare','pitch_mortar'],b:'more',v:moreU(0.7)}]);
def('coiled_wire_bracers','wrists','armor',[30,50],[{s:'spring_snare',b:'beh',v:costBeh(0.8)}]);
def('highcloud_longbow','mainhand','weapon',[150,200],[{s:'overcast_volley',b:'add',v:pct()},{s:'overcast_volley',b:'beh',v:1.5}],{twoHanded:true});
def('overcast_hood','head','armor',[25,35],[{s:'overcast_volley',b:'more',v:moreU(0.6)}]);
def('weathervane_ring','ring','jewelry',[0.3,0.6],[{s:'rain_of_vengeance',b:'beh',v:(r)=>1+r*0.67}]);
def('spotters_repeater','mainhand','weapon',[10,15],[{s:'*',b:'vuln',v:moreU(0.4)}]);
def('huntsmans_pauldrons','shoulders','armor',[30,40],[{s:['companion','sentry'],b:'more',v:moreU(0.5)}]);
def('mortarmans_pack','offhand','armor',[30,40],[{s:'pitch_mortar',b:'add',v:pct()},{s:'pitch_mortar',b:'beh',v:1.8}]);
def('tarstained_jerkin','chest','armor',[25,35],[{s:['spring_snare','pitch_mortar','sentry'],b:'more',v:moreU(0.6)}]);
def('fuse_cord_belt','waist','armor',[25,35],[{s:'pitch_mortar',b:'beh',v:costBeh(1)}]);
def('starling_longbow','mainhand','weapon',[150,200],[{s:'murmuration',b:'add',v:pct()},{s:'murmuration',b:'beh',v:1.4}],{twoHanded:true});
def('wingbeat_boots','feet','armor',[25,40],[{s:'murmuration',b:'more',v:moreU(0.6)}]);
def('roost_charm','neck','jewelry',[10,15],[{s:'murmuration',b:'beh',v:1.2}]);

// ── Mage ──
def('lanternroot','mainhand','weapon',[150,200],[{s:'hydra',b:'add',v:pct()},{s:'hydra',b:'beh',v:1.5}],{twoHanded:true});
def('cindervane','mainhand','weapon',[150,200],[{s:'meteor',b:'add',v:pct()},{s:'meteor',b:'beh',v:1.12}],{twoHanded:true});
def('void_heart','offhand','armor',[20,25],[{s:'*',b:'vuln',v:moreU(0.35)},{s:'black_hole',b:'beh',v:1.1}]);
def('starfall_mantle','shoulders','armor',[30,40],[{s:'meteor',b:'beh',v:costBeh(0.8)}]);
def('thousand_missiles','mainhand','weapon',[100,150],[{s:'magic_missile',b:'add',v:pct()},{s:'magic_missile',b:'beh',v:2.0}]);
def('glasswrights_wraps','hands','armor',[25,40],[{s:'magic_missile',b:'more',v:moreU(0.5)},{s:'magic_missile',b:'beh',v:1.15}]);
def('echoing_bead','ring','jewelry',[20,30],[{s:'magic_missile',b:'beh',v:costBeh(1)}]);
def('craterheart_amulet','neck','jewelry',[20,30],[{s:'meteor',b:'more',v:moreU(0.6)},{s:'meteor',b:'beh',v:1.05}]);
def('undertow_staff','mainhand','weapon',[150,200],[{s:'black_hole',b:'add',v:pct()},{s:'black_hole',b:'beh',v:1.1}],{twoHanded:true});
def('horizon_cowl','head','armor',[20,30],[{s:'black_hole',b:'beh',v:1.6},{s:'*',b:'beh',v:1.05}]);
def('frostlocked_wand','mainhand','weapon',[150,200],[{s:'frost_nova',b:'add',v:pct()},{s:'frost_nova',b:'beh',v:1.6}]);
def('winterbound_robe','chest','armor',[25,40],[{s:['rime_needles','frost_nova','rimefield'],b:'more',v:moreU(0.6)}]);
def('rimecourt_band','ring','jewelry',[2,3],[{s:'frost_nova',b:'beh',v:1.3}]);
def('coiled_pauldrons','shoulders','armor',[25,35],[{s:'hydra',b:'more',v:moreU(1)},{s:'hydra',b:'beh',v:1.2}]);
def('lanternkeepers_sash','waist','armor',[30,40],[{s:['hydra','cinderkin'],b:'beh',v:costBeh(0.5)}]);
def('glyphstone_orb','offhand','armor',[10,15],[{s:'*',b:'gen',v:pct(1)}]);
def('spellwrights_circlet','head','armor',[0.1,0.2],[{s:'@cooldowns',b:'beh',v:(r)=>1+r*2}]);
def('runeweaver_cuffs','wrists','armor',[10,15],[{s:'@primary',b:'beh',v:costBeh(1)}]);
def('hoarneedle_wand','mainhand','weapon',[100,150],[{s:'rime_needles',b:'add',v:pct()},{s:'rime_needles',b:'beh',v:1.5}]);
def('frostthread_gloves','hands','armor',[25,40],[{s:'rime_needles',b:'more',v:moreU(0.6)}]);
def('snowglobe_pendant','neck','jewelry',[40,60],[{s:'frost_nova',b:'beh',v:(r)=>1+1.83*r/100}]);
def('resonant_staff','mainhand','weapon',[150,200],[{s:'thrumming_ray',b:'add',v:pct()},{s:'thrumming_ray',b:'beh',v:1.15}],{twoHanded:true});
def('hornlistener_circlet','head','armor',[25,40],[{s:'thrumming_ray',b:'more',v:moreU(0.6)},{s:'thrumming_ray',b:'beh',v:1.1}]);
def('signal_coil','ring','jewelry',[40,60],[{s:'thrumming_ray',b:'beh',v:costBeh(0.3)}]);
def('kindling_rod','mainhand','weapon',[150,200],[{s:'cinderkin',b:'add',v:pct()},{s:'cinderkin',b:'beh',v:1.6}]);
def('firekeepers_gloves','hands','armor',[25,35],[{s:'cinderkin',b:'more',v:moreU(1)},{s:'cinderkin',b:'beh',v:1.1}]);
def('cistern_staff','mainhand','weapon',[150,200],[{s:'rimefield',b:'add',v:pct()},{s:'rimefield',b:'beh',v:1.2}],{twoHanded:true});
def('rimewalker_slippers','feet','armor',[25,35],[{s:'rimefield',b:'more',v:moreU(0.6)},{s:'rimefield',b:'beh',v:1.3}]);
def('stormglass_prism','offhand','armor',[150,200],[{s:'stormglass_orb',b:'add',v:pct()},{s:'stormglass_orb',b:'beh',v:1.3}]);
def('conductors_legwraps','legs','armor',[25,35],[{s:'stormglass_orb',b:'more',v:moreU(1)},{s:'stormglass_orb',b:'beh',v:1.27}]);
def('static_loop','ring','jewelry',[8,12],[{s:'stormglass_orb',b:'beh',v:1.2}]);
def('armillary_staff','mainhand','weapon',[150,200],[{s:'orrery',b:'add',v:pct()},{s:'orrery',b:'beh',v:1.4}],{twoHanded:true});
def('starchart_robe','chest','armor',[25,40],[{s:'orrery',b:'more',v:moreU(0.5)},{s:'orrery',b:'beh',v:1.35}]);
def('clockmakers_ring','ring','jewelry',[15,20],[{s:'orrery',b:'beh',v:1.36}]);

// Uptimes used by a few powers (overridden per archetype).
let U = { stun: 0.15, bleed: 0.8 };

const SHARED = ['ouroboros_loop','witching_cord','mountain_fists','hellforge_talisman','patchwork_signet','watchkeepers_hood',
  'kilnwatch_spaulders','hearthguard_coat','ridgewalker_boots','causeway_waders','surveyors_plumb','brine_tally','ink_stained_gloves'];

// ── Archetypes ──
const A = [
 // WARRIOR
 { id:'W-A Gyre', cls:'warrior', set:'endless_storm', fp:FP_STD, U:{stun:0.15,bleed:0.8},
   shares:{whirlwind:.50,dust_devil:.15,rend:.25,cleave:.10}, primary:'cleave', spenders:['whirlwind','rend'], cooldowns:[], summons:['dust_devil'],
   pool:['ninefold_gale','bloodwake','millwheel_edge','eternal_gyre','gale_stitched_legguards','tanners_pauldrons','red_ledger','brass_warhorn_helm','furycord_belt','ashgrip_gauntlets','lockglass_cincture','wardkeepers_cuffs_lo',...SHARED],
   setFx:{2:[{s:'whirlwind',b:'beh',v:1.10*1.10}],4:[{s:'whirlwind',b:'beh',v:1.35}],6:[{s:['whirlwind','dust_devil','rend'],b:'more',v:SIX},{s:['whirlwind','dust_devil'],b:'beh',v:1.05}]} },
 { id:'W-B Faultline', cls:'warrior', set:'fault_warden', fp:FP_STD, U:{stun:0.6,bleed:0},
   shares:{seismic_slam:.45,ground_stomp:.12,cairnfall:.18,tolling_blow:.25}, primary:'tolling_blow', spenders:['seismic_slam'], cooldowns:['ground_stomp','cairnfall'], summons:[],
   pool:['faultcleaver','last_light','anvil_vambraces','threshers_knot','quakestep_sabatons','fissure_lined_breastplate','tremor_signet','bellwrights_maul','belfry_pauldrons','cairnwrights_hammer','stonecount_gauntlets','brass_warhorn_helm','furycord_belt','wardkeepers_cuffs_cc',...SHARED],
   setFx:{2:[{s:['seismic_slam','ground_stomp','cairnfall'],b:'beh',v:1.08},{s:'ground_stomp',b:'beh',v:1.25}],4:[{s:'seismic_slam',b:'beh',v:1.25}],6:[{s:['seismic_slam','ground_stomp','cairnfall'],b:'more',v:1+CSIX*0.7},{s:'*',b:'beh',v:1.03}]} },
 { id:'W-C Cinderblood', cls:'warrior', set:'cinder_oath', fp:FP_STD, U:{stun:0.15,bleed:0.95},
   shares:{rend:.45,cleave:.25,sawtooth_hatchet:.30}, primary:'cleave', spenders:['rend','sawtooth_hatchet'], cooldowns:['ground_stomp'], summons:[],
   pool:['bloodwake','grinning_saw','millwheel_edge','ashgrip_gauntlets','tanners_pauldrons','red_ledger','woodcutters_grips','sawyers_ring','furycord_belt','coalheart_locket','threshers_knot','wardkeepers_cuffs_lo',...SHARED],
   setFx:{2:[{s:['cleave','rend'],b:'beh',v:1.08}],4:[{s:'rend',b:'beh',v:1.265},{s:'cleave',b:'more',v:1+0.2*0.95}],6:[{s:'rend',b:'beh',v:1.05},{s:['cleave','rend','sawtooth_hatchet'],b:'more',v:SIX}]} },
 { id:'W-D Warcaller', cls:'warrior', set:'hearthbanner', fp:FP_STD, U:{stun:0.4,bleed:0},
   shares:{tolling_blow:.55,kilnheart:.15,ground_stomp:.15,muster_standard:.15}, primary:'tolling_blow', spenders:[], cooldowns:['ground_stomp','muster_standard','kilnheart'], summons:[],
   pool:['bellwrights_maul','kilnmaw','last_light','ward_pennant_shield','quartermasters_cuirass','brass_warhorn_helm','seething_sigil','rally_knot','slagforged_helm','coalheart_locket','anvil_vambraces','belfry_pauldrons','wardkeepers_cuffs_cc',...SHARED],
   setFx:{2:[{s:'tolling_blow',b:'beh',v:1.17}],4:[{s:'tolling_blow',b:'more',v:1+0.25*0.85}],6:[{s:'tolling_blow',b:'beh',v:1.10},{s:['tolling_blow','kilnheart'],b:'more',v:SIX}]} },
 { id:'W-E Ploughline', cls:'warrior', set:'furrowmark', fp:FP_ALT, U:{stun:0.5,bleed:0},
   shares:{ironplough:.65,ground_stomp:.12,tolling_blow:.23}, primary:'tolling_blow', spenders:['ironplough'], cooldowns:['ground_stomp'], summons:[],
   pool:['coulter_blade','bellwrights_maul','yoke_greaves','ox_harness_belt','quakestep_sabatons','anvil_vambraces','lockglass_cincture','brass_warhorn_helm','furycord_belt','belfry_pauldrons','ward_pennant_shield','wardkeepers_cuffs_cc',...SHARED],
   setFx:{2:[{s:'ironplough',b:'beh',v:1.21}],4:[{s:'ironplough',b:'beh',v:1.12},{s:'ironplough',b:'more',v:1+0.2*0.6}],6:[{s:'ironplough',b:'beh',v:1.05},{s:'ironplough',b:'more',v:SIX}]} },
 { id:'W-F Hatchetwind', cls:'warrior', set:null, fp:FP_STD, U:{stun:0.3,bleed:0.9},
   shares:{sawtooth_hatchet:.50,rend:.30,cairnfall:.20}, primary:'cleave', spenders:['sawtooth_hatchet','rend'], cooldowns:['cairnfall'], summons:[],
   pool:['grinning_saw','bloodwake','cairnwrights_hammer','woodcutters_grips','sawyers_ring','tanners_pauldrons','red_ledger','furycord_belt','stonecount_gauntlets','wardkeepers_cuffs_lo',...SHARED], setFx:null },
 // RANGER
 { id:'R-A Siege', cls:'ranger', set:'siegebreaker', fp:FP_STD, U:{},
   shares:{sentry:.45,multishot:.25,cluster_arrow:.15,pitch_mortar:.15}, primary:'hungering_arrow', spenders:['multishot','cluster_arrow'], cooldowns:['sentry'], summons:['sentry','pitch_mortar'],
   pool:['boltthrowers_arbalest','thunderhead','powderkeg_crossbow','sappers_pack','mortarmans_pack','gearwright_heart','bowyers_gloves','bandolier_belt','fuseburnt_boots','tarstained_jerkin','fuse_cord_belt','huntsmans_pauldrons','signal_horn_charm',...SHARED],
   setFx:{2:[{s:'sentry',b:'beh',v:1.47}],4:[{s:['multishot','cluster_arrow'],b:'beh',v:1+3.5*0.25}],6:[{s:['sentry','multishot','cluster_arrow'],b:'more',v:1+0.1*3.2},{s:'sentry',b:'beh',v:1.1}]} },
 { id:'R-B Farwatch', cls:'ranger', set:'farwatch', fp:FP_STD, U:{},
   shares:{hungering_arrow:.45,multishot:.40,companion:.15}, primary:'hungering_arrow', spenders:['multishot'], cooldowns:[], summons:['companion'],
   pool:['thunderhead','hunters_mark','featherguard_cuffs','hawkfeather_cap','bowyers_gloves','bandolier_belt','spotters_repeater','raincount_ring','causeway_waders','whistle_charm',...SHARED],
   setFx:{2:[{s:'hungering_arrow',b:'beh',v:1.15}],4:[{s:'multishot',b:'beh',v:1.32}],6:[{s:'multishot',b:'beh',v:1.25},{s:'hungering_arrow',b:'beh',v:1.1},{s:['hungering_arrow','multishot'],b:'more',v:1+CSIX*0.8}]} },
 { id:'R-C Stormwatch', cls:'ranger', set:'rainkeeper', fp:FP_STD, U:{},
   shares:{rain_of_vengeance:.40,overcast_volley:.35,cluster_arrow:.25}, primary:'hungering_arrow', spenders:['overcast_volley','cluster_arrow'], cooldowns:['rain_of_vengeance'], summons:[],
   pool:['rainspindle','highcloud_longbow','powderkeg_crossbow','squallcatcher_pauldrons','overcast_hood','powder_horn','weathervane_ring','raincount_ring','fuseburnt_boots','bandolier_belt',...SHARED],
   setFx:{2:[{s:['rain_of_vengeance','overcast_volley'],b:'beh',v:1.1},{s:'rain_of_vengeance',b:'beh',v:1.25}],4:[{s:'cluster_arrow',b:'beh',v:1.15},{s:'overcast_volley',b:'beh',v:1.15},{s:'overcast_volley',b:'more',v:1+0.15*0.6}],6:[{s:'rain_of_vengeance',b:'beh',v:1.0},{s:'overcast_volley',b:'beh',v:1.08},{s:['rain_of_vengeance','overcast_volley','cluster_arrow'],b:'more',v:1+CSIX*0.6}]} },
 { id:'R-D Packmaster', cls:'ranger', set:'thicket_kin', fp:FP_STD, U:{},
   shares:{companion:.50,murmuration:.30,hungering_arrow:.20}, primary:'hungering_arrow', spenders:[], cooldowns:['murmuration'], summons:['companion'],
   pool:['kennelwood_bow','starling_longbow','spotters_repeater','trailhide_breeches','huntsmans_pauldrons','wingbeat_boots','whistle_charm','roost_charm','signal_horn_charm','sappers_pack',...SHARED],
   setFx:{2:[{s:'companion',b:'beh',v:1.05}],4:[{s:'companion',b:'beh',v:1.5},{s:'*',b:'beh',v:1.03}],6:[{s:'companion',b:'beh',v:1.2},{s:['companion','murmuration'],b:'more',v:SIX}]} },
 { id:'R-E Trapper', cls:'ranger', set:'snarewright', fp:FP_ALT, U:{},
   shares:{spring_snare:.45,pitch_mortar:.30,skipstone_bolt:.25}, primary:'skipstone_bolt', spenders:[], cooldowns:[], summons:['spring_snare','pitch_mortar'],
   pool:['tripline_crossbow','riverstone_repeater','snarehand_gloves','tarstained_jerkin','coiled_wire_bracers','mortarmans_pack','fuse_cord_belt','skimmers_leggings','overcast_hood','wardkeepers_cuffs_cc','signal_horn_charm',...SHARED],
   setFx:{2:[{s:'spring_snare',b:'beh',v:1.33}],4:[{s:'spring_snare',b:'beh',v:1.05},{s:'pitch_mortar',b:'beh',v:1.15}],6:[{s:'spring_snare',b:'beh',v:1.15},{s:'pitch_mortar',b:'beh',v:1.05},{s:['spring_snare','pitch_mortar','skipstone_bolt'],b:'more',v:1+CSIX*0.7}]} },
 { id:'R-F Skipshot', cls:'ranger', set:null, fp:FP_STD, U:{},
   shares:{skipstone_bolt:.50,multishot:.25,cluster_arrow:.25}, primary:'skipstone_bolt', spenders:['multishot','cluster_arrow'], cooldowns:[], summons:[],
   pool:['riverstone_repeater','powderkeg_crossbow','thunderhead','skimmers_leggings','skipping_stone_quiver','fuseburnt_boots','bowyers_gloves','bandolier_belt','wardkeepers_cuffs_lo',...SHARED], setFx:null },
 // MAGE
 { id:'M-A Starfall', cls:'mage', set:'fallen_star', fp:FP_STD, U:{},
   shares:{meteor:.70,black_hole:.15,magic_missile:.15}, primary:'magic_missile', spenders:['meteor'], cooldowns:['black_hole','frost_nova'], summons:[],
   pool:['cindervane','undertow_staff','thousand_missiles','starfall_mantle','craterheart_amulet','horizon_cowl','void_heart','spellwrights_circlet','glyphstone_orb','rimecourt_band',...SHARED],
   setFx:{2:[{s:'meteor',b:'beh',v:1.45}],4:[{s:'*',b:'gen',v:15}],6:[{s:'meteor',b:'more',v:SIX},{s:'meteor',b:'beh',v:1.1}]} },
 { id:'M-B Glass Concord', cls:'mage', set:'glass_concord', fp:FP_STD, U:{},
   shares:{magic_missile:.60,stormglass_orb:.25,black_hole:.15}, primary:'magic_missile', spenders:['stormglass_orb'], cooldowns:['black_hole'], summons:[],
   pool:['thousand_missiles','undertow_staff','glasswrights_wraps','echoing_bead','void_heart','horizon_cowl','glyphstone_orb','runeweaver_cuffs','stormglass_prism','conductors_legwraps','static_loop',...SHARED],
   setFx:{2:[{s:'magic_missile',b:'beh',v:1.3},{s:'black_hole',b:'beh',v:1.25}],4:[{s:'magic_missile',b:'beh',v:1.24}],6:[{s:'magic_missile',b:'beh',v:1.15},{s:['magic_missile','stormglass_orb'],b:'more',v:SIX}]} },
 { id:'M-C Lantern Garden', cls:'mage', set:'lantern_garden', fp:FP_STD, U:{},
   shares:{hydra:.50,cinderkin:.40,magic_missile:.10}, primary:'magic_missile', spenders:[], cooldowns:['frost_nova'], summons:['hydra','cinderkin'],
   pool:['lanternroot','kindling_rod','coiled_pauldrons','firekeepers_gloves','lanternkeepers_sash','glyphstone_orb','runeweaver_cuffs','signal_horn_charm','causeway_waders',...SHARED],
   setFx:{2:[{s:'hydra',b:'beh',v:1.6}],4:[{s:'hydra',b:'beh',v:1.15}],6:[{s:'cinderkin',b:'beh',v:1.4},{s:['hydra','cinderkin'],b:'more',v:SIX}]} },
 { id:'M-D Hoarfrost', cls:'mage', set:'hoarfrost_vigil', fp:FP_STD, U:{},
   shares:{rime_needles:.40,frost_nova:.20,rimefield:.30,black_hole:.10}, primary:'rime_needles', spenders:[], cooldowns:['frost_nova','rimefield','black_hole'], summons:[],
   pool:['hoarneedle_wand','frostlocked_wand','cistern_staff','winterbound_robe','frostthread_gloves','rimewalker_slippers','snowglobe_pendant','rimecourt_band','void_heart','spellwrights_circlet','glyphstone_orb','wardkeepers_cuffs_cc',...SHARED],
   setFx:{2:[{s:'frost_nova',b:'beh',v:1.33},{s:'rimefield',b:'beh',v:1.1}],4:[{s:'*',b:'vuln',v:1+0.2*0.6}],6:[{s:['rime_needles','frost_nova','rimefield'],b:'more',v:1+CSIX*0.8},{s:'rime_needles',b:'beh',v:1.1}]} },
 { id:'M-E Hollowstar', cls:'mage', set:'hollowstar_choir', fp:FP_ALT, U:{},
   shares:{thrumming_ray:.65,stormglass_orb:.25,magic_missile:.10}, primary:'magic_missile', spenders:['thrumming_ray','stormglass_orb'], cooldowns:[], summons:[],
   pool:['resonant_staff','thousand_missiles','hornlistener_circlet','signal_coil','stormglass_prism','conductors_legwraps','static_loop','glyphstone_orb','lockglass_cincture','causeway_waders',...SHARED],
   setFx:{2:[{s:'thrumming_ray',b:'beh',v:1.21}],4:[{s:'*',b:'gen',v:15},{s:'stormglass_orb',b:'beh',v:1.15}],6:[{s:'thrumming_ray',b:'beh',v:1.12},{s:['thrumming_ray','stormglass_orb'],b:'more',v:1+CSIX*0.85}]} },
 { id:'M-F Orrery', cls:'mage', set:null, fp:FP_STD, U:{},
   shares:{orrery:.50,magic_missile:.30,meteor:.20}, primary:'magic_missile', spenders:['meteor'], cooldowns:['orrery','black_hole'], summons:[],
   pool:['armillary_staff','thousand_missiles','cindervane','starchart_robe','clockmakers_ring','echoing_bead','glasswrights_wraps','horizon_cowl','spellwrights_circlet','glyphstone_orb','causeway_waders',...SHARED], setFx:null },
];

const OFFHAND_RULE = { warrior: (mh) => !mh || !P[mh].twoHanded, ranger: () => true, mage: (mh) => !mh || !P[mh].twoHanded };

function targets(arch, s) {
  if (s === '*') return Object.keys(arch.shares);
  if (Array.isArray(s)) return s;
  if (s === '@primary') return [arch.primary];
  if (s === '@spenders') return arch.spenders;
  if (s === '@cooldowns') return arch.cooldowns;
  if (s === '@summons') return arch.summons;
  return [s];
}

function evaluate(arch, state, setCount) {
  const skills = Object.keys(arch.shares);
  const acc = Object.fromEntries(skills.map((k) => [k, { S: S0, E: E0, more: 1, beh: 1 }]));
  let G = G0, vuln = 1;
  const apply = (fx, roll, isItem = true) => {
    for (const e of fx) {
      let v = typeof e.v === 'function' ? e.v(roll) : e.v;
      if (isItem && e.b === 'more') v = 1 + (v - 1) * MS; // sensitivity: scale legendary skillMore
      if (isItem && e.b === 'gen') v = v * GS;           // sensitivity: scale generic-bucket legendaries
      if (e.b === 'gen') { G += v; continue; }
      if (e.b === 'vuln') { vuln *= v; continue; }
      for (const k of targets(arch, e.s)) {
        const a = acc[k]; if (!a) continue;
        if (e.b === 'add') a.S += v; else if (e.b === 'ele') a.E += v; else if (e.b === 'more') a.more *= v; else if (e.b === 'beh') a.beh *= v;
      }
    }
  };
  let equipped = 0;
  for (const slot of SLOTS) { const id = state.slots[slot]; if (id) { equipped++; } }
  for (const slot of SLOTS) { const id = state.slots[slot]; if (!id) continue; const p = P[id];
    if (p.noSet) { if (setCount < 2) G += mid(p.roll) * Math.min(10, equipped); continue; }
    apply(p.effects, mid(p.roll)); }
  for (const c of ['weapon','armor','jewelry']) { const id = state.cube[c]; if (!id) continue; const p = P[id];
    if (p.noSet) { if (setCount < 2) G += p.roll[1] * Math.min(10, equipped); continue; }
    apply(p.effects, p.roll[1]); }
  if (arch.setFx) for (const n of [2,4,6]) if (setCount >= n) apply(arch.setFx[n], 0, false);
  let total = 0; const per = {};
  for (const k of skills) { const a = acc[k];
    const F = ((100 + a.S) / (100 + S0)) * ((100 + G) / (100 + G0)) * ((100 + a.E) / (100 + E0)) * a.more * vuln * a.beh;
    per[k] = F; total += arch.shares[k] * F; }
  return { total, per, G, vuln, acc };
}

function slotOf(p, slot) { return p.slot === slot || (p.slot === 'ring' && (slot === 'ring1' || slot === 'ring2')); }

function optimise(arch, blocked, setCount, rng) {
  const pool = arch.pool.filter((id) => P[id] && (setCount < 2 || !P[id].noSet));
  const cands = {};
  for (const slot of SLOTS) cands[slot] = [null, ...pool.filter((id) => slotOf(P[id], slot))];
  for (const c of ['weapon','armor','jewelry']) cands['cube:' + c] = [null, ...pool.filter((id) => P[id].cube === c && !P[id].noSet)];
  const positions = [...SLOTS, 'cube:weapon', 'cube:armor', 'cube:jewelry'];
  const get = (st, pos) => pos.startsWith('cube:') ? st.cube[pos.slice(5)] : st.slots[pos];
  const set = (st, pos, v) => { if (pos.startsWith('cube:')) st.cube[pos.slice(5)] = v; else st.slots[pos] = v; };
  const valid = (st) => {
    const used = new Set();
    for (const pos of positions) { const id = get(st, pos); if (!id) continue; if (used.has(id)) return false; used.add(id); }
    for (const b of blocked) if (st.slots[b]) return false;
    if (st.slots.offhand && !OFFHAND_RULE[arch.cls](st.slots.mainhand)) return false;
    return true;
  };
  let best = null;
  for (let restart = 0; restart < 120; restart++) {
    const st = { slots: Object.fromEntries(SLOTS.map((s) => [s, null])), cube: { weapon: null, armor: null, jewelry: null } };
    if (restart > 0) for (const pos of positions) { const c = cands[pos]; const v = c[Math.floor(rng() * c.length)]; const prev = get(st, pos); set(st, pos, v); if (!valid(st)) set(st, pos, prev); }
    let cur = evaluate(arch, st, setCount).total, improved = true;
    while (improved) {
      improved = false;
      for (const pos of positions) {
        const prev = get(st, pos); let bestV = prev, bestT = cur;
        for (const v of cands[pos]) { set(st, pos, v); if (!valid(st)) continue; const t = evaluate(arch, st, setCount).total; if (t > bestT + 1e-9) { bestT = t; bestV = v; } }
        set(st, pos, bestV); if (bestV !== prev) { cur = bestT; improved = true; }
      }
    }
    if (!best || cur > best.total + 1e-9) best = { total: cur, st: JSON.parse(JSON.stringify(st)) };
  }
  return best;
}

function rngOf(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function describe(arch, st) {
  const eq = SLOTS.filter((s) => st.slots[s]).map((s) => `${st.slots[s]}`);
  const cube = ['weapon','armor','jewelry'].filter((c) => st.cube[c]).map((c) => `${st.cube[c]}*`);
  return [...eq, ...cube].join(', ');
}

const rows = [];
for (const arch of A) {
  U = { stun: 0.15, bleed: 0.8, ...arch.U };
  const rng = rngOf(12345);
  const leg = optimise(arch, [], 0, rng);
  let set6 = null, hyb = null;
  if (arch.set) {
    set6 = optimise(arch, arch.fp, 6, rng);
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const blocked = arch.fp.filter((_, k) => k !== i && k !== j);
      const h = optimise(arch, blocked, 4, rng);
      if (!hyb || h.total > hyb.total) hyb = { ...h, freed: [arch.fp[i], arch.fp[j]] };
    }
  }
  const legNoSig = (() => { const a2 = { ...arch, pool: arch.pool.filter((p) => p !== 'patchwork_signet') }; return optimise(a2, [], 0, rngOf(999)); })();
  const legBest = legNoSig.total > leg.total ? legNoSig : leg; // the full pool contains the no-Signet pool
  rows.push({ arch, leg: legBest, legNoSig, set6, hyb });
}

const f2 = (x) => x.toFixed(2);
const out = [];
out.push('| Archetype | Set kit | Hybrid (4 + 2 freed) | Legendary kit | Legendary kit without Signet | Leg / Set | Hybrid between? |');
out.push('|---|---:|---:|---:|---:|---:|---|');
for (const r of rows) {
  const s = r.set6 ? r.set6.total : null, h = r.hyb ? r.hyb.total : null, l = r.leg.total;
  const lo = s ? Math.min(s, l) : 0, hi = s ? Math.max(s, l) : 0;
  const between = s && h ? (h >= lo && h <= hi ? 'yes' : h >= lo * 0.95 && h <= hi * 1.05 ? `within 5% (${f2(h / (h < lo ? lo : hi))})` : `no (${f2(h / (h < lo ? lo : hi))})`) : '–';
  out.push(`| ${r.arch.id} | ${s ? '×' + f2(s) : '–'} | ${h ? '×' + f2(h) + ' (' + r.hyb.freed.join('+') + ')' : '–'} | ×${f2(l)} | ×${f2(r.legNoSig.total)} | ${s ? f2(l / s) : '–'} | ${between} |`);
}
out.push('');
for (const r of rows) {
  out.push(`### ${r.arch.id}`);
  const line = (name, best, sc) => {
    const ev = evaluate(r.arch, best.st, sc);
    const per = Object.entries(ev.per).map(([k, v]) => `${k} ×${f2(v)} (S ${Math.round(ev.acc[k].S)}%, more ×${f2(ev.acc[k].more)}, beh ×${f2(ev.acc[k].beh)})`).join('; ');
    out.push(`* **${name}** ×${f2(best.total)} — items: ${describe(r.arch, best.st)}. Generic ${Math.round(ev.G)}% (base ${G0}), vulnerability ×${f2(ev.vuln)}. Per skill: ${per}.`);
  };
  if (r.set6) line('Set kit (6)', r.set6, 6);
  if (r.hyb) line(`Hybrid (4, ${r.hyb.freed.join('+')} free)`, r.hyb, 4);
  line('Legendary kit', r.leg, 0);
  out.push('');
}
console.log(out.join('\n'));
