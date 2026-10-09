import type { AdventureData } from '../adventureTypes';
import type { Point } from '../townTypes';
import type { Prop } from '../mapgen';

// Authored composition in world units. No random layout or encounter placement.
const rect = (x: number, y: number, w: number, h: number): Point[] => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const scenery: Prop[] = [];
const row = (kind: string, points: Point[], radius: number, scale = 1) => points.forEach(([x,y],v) => scenery.push({ k:kind,x,y,r:radius,s:scale,v }));
row('pine', [[350,2570],[390,2250],[680,2240],[950,2690],[1100,2360],[1210,2650],[1160,2120],[1420,1740],[1150,1600],[930,1460],[580,1730],[660,1280],[1200,1200],[1550,1110],[1740,1610],[2080,2430],[2400,2420],[2570,2140],[2650,1560],[2890,1340],[2810,860],[3020,550],[3620,520],[3810,990],[3640,1570]], 20, 1.35);
row('tree', [[490,2670],[810,2780],[1550,2360],[1700,2530],[1910,2370],[1980,1760],[2530,1760],[1810,1100],[2300,970],[2650,660],[3400,510],[3790,1270]], 22, 1.2);
row('boulder', [[990,2440],[1220,2330],[1520,2170],[1770,2210],[1940,1480],[2140,1290],[2600,1350],[3150,1430],[3650,720]], 29);
row('stump', [[1510,1880],[2130,2240],[2390,1900],[3020,1090]], 17);
row('crate', [[650,2500],[695,2510],[2140,1960],[2165,1965],[3460,880]], 17);
row('campfire', [[750,2520]], 21);
row('lantern', [[880,2460],[1350,1990],[1790,1970],[2730,1200],[3170,1140]], 6);

export const RILLWAKE: AdventureData = {
  id: 'rillwake_crossing', size: [64,52],
  events:[{id:'survey_alarm',name:'The Overlook Alarm',trigger:'survey',encounter:'overlook'}],
  ambience: {
    motion: [
      {id:'camp-water',kind:'ripples',position:[450,2160],width:40},
      {id:'crossing-upstream',kind:'ripples',position:[1900,1800],width:70},
      {id:'crossing-downstream',kind:'ripples',position:[1900,2300],width:70},
      {id:'camp-reeds',kind:'reeds',position:[955,2170],width:32},
      {id:'crossing-reeds',kind:'reeds',position:[1850,1870],width:32},
      {id:'river-mist',kind:'mist',position:[1900,1790],width:360},
    ],
    sounds: [
      {id:'camp-fire',kind:'fire',position:[750,2520],radius:430},
      {id:'camp-water',kind:'water',position:[450,2160],radius:720},
      {id:'crossing-water',kind:'water',position:[1900,1800],radius:720},
      {id:'mill-water',kind:'water',position:[3680,1640],radius:720},
      {id:'camp-wind',kind:'wind',position:[800,2360],radius:720},
      {id:'ridge-wind',kind:'wind',position:[1500,1400],radius:720},
      {id:'mill-wind',kind:'wind',position:[3280,1130],radius:720},
    ],
  },
  geometry: {
    entry: { x:650,y:2410 },
    floors: [
      { polygon:[[320,2310],[550,2150],[920,2170],[1140,2390],[1050,2700],[590,2810],[320,2600]] },
      { polygon:[[920,2370],[1120,2450],[1620,2100],[1490,1850]] },
      { polygon:[[1250,1800],[1500,1640],[1810,1750],[1830,2170],[1570,2300],[1320,2150]] },
      { polygon:rect(1700,1920,480,220) }, // timber crossing over the watercourse
      { polygon:[[2100,1700],[2400,1680],[2660,1890],[2600,2260],[2300,2400],[2020,2200],[1990,1950]] },
      { polygon:[[2400,1790],[2560,1940],[3220,1320],[3010,1120]] },
      { polygon:[[2880,750],[3180,570],[3630,640],[3850,980],[3740,1410],[3390,1600],[2960,1430],[2770,1120]] },
      // Optional ridge rejoins the mill approach; no forced quest gate.
      { polygon:[[1290,1850],[1520,1740],[1210,1260],[970,1360]] },
      { polygon:[[700,1230],[1020,1110],[1420,1190],[1500,1430],[1230,1640],[820,1580],[630,1400]] },
      { polygon:[[1280,1300],[1310,1500],[2380,1270],[2330,1030]] },
      { polygon:[[2100,890],[2480,790],[2750,1010],[2660,1300],[2270,1420],[2030,1170]] },
      { polygon:[[2580,1030],[2600,1220],[2960,1160],[2920,920]] },
    ],
    // Open mill shell: low walls are independent footprints; gaps are real doorways.
    buildings: [
      { footprint:rect(3250,700,330,38) }, { footprint:rect(3250,700,38,215) },
      { footprint:rect(3542,700,38,330) }, { footprint:rect(3390,992,190,38) },
      { footprint:rect(3250,972,38,58) },
    ],
    barriers: [
      {a:[1720,1920],b:[2100,1920],radius:7}, {a:[1720,2140],b:[2100,2140],radius:7},
    ],
    props: [], npcs: [],
  },
  paths: [
    {points:[[650,2410],[980,2430],[1450,2010],[1730,2030]],width:120},
    {points:[[1700,2030],[2140,2030]],width:220,bridge:true},
    {points:[[2100,2030],[2370,2020],[2650,1690],[3080,1220],[3360,1130],[3360,890]],width:120},
    {points:[[1450,1900],[1160,1400],[1600,1350],[2340,1120],[2830,1060],[3080,1220]],width:85},
  ],
  scenery,
  npcs: [
    {id:'tender',name:'Orren · Mill Tender',role:'quest',x:800,y:2380,r:18},
    {id:'cart',name:'Abandoned timber cart',role:'clue',x:2270,y:1970,r:24},
    {id:'ledger',name:'Mill ledger',role:'clue',x:3350,y:800,r:14},
    {id:'survey',name:'Survey marker',role:'clue',x:2440,y:990,r:14},
  ],
  portals:[{x:480,y:2440,to:'hearthmere',label:'Return to Hearthmere'},{x:3120,y:720,to:'bracken_sluice',label:'Upstream to Bracken Sluice'}],
  interactions:[
    {id:'tender',name:'Orren',x:800,y:2380,radius:110,kind:'person'},
    {id:'cart',name:'Abandoned timber cart',x:2270,y:1970,radius:110,kind:'cart'},
    {id:'ledger',name:'Mill ledger',x:3350,y:800,radius:110,kind:'ledger'},
    {id:'survey',name:'Survey marker',x:2440,y:990,radius:110,kind:'marker'},
  ],
  encounters:[
    {id:'road',x:1370,y:2030,members:[{type:'bog_slime',dx:0,dy:0},{type:'bog_slime',dx:90,dy:45},{type:'gloomshroom',dx:-60,dy:-90},{type:'gloomshroom',dx:100,dy:-80},{type:'bog_slime',dx:180,dy:25},{type:'thornling',dx:220,dy:-80}]},
      {id:'yard',x:2290,y:2150,members:[{type:'gloomshroom',dx:0,dy:0},{type:'bog_slime',dx:-100,dy:-10},{type:'bog_slime',dx:80,dy:50},{type:'reedclaw',dx:160,dy:-60},{type:'gloomshroom',dx:0,dy:100},{type:'grave_bat',dx:80,dy:-50}]},
    {id:'ridge',x:1070,y:1370,members:[{type:'grave_bat',dx:0,dy:0},{type:'grave_bat',dx:90,dy:10},{type:'gloomshroom',dx:140,dy:80},{type:'thornling',dx:-140,dy:-30},{type:'bog_slime',dx:-50,dy:110},{type:'gloomshroom',dx:0,dy:-100}]},
    {id:'overlook',x:2370,y:1110,members:[{type:'mossback',dx:0,dy:0},{type:'thornling',dx:150,dy:-80},{type:'bog_slime',dx:0,dy:110},{type:'bog_slime',dx:-130,dy:-40},{type:'grave_bat',dx:100,dy:60},{type:'gloomshroom',dx:-60,dy:40}]},
    {id:'mill',x:3210,y:1200,members:[{type:'mossback',dx:0,dy:0,tier:2,name:'Siltroot, the Wheelkeeper',questTarget:true},{type:'bog_slime',dx:-90,dy:-90},{type:'bog_slime',dx:110,dy:90},{type:'gloomshroom',dx:110,dy:-100},{type:'thornling',dx:230,dy:80}]},
  ],
  landmarks:[{name:'Tender’s Camp',x:680,y:2580},{name:'Timber Crossing',x:1900,y:2030},{name:'Abandoned Yard',x:2320,y:2230},{name:'Old Ridge',x:1100,y:1350},{name:'Rillwake Mill',x:3420,y:1130}],
  wheel:{x:3620,y:860,radius:38},
  locations:[{id:'old_ridge',x:1160,y:1400,radius:110}],
  routes:[
    [[650,2410],[900,2430],[1450,2010],[1700,2030],[2130,2030],[2350,2040],[2660,1680],[3050,1260],[3360,1130],[3340,940],[3340,850]],
    [[1450,1900],[1160,1400],[1600,1350],[2340,1120],[2820,1070],[3070,1230]],
    [[3070,1230],[3070,910],[3120,780]],
  ],
};
