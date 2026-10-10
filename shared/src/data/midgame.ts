import type { AdventureData } from '../adventureTypes';
import type { Point } from '../townTypes';

// L117/D055: fixed, authored floor plans. Helpers expand dimensions; no random placement.
const rect=(x:number,y:number,w:number,h:number):Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const chamber=(x:number,y:number,w=640,h=640)=>rect(x-w/2,y-h/2,w,h);
const passage=(a:Point,b:Point):Point[]=>{
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]),x=-(b[1]-a[1])/d*115,y=(b[0]-a[0])/d*115;
  return [[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]];
};
type Contact=[id:string,name:string,x:number,y:number,kind:AdventureData['interactions'][number]['kind']];
type Pack=AdventureData['encounters'][number];
const pack=(id:string,x:number,y:number,types:string[],boss?:Partial<Pack['members'][number]>):Pack=>({id,x,y,members:types.map((type,i)=>({type,dx:[0,-120,120,90,-100][i],dy:[0,70,-90,110,-100][i],...(i===0?boss:{})}))});
interface Plan {
  id:string;size:[number,number];entry:Point;surface?:AdventureData['surface'];theme?:AdventureData['theme'];
  floors:Point[][];roads:Point[][];walls?:Point[][];contacts:Contact[];encounters:Pack[];
  exits:[x:number,y:number,to:string,label:string][];landmarks:[string,number,number][];
  scenery?:[k:string,x:number,y:number,r:number][];dungeon?:AdventureData['dungeon'];works?:AdventureData['works'];
}
function author(p:Plan):AdventureData {
  return {id:p.id,size:p.size,theme:p.theme,surface:p.surface,
    geometry:{entry:{x:p.entry[0],y:p.entry[1]},floors:[...p.floors,...p.roads.flatMap(r=>r.slice(1).map((b,i)=>passage(r[i],b))),
      ...p.roads.flatMap(r=>r.map(([x,y])=>chamber(x,y,230,230)))].map(polygon=>({polygon})),
      buildings:(p.walls??[]).map(footprint=>({footprint})),barriers:[],props:[],npcs:[]},
    paths:p.roads.map(points=>({points,width:85})),routes:p.roads,
    npcs:p.contacts.map(([id,name,x,y,kind])=>({id,name,x,y,r:18,role:kind==='person'?'quest':'clue'})),
    interactions:p.contacts.map(([id,name,x,y,kind])=>({id,name,x,y,kind,radius:110})),
    portals:p.exits.map(([x,y,to,label])=>({x,y,to,label})),encounters:p.encounters,dungeon:p.dungeon,works:p.works,
    scenery:(p.scenery??[]).map(([k,x,y,r],v)=>({k,x,y,r,s:1,v})),locations:[],
    landmarks:p.landmarks.map(([name,x,y])=>({name,x,y})),
    ambience:{motion:p.landmarks.slice(1).map(([,x,y],i)=>({id:'haze'+i,kind:'mist',position:[x,y-360],width:180})),
      sounds:p.landmarks.map(([,x,y],i)=>({id:'air'+i,kind:p.surface==='masonry'?'water':'wind',position:[x,y],radius:720}))},
  };
}

export const SABLEFEN=author({
  id:'sablefen_causeway',size:[56,48],entry:[550,2600],
  floors:[chamber(550,2600),chamber(1400,2600),chamber(2500,2600),chamber(2500,1550),chamber(1400,1450,760,640),chamber(1400,500)],
  roads:[[[550,2600],[1400,2600],[2500,2600],[2500,1550],[1400,1450],[1400,500]],[[1400,2600],[1400,1450]]],
  walls:[rect(1030,1180,36,200),rect(2650,2320,130,36)],
  contacts:[['manifest','Waterlogged manifest',480,2460,'ledger'],['ferrier','Sera · Causeway Ferrier',1120,1410,'person'],
    ['false_writ','Unsigned toll writ',2680,1430,'ledger'],['chain','North chain winch',1570,390,'mechanism']],
  exits:[[390,2740,'kilnwatch_crown','Kilnwatch Crown'],[1280,300,'saltwind_pans','Saltwind Pans']],
  encounters:[pack('cargo',1400,2620,['saltglass_skimmer','bog_slime','grave_bat','siltusk']),
    pack('toll',2500,2580,['salt_guard','reedclaw','grave_bat','bog_slime'],{tier:2,name:'The Tollkeeper',questTarget:true,affixes:['plagued','fast']}),
    pack('upper_bank',2500,1620,['saltglass_skimmer','vault_moth','siltusk','grave_bat']),
    pack('chainwatch',1400,550,['salt_guard','vault_moth','brine_crab','bonewalker'],{tier:2,name:'Chainwatch',questTarget:true,affixes:['frozen','mortar']})],
  scenery:[['tree',340,2510,24],['stump',650,2810,17],['crate',2670,2730,17],['lantern',1240,1280,6],['boulder',1670,1590,29],['boulder',1130,620,29]],
  landmarks:[['Sunken Cargo Road',550,2770],['Toll Island',2500,2800],['Ferriers’ Refuge',1400,1640],['North Chain',1400,730]],
});

export const SALTWIND=author({
  id:'saltwind_pans',size:[56,48],entry:[500,2550],surface:'salt',
  works:[{kind:'pan',x:1680,y:2700,w:140,d:80,h:28},{kind:'pan',x:2750,y:2690,w:150,d:100,h:28},{kind:'pan',x:530,y:1580,w:170,d:100,h:28}],
  floors:[chamber(500,2550),chamber(1500,2550,700),chamber(2700,2550),chamber(2700,1450),chamber(1500,1450),chamber(500,1450),chamber(1500,500,850)],
  roads:[[[500,2550],[1500,2550],[2700,2550],[2700,1450],[1500,1450],[500,1450],[500,2550]],[[1500,2550],[1500,1450],[1500,500]]],
  walls:[rect(1230,260,540,45),rect(2470,1180,360,45)],
  contacts:[['inlet','Brine inlet tally',350,1320,'ledger'],['briner','Neris · Brine Keeper',1280,1370,'person'],
    ['spill','Overflow spindle',2810,1360,'mechanism'],['dispatch','Salt dispatch',1710,410,'ledger']],
  exits:[[340,2720,'sablefen_causeway','Sablefen Causeway'],[1380,380,'lockglass_cistern','Lockglass Cistern'],[1760,510,'shiverline_escarpment','Shiverline Escarpment']],
  encounters:[pack('pan_lane',1500,2590,['saltglass_skimmer','salt_guard','vault_moth','bog_slime']),
    pack('boiler',2700,2530,['salt_guard','brine_crab','cinder_cultist','bonewalker'],{tier:2,name:'The Dry Boil',questTarget:true,affixes:['molten','mortar']}),
    pack('overflow',2690,1570,['reedclaw','vault_moth','saltglass_skimmer','bonewalker']),
    pack('dispatch_watch',1450,540,['salt_guard','vault_moth','bonewalker','brine_crab'],{tier:2,name:'White Ledger',questTarget:true,affixes:['frozen','electrified']})],
  scenery:[['crate',370,2380,17],['crate',420,2380,17],['boulder',1770,2760,29],['lantern',1280,1600,6],['lantern',2890,2390,6],['boulder',730,1640,29]],
  landmarks:[['Salt Road',500,2740],['Firing Lane',2700,2780],['Brine Keepers’ Station',1500,1630],['Dispatch House',1500,740]],
});

const intake=chamber(650,1900),filters=chamber(1770,1900),lockheart=chamber(1770,650,800,760);
export const LOCKGLASS=author({
  id:'lockglass_cistern',size:[40,40],entry:[600,2400],surface:'masonry',
  works:[{kind:'pan',x:1450,y:400,w:120,d:80,h:28}],
  floors:[chamber(600,2400,520,360),intake,filters,lockheart,chamber(1770,1300,500,340)],
  roads:[[[600,2400],[650,1900],[1770,1900],[1770,1300],[1770,650]]],
  walls:[rect(340,1590,230,36),rect(1430,300,660,36)],
  contacts:[['intake_wheel','Intake wheel',430,1940,'mechanism'],['filter_wheel','Filter wheel',1940,2070,'mechanism'],
    ['lockkeeper','Aven · Cistern Keeper',1920,1290,'person'],['heart_wheel','Heart governor',2000,850,'mechanism'],['archive','Water-order archive',1970,440,'ledger']],
  exits:[[450,2460,'saltwind_pans','Return to Saltwind Pans']],
  encounters:[pack('intake_pack',670,1820,['saltglass_skimmer','vault_moth','bog_slime','salt_guard']),
    pack('filter_pack',1690,1810,['salt_guard','brine_crab','vault_moth','grave_bat','bonewalker'],{tier:2,name:'The Calcified Hand',affixes:['frozen','plagued']}),
    pack('lock_heart',1730,610,['cistern_heart'],{tier:2,name:'The Borrowed Heart',combat:'cistern'})],
  dungeon:{requireStory:true,endTarget:'archive',stages:[{id:'intake',trigger:'intake_wheel',encounter:'intake_pack',area:intake},{id:'filters',trigger:'filter_wheel',encounter:'filter_pack',area:filters},{id:'heart',trigger:'heart_wheel',encounter:'lock_heart',area:lockheart}]},
  scenery:[['crate',420,2290,17],['lantern',860,1710,6],['lantern',1980,1690,6],['lantern',1500,1270,6],['boulder',1450,890,29]],
  landmarks:[['Inspection Stairs',600,2500],['Intake Vault',650,2110],['Filter Vault',1770,2150],['Governor Chamber',1770,950]],
});

export const SHIVERLINE=author({
  id:'shiverline_escarpment',size:[56,52],entry:[550,2900],surface:'slate',
  works:[{kind:'relay',x:2660,y:840,w:110,d:90,h:160},{kind:'relay',x:2700,y:3060,w:110,d:90,h:160}],
  floors:[chamber(550,2900),chamber(2550,2900),chamber(2550,1900),chamber(550,1900),chamber(550,850),chamber(2550,650,780,720),chamber(1550,850,500)],
  roads:[[[550,2900],[2550,2900],[2550,1900],[550,1900],[550,850],[1550,850],[2550,650]],[[2550,1900],[2550,650]]],
  walls:[rect(320,580,400,40),rect(2740,380,40,340)],
  contacts:[['lower_flag','Lower relay pennant',2690,2770,'marker'],['intercept','Intercepted signal slate',420,1810,'ledger'],
    ['lookout','Tallis · Ridge Lookout',1460,760,'person'],['code','Ridge code wheel',730,680,'ledger'],['beacon','Upper beacon control',2670,470,'mechanism']],
  exits:[[370,3060,'saltwind_pans','Saltwind Pans'],[2410,400,'beaconbreak_ward','Beaconbreak Ward']],
  encounters:[pack('lower_ridge',2550,2930,['ridge_harrier','bonewalker','rimehorn','vault_moth']),
    pack('interceptor',550,1990,['signal_adept','ridge_harrier','bonewalker','grave_bat'],{tier:2,name:'The Interceptor',questTarget:true,affixes:['vortex','electrified']}),
    pack('code_watch',560,900,['ridge_harrier','signal_adept','salt_guard','rimehorn']),
    pack('beacon_watch',2480,690,['signal_adept','ridge_harrier','bonewalker','salt_guard'],{tier:2,name:'Mute Flame',questTarget:true,affixes:['faulted','mortar']})],
  scenery:[['boulder',330,2760,29],['boulder',2740,3030,29],['boulder',330,2090,29],['lantern',1530,1040,6],['lantern',2850,850,6],['stump',2740,1760,17]],
  landmarks:[['Lower Switchback',550,3110],['Windward Relay',2550,3100],['Intercept Ledge',550,2160],['Lookout Shelter',1550,1050],['Upper Beacon',2550,910]],
});

export const BEACONBREAK=author({
  id:'beaconbreak_ward',size:[56,48],entry:[1600,2650],surface:'slate',
  works:[{kind:'relay',x:1800,y:550,w:100,d:100,h:160}],
  floors:[chamber(1600,2650),rect(480,1470,2240,500),rect(1360,410,480,2240),chamber(680,750),chamber(2500,750),chamber(1600,650,760)],
  roads:[[[1600,2650],[1600,1720],[680,1720],[680,750],[1600,650],[2500,750],[2500,1720],[1600,1720],[1600,650]]],
  walls:[rect(1010,940,240,400),rect(1950,940,240,400),rect(410,1530,45,380),rect(2740,1530,45,380)],
  contacts:[['gate_orders','Gatehouse orders',1800,2500,'ledger'],['quartermaster','Mera · Ward Quartermaster',1730,1820,'person'],
    ['stores','Granary dispatch board',500,570,'ledger'],['cistern','Ward cistern stopcock',2690,600,'mechanism'],['relay_book','Relay duty book',1740,470,'ledger']],
  exits:[[1460,2830,'shiverline_escarpment','Shiverline Escarpment'],[1440,400,'hollowstar_array','Hollowstar Array']],
  encounters:[pack('gatekeeper',750,1700,['salt_guard','ridge_harrier','bonewalker','signal_adept'],{tier:2,name:'The Closed Hand',questTarget:true,affixes:['vortex','frozen']}),
    pack('stores_watch',720,780,['bonewalker','signal_adept','ridge_harrier','rimehorn']),
    pack('cistern_watch',2450,800,['saltglass_skimmer','salt_guard','signal_adept','vault_moth']),
    pack('relay_keeper',1590,710,['signal_adept','ridge_harrier','salt_guard','bonewalker'],{tier:2,name:'The Countermand',questTarget:true,affixes:['electrified','faulted']})],
  scenery:[['crate',1460,2780,17],['crate',1510,2780,17],['boulder',870,520,29],['lantern',1200,1810,6],['lantern',2050,1790,6],['lantern',2690,950,6]],
  landmarks:[['South Gate',1600,2820],['Ward Crossroads',1600,1920],['Raised Granary',680,1020],['Ward Cistern',2500,1030],['Relay Gate',1600,860]],
});

const west=chamber(620,1650,760),east=chamber(2350,1650,760),array=chamber(1490,530,900,760);
export const HOLLOWSTAR=author({
  id:'hollowstar_array',size:[48,40],entry:[1490,2240],surface:'slate',
  works:[{kind:'relay',x:1140,y:330,w:100,d:90,h:160},{kind:'relay',x:1770,y:620,w:100,d:90,h:160}],
  floors:[chamber(1490,2240,620,400),west,east,array,chamber(1490,1200,520,400)],
  roads:[[[1490,2240],[620,2240],[620,1650],[620,1200],[1490,1200],[2350,1200],[2350,1650],[2350,2240],[1490,2240]],[[1490,1200],[1490,530]]],
  walls:[rect(270,1370,40,370),rect(2660,1370,40,370),rect(1110,190,760,45)],
  contacts:[['west_lens','Western signal shutter',400,1800,'mechanism'],['west_reader','Eris · Western Reader',810,1260,'person'],
    ['east_lens','Eastern signal shutter',2560,1800,'mechanism'],['contradiction','Conflicting transmission strip',2500,1430,'ledger'],
    ['east_reader','Daro · Eastern Reader',2130,1260,'person'],['array_control','Array isolator',1730,790,'mechanism'],['final_record','Original command spool',1740,360,'ledger']],
  exits:[[1490,2380,'beaconbreak_ward','Return to Beaconbreak Ward']],
  encounters:[pack('west_signal',600,1620,['signal_adept','ridge_harrier','vault_moth','salt_guard'],{tier:2,name:'First Voice',affixes:['frozen','mortar']}),
    pack('east_signal',2330,1620,['signal_adept','vault_moth','ridge_harrier','bonewalker','salt_guard'],{tier:2,name:'Second Voice',affixes:['electrified','vortex']}),
    pack('array_heart',1450,480,['signal_heart'],{tier:2,name:'The Hollow Conductor',combat:'relay'})],
  dungeon:{requireStory:true,endTarget:'final_record',stages:[{id:'west',trigger:'west_lens',encounter:'west_signal',area:west},{id:'east',trigger:'east_lens',encounter:'east_signal',area:east},{id:'conductor',trigger:'array_control',encounter:'array_heart',area:array}]},
  scenery:[['crate',1260,2290,17],['lantern',820,1880,6],['lantern',2130,1880,6],['lantern',1320,1110,6],['boulder',1120,730,29],['boulder',1800,500,29]],
  landmarks:[['Signal Approach',1490,2360],['Western Receiver',620,1860],['Eastern Receiver',2350,1860],['Relay Gallery',1490,1350],['Isolated Array',1490,800]],
});

export const MIDGAME_ADVENTURES=[SABLEFEN,SALTWIND,LOCKGLASS,SHIVERLINE,BEACONBREAK,HOLLOWSTAR] as const;
