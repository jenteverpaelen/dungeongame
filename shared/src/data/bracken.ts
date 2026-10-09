import type { AdventureData } from '../adventureTypes';
import type { Point } from '../townTypes';
import type { Prop } from '../mapgen';

const rect=(x:number,y:number,w:number,h:number):Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const scenery:Prop[]=[];
const row=(k:string,points:Point[],r:number,s=1)=>points.forEach(([x,y],v)=>scenery.push({k,x,y,r,s,v}));
row('pine',[[490,2550],[600,2860],[1040,2850],[1120,2550],[1420,2440],[1670,2490],[1940,2340],[2150,2400],[2350,2370],[2500,2390],[2780,2230],[3070,1830],[3200,1530],[3180,980],[2660,570],[2080,650],[1750,1090],[1490,1290],[1210,1410],[560,1670]],20,1.35);
row('boulder',[[690,2310],[1310,2520],[1620,2170],[1970,2230],[2900,1860],[1880,1310],[2180,890],[2860,730]],29);
row('stump',[[1130,2110],[2870,1420],[1870,1810]],17);
row('crate',[[830,2600],[870,2550],[1630,1810],[1650,1850]],17);
row('lantern',[[970,2630],[1160,2310],[2230,1870],[2350,1410],[2450,940]],6);

/** Original maintenance causeway and spillway basin; geometry is also the collision source. */
export const BRACKEN:AdventureData={
  id:'bracken_sluice',size:[56,48],
  ambience:{
    motion:[
      {id:'causeway-upstream',kind:'ripples',position:[1940,1850],width:70},
      {id:'causeway-downstream',kind:'ripples',position:[1940,2390],width:70},
      {id:'bank-reeds',kind:'reeds',position:[1820,2310],width:32},
      {id:'forecourt-reeds',kind:'reeds',position:[2190,1770],width:32},
      {id:'basin-mist',kind:'mist',position:[1940,2350],width:360},
    ],
    sounds:[
      {id:'causeway-water',kind:'water',position:[1940,1850],radius:720},
      {id:'spillway-water',kind:'water',position:[2910,650],radius:720},
      {id:'camp-wind',kind:'wind',position:[790,2720],radius:720},
      {id:'basin-wind',kind:'wind',position:[2450,2100],radius:720},
      {id:'forecourt-wind',kind:'wind',position:[2590,1240],radius:720},
    ],
  },
  geometry:{entry:{x:790,y:2720},floors:[
    {polygon:[[450,2470],[820,2310],[1170,2510],[1090,2870],[690,2980],[430,2780]]},
    {polygon:[[890,2420],[1070,2620],[1630,2230],[1450,1980]]},
    {polygon:[[1240,1900],[1540,1720],[1830,1910],[1780,2370],[1400,2530],[1110,2250]]},
    {polygon:rect(1670,1990,550,230)},
    {polygon:[[2100,1790],[2440,1660],[2810,1850],[2850,2240],[2480,2490],[2080,2290]]},
    {polygon:[[2300,1800],[2530,1950],[2740,1350],[2500,1160]]},
    {polygon:[[1990,940],[2260,650],[2770,650],[3180,1000],[3210,1530],[2960,1820],[2280,1690],[1830,1380]]},
    // An optional bank route loops back into the forecourt.
    {polygon:[[1190,1940],[1380,2090],[1230,1560],[960,1550]]},
    {polygon:[[650,1430],[1020,1320],[1370,1490],[1400,1740],[1080,1930],[660,1740]]},
    {polygon:[[1280,1510],[1350,1730],[2220,1460],[2130,1190]]},
  ],buildings:[
    {footprint:rect(2330,730,50,330)},{footprint:rect(2760,730,50,330)},
    {footprint:rect(2330,730,480,45)},
  ],barriers:[{a:[1720,1990],b:[2150,1990],radius:7},{a:[1720,2220],b:[2150,2220],radius:7}],props:[],npcs:[]},
  paths:[
    {points:[[790,2720],[1050,2500],[1500,2110],[1680,2100]],width:120},
    {points:[[1670,2100],[2210,2100]],width:230,bridge:true},
    {points:[[2180,2100],[2490,2090],[2540,1650],[2590,1240],[2560,910]],width:125},
    {points:[[1310,2070],[1150,1620],[1660,1500],[2190,1330],[2520,1310]],width:85},
  ],scenery,
  npcs:[{id:'floodgate',name:'Floodgate mechanism',role:'clue',x:2540,y:840,r:18}],
  interactions:[{id:'floodgate',name:'Floodgate mechanism',x:2540,y:840,radius:110,kind:'mechanism'}],
  portals:[{x:630,y:2760,to:'rillwake_crossing',label:'Back to Rillwake Crossing'},{x:2790,y:1590,to:'reedvault_pumpworks',label:'Reedvault Pumpworks · solo dungeon'},{x:2850,y:1150,to:'cairnspill_terraces',label:'Cairnspill Terraces'}],
  locations:[{id:'forecourt',x:2540,y:1650,radius:110}],
  encounters:[
    {id:'causeway',x:1510,y:2130,members:[{type:'thornling',dx:0,dy:0},{type:'bog_slime',dx:80,dy:90},{type:'gloomshroom',dx:-100,dy:-70},{type:'grave_bat',dx:120,dy:-120},{type:'bog_slime',dx:-100,dy:100}]},
    {id:'basin',x:2490,y:2160,members:[{type:'siltusk',dx:0,dy:0},{type:'gloomshroom',dx:-130,dy:-30},{type:'thornling',dx:110,dy:100},{type:'bog_slime',dx:100,dy:-100},{type:'grave_bat',dx:-160,dy:60}]},
    {id:'bank',x:1020,y:1620,members:[{type:'grave_bat',dx:0,dy:0},{type:'grave_bat',dx:100,dy:-40},{type:'reedclaw',dx:-120,dy:50},{type:'bog_slime',dx:70,dy:110}]},
    {id:'keeper',x:2590,y:1210,members:[{type:'mossback',dx:0,dy:0,tier:2,name:'The Rootbound Keeper',questTarget:true,combat:'keeper'}]},
  ],
  landmarks:[{name:'Maintenance Camp',x:790,y:2860},{name:'Sluice Causeway',x:1930,y:2100},{name:'Flooded Basin',x:2520,y:2300},{name:'Spillway Forecourt',x:2510,y:1590}],
  wheel:{x:2840,y:920,radius:38},
  routes:[
    [[790,2720],[1050,2500],[1500,2110],[1680,2100],[2210,2100],[2490,2090],[2540,1650],[2590,1240],[2540,910]],
    [[1310,2070],[1150,1620],[1660,1500],[2190,1330],[2520,1310]],
    [[790,2720],[670,2760]],
    [[2540,1650],[2730,1590]],
    [[2590,1240],[2850,1150]],
  ],
};
