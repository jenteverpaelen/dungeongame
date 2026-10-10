import type { AdventureData } from '../adventureTypes';
import type { Point } from '../townTypes';
import type { Prop } from '../mapgen';

// C091/L108: authored coordinates, using the existing 640u room / 230u passage unit.
const rect=(x:number,y:number,w:number,h:number):Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const road=(a:Point,b:Point,width=230):Point[]=>{
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]),x=-(b[1]-a[1])/d*width/2,y=(b[0]-a[0])/d*width/2;
  return [[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]];
};
const props=(k:string,points:Point[],r:number,s=1):Prop[]=>points.map(([x,y],v)=>({k,x,y,r,s,v}));

export const CAIRNSPILL:AdventureData={
  id:'cairnspill_terraces',size:[56,48],surface:'masonry',
  geometry:{entry:{x:600,y:2670},floors:[
    {polygon:rect(340,2430,640,550)},
    {polygon:road([750,2580],[1400,2210])},
    {polygon:[[1060,1910],[1650,1830],[1840,2160],[1690,2540],[1110,2500],[980,2200]]},
    {polygon:road([1450,2050],[2110,1490])},
    {polygon:rect(1840,1180,760,660)},
    {polygon:road([2400,1430],[2870,830])},
    {polygon:rect(2480,420,700,720)},
    {polygon:road([1240,2100],[790,1460])},
    {polygon:rect(470,1150,640,640)},
    {polygon:road([950,1420],[2050,1450])},
  ],buildings:[{footprint:rect(1910,1210,360,45)},{footprint:rect(2510,450,45,340)}],barriers:[],props:[],npcs:[]},
  paths:[{points:[[600,2670],[750,2580],[1400,2210],[1450,2050],[2110,1490],[2400,1430],[2870,830],[2940,600]],width:120},
    {points:[[1240,2100],[790,1460],[950,1420],[2050,1450]],width:85}],
  scenery:[...props('boulder',[[400,2520],[920,2750],[1090,2280],[1730,2020],[2440,1700],[3040,510],[1080,1670],[570,1220]],29),
    ...props('stump',[[770,2860],[1610,2380],[2550,950]],17),...props('crate',[[2090,1740],[2140,1740],[2730,480]],17),
    ...props('lantern',[[650,2500],[1200,1990],[2040,1300],[2880,1010]],6)],
  npcs:[{id:'surveyor',name:'Iven · Road Surveyor',role:'quest',x:780,y:2680,r:18},
    {id:'dispatch',name:'Quarry dispatch',role:'clue',x:2890,y:580,r:18}],
  interactions:[{id:'surveyor',name:'Iven',x:780,y:2680,radius:110,kind:'person'},
    {id:'dispatch',name:'Quarry dispatch',x:2890,y:580,radius:110,kind:'ledger'}],
  portals:[{x:450,y:2750,to:'bracken_sluice',label:'Bracken Sluice'},{x:3080,y:690,to:'cinderwash_kilns',label:'Cinderwash Kilns'}],
  locations:[{id:'cutting',x:2050,y:1540,radius:110}],
  encounters:[
    {id:'lower_cut',x:1430,y:2240,members:[{type:'flint_beetle',dx:0,dy:0},{type:'gloomshroom',dx:-110,dy:60},{type:'bog_slime',dx:100,dy:80},{type:'grave_bat',dx:90,dy:-100}]},
    {id:'bench',x:2160,y:1510,members:[{type:'flint_beetle',dx:0,dy:0},{type:'vault_moth',dx:110,dy:-100},{type:'mossback',dx:-110,dy:80},{type:'bog_slime',dx:80,dy:90}]},
    {id:'old_track',x:800,y:1460,members:[{type:'vault_moth',dx:0,dy:0},{type:'siltusk',dx:110,dy:60},{type:'grave_bat',dx:-120,dy:40},{type:'gloomshroom',dx:80,dy:-110}]},
    {id:'foreman',x:2860,y:850,members:[{type:'flint_beetle',dx:0,dy:0,tier:2,name:'Splintercrown',questTarget:true,affixes:['fast']},{type:'gloomshroom',dx:-130,dy:40},{type:'vault_moth',dx:120,dy:-60},{type:'bog_slime',dx:90,dy:120}]},
  ],
  landmarks:[{name:'Survey Camp',x:600,y:2810},{name:'Lower Cutting',x:1420,y:2360},{name:'Stone Bench',x:2140,y:1660},{name:'Quarry Head',x:2840,y:690}],
  ambience:{motion:[{id:'creek',kind:'ripples',position:[1520,1120],width:70},{id:'cut-mist',kind:'mist',position:[1730,1750],width:360},{id:'ledge-drip',kind:'drips',position:[1770,1120],width:32}],
    sounds:[{id:'camp-wind',kind:'wind',position:[600,2650],radius:720},{id:'stone-water',kind:'water',position:[1740,1580],radius:720},{id:'quarry-wind',kind:'wind',position:[2810,850],radius:720}]},
  routes:[[[600,2670],[750,2580],[1400,2210],[1450,2050],[2110,1490],[2400,1430],[2870,830],[2890,650]],
    [[1240,2100],[790,1460],[950,1420],[2050,1450]],[[600,2670],[450,2750]],[[2870,830],[3080,690]],[[600,2670],[710,2680]]],
};

export const CINDERWASH:AdventureData={
  id:'cinderwash_kilns',theme:'ashen',surface:'ash',size:[56,48],
  geometry:{entry:{x:620,y:2660},floors:[
    {polygon:rect(330,2370,700,620)},{polygon:road([810,2550],[1490,2160])},
    {polygon:rect(1120,1820,760,720)},{polygon:road([1710,2110],[2600,2140])},
    {polygon:rect(2200,1740,850,760)},{polygon:road([2600,1880],[2430,1080])},
    {polygon:rect(2080,540,950,920)},
    {polygon:road([1390,2010],[1250,1250])},{polygon:rect(880,920,760,660)},
    {polygon:road([1460,1170],[2280,1080])},
  ],buildings:[],barriers:[],props:[],npcs:[]},
  kilns:[{x:2300,y:560,w:300,d:220,h:160},{x:2690,y:860,w:230,d:180,h:130}],
  paths:[{points:[[620,2660],[810,2550],[1490,2160],[1710,2110],[2600,2140],[2600,1880],[2430,1080],[2510,850]],width:125},
    {points:[[1390,2010],[1250,1250],[1460,1170],[2280,1080]],width:85}],
  scenery:[...props('boulder',[[380,2470],[970,2810],[1770,2380],[2340,2410],[2860,2250],[2150,780]],29),
    ...props('crate',[[1140,2070],[1180,2110],[940,1100],[990,1100]],17),
    ...props('lantern',[[820,2410],[1300,1880],[2280,1830],[2820,1340]],6)],
  npcs:[{id:'firekeeper',name:'Kessa · Firekeeper',role:'quest',x:790,y:2720,r:18},
    {id:'draught',name:'Kiln draught lever',role:'clue',x:2520,y:920,r:18},
    {id:'tally',name:'Firing tally',role:'clue',x:1160,y:1050,r:18}],
  interactions:[{id:'firekeeper',name:'Kessa',x:790,y:2720,radius:110,kind:'person'},
    {id:'draught',name:'Kiln draught lever',x:2520,y:920,radius:110,kind:'mechanism'},
    {id:'tally',name:'Firing tally',x:1160,y:1050,radius:110,kind:'ledger'}],
  portals:[{x:460,y:2800,to:'cairnspill_terraces',label:'Cairnspill Terraces'},{x:2900,y:1300,to:'kilnwatch_crown',label:'Kilnwatch Crown'}],
  locations:[{id:'firing_yard',x:2510,y:1860,radius:110}],
  encounters:[
    {id:'charcoal',x:1490,y:2200,members:[{type:'ember_imp',dx:0,dy:0},{type:'ash_wisp',dx:110,dy:80},{type:'bonewalker',dx:-100,dy:-80},{type:'cinder_cultist',dx:90,dy:-110}]},
    {id:'firing',x:2600,y:2180,members:[{type:'magma_brute',dx:0,dy:0},{type:'ash_wisp',dx:110,dy:70},{type:'ember_imp',dx:-100,dy:80},{type:'cinder_cultist',dx:110,dy:-110}]},
    {id:'store',x:1260,y:1320,members:[{type:'bonewalker',dx:0,dy:0,tier:2,name:'Coalmark',affixes:['electrified','fast']},{type:'ember_imp',dx:-120,dy:50},{type:'grave_bat',dx:100,dy:60},{type:'cinder_cultist',dx:80,dy:-110}]},
    {id:'stoker',x:2420,y:1200,members:[{type:'cinder_cultist',dx:0,dy:0,tier:2,name:'The Unattended Flame',questTarget:true,affixes:['faulted']},{type:'ember_imp',dx:-120,dy:-30},{type:'bonewalker',dx:110,dy:60},{type:'grave_bat',dx:-80,dy:100}]},
  ],
  landmarks:[{name:'Firekeepers’ Camp',x:620,y:2820},{name:'Charcoal Road',x:1490,y:2360},{name:'Firing Yard',x:2600,y:2340},{name:'Upper Kilns',x:2500,y:810}],
  ambience:{motion:[{id:'yard-smoke',kind:'mist',position:[2660,730],width:360},{id:'kiln-smoke',kind:'mist',position:[2850,820],width:180}],
    sounds:[{id:'camp',kind:'wind',position:[620,2600],radius:720},{id:'yard',kind:'fire',position:[2520,1850],radius:720},{id:'upper-fire',kind:'fire',position:[2540,800],radius:720},{id:'stores',kind:'wind',position:[1250,1250],radius:720}]},
  routes:[[[620,2660],[810,2550],[1490,2160],[1710,2110],[2600,2140],[2600,1880],[2430,1080],[2520,990]],
    [[1390,2010],[1250,1250],[1160,1120]],[[1250,1250],[1460,1170],[2280,1080]],[[620,2660],[460,2800]],
    [[2430,1080],[2550,1300],[2900,1300]],[[620,2660],[720,2720]]],
};

export const KILNWATCH:AdventureData={
  id:'kilnwatch_crown',theme:'ashen',surface:'ash',size:[48,48],
  geometry:{entry:{x:660,y:2640},floors:[
    {polygon:rect(320,2310,740,670)},{polygon:road([820,2510],[1450,1930])},
    {polygon:rect(1090,1590,740,720)},{polygon:road([1450,1740],[2180,1370])},
    {polygon:rect(1820,400,960,1140)},
    {polygon:road([1250,1790],[830,1170])},{polygon:rect(480,820,720,720)},
    {polygon:road([1020,1090],[2050,950])},
  ],buildings:[{footprint:rect(1840,480,45,340)},{footprint:rect(2700,520,45,550)}],barriers:[],props:[],npcs:[]},
  kilns:[{x:2120,y:410,w:400,d:240,h:200}],
  paths:[{points:[[660,2640],[820,2510],[1450,1930],[1450,1740],[2180,1370],[2300,1010],[2310,760]],width:125},
    {points:[[1250,1790],[830,1170],[1020,1090],[2050,950]],width:85}],
  scenery:[...props('boulder',[[400,2410],[930,2840],[1690,2190],[1930,1390],[2640,1340],[560,920]],29),
    ...props('crate',[[390,2800],[430,2800],[1070,1430]],17),...props('lantern',[[990,2400],[1360,1630],[2090,1260],[2590,750]],6)],
  npcs:[{id:'watchkeeper',name:'Venn · Kiln Watchkeeper',role:'quest',x:820,y:2740,r:18},
    {id:'seal',name:'Cold draw seal',role:'clue',x:2310,y:740,r:18},
    {id:'watchlog',name:'Watch log',role:'clue',x:710,y:950,r:18}],
  interactions:[{id:'watchkeeper',name:'Venn',x:820,y:2740,radius:110,kind:'person'},
    {id:'seal',name:'Cold draw seal',x:2310,y:740,radius:110,kind:'mechanism'},
    {id:'watchlog',name:'Watch log',x:710,y:950,radius:110,kind:'ledger'}],
  portals:[{x:470,y:2750,to:'cinderwash_kilns',label:'Cinderwash Kilns'},{x:2590,y:1070,to:'sablefen_causeway',label:'Sablefen Causeway'}],
  locations:[{id:'crown',x:2220,y:1300,radius:110}],
  encounters:[
    {id:'gantry',x:1480,y:1950,members:[{type:'flint_beetle',dx:0,dy:0},{type:'cinder_cultist',dx:100,dy:-110},{type:'bonewalker',dx:-100,dy:80},{type:'ember_imp',dx:100,dy:100}]},
    {id:'watch',x:860,y:1200,members:[{type:'vault_moth',dx:0,dy:0,tier:2,name:'Sootveil',affixes:['faulted','fast']},{type:'grave_bat',dx:100,dy:60},{type:'bonewalker',dx:-110,dy:70},{type:'ember_imp',dx:70,dy:-110}]},
    {id:'heart',x:2310,y:1020,members:[{type:'kiln_heart',dx:0,dy:0,tier:2,name:'The Last Ember',questTarget:true,combat:'furnace'}]},
  ],
  landmarks:[{name:'Watchkeepers’ Refuge',x:650,y:2830},{name:'Haulage Gantry',x:1460,y:2130},{name:'Abandoned Watch',x:830,y:1360},{name:'Crown Furnace',x:2290,y:840}],
  ambience:{motion:[{id:'chimney-smoke',kind:'mist',position:[2400,420],width:360},{id:'shelf-smoke',kind:'mist',position:[1790,1480],width:180}],
    sounds:[{id:'refuge-wind',kind:'wind',position:[650,2640],radius:720},{id:'crown-fire',kind:'fire',position:[2320,760],radius:720},{id:'gantry-wind',kind:'wind',position:[1460,1840],radius:720}]},
  routes:[[[660,2640],[820,2510],[1450,1930],[1450,1740],[2180,1370],[2300,1010],[2310,810]],
    [[1250,1790],[830,1170],[710,1020]],[[830,1170],[1020,1090],[2050,950],[2300,1010]],
    [[660,2640],[470,2750]],[[660,2640],[750,2740]]],
};
