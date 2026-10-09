import type { AdventureData } from '../adventureTypes';
import type { Point } from '../townTypes';

const rect=(x:number,y:number,w:number,h:number):Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const west=rect(390,1120,640,640),east=rect(1510,1120,640,640),heart=rect(950,270,640,640);
/** Original masonry service chambers. L89: camera-scale rooms and existing Bracken passage/group sizes. */
export const PUMPWORKS:AdventureData={
  id:'reedvault_pumpworks',surface:'masonry',size:[40,36],
  ambience:{
    motion:[
      {id:'intake-water',kind:'ripples',position:[970,2110],width:38},
      {id:'west-drip',kind:'drips',position:[320,1430],width:32},
      {id:'east-drip',kind:'drips',position:[2220,1430],width:32},
      {id:'central-channel',kind:'ripples',position:[1270,1400],width:70},
      {id:'channel-mist',kind:'mist',position:[1270,1550],width:180},
    ],
    sounds:[
      {id:'intake-water',kind:'water',position:[970,2110],radius:720},
      {id:'west-water',kind:'water',position:[320,1430],radius:720},
      {id:'east-water',kind:'water',position:[2220,1430],radius:720},
      {id:'pump-water',kind:'water',position:[1270,180],radius:720},
    ],
  },
  geometry:{entry:{x:1270,y:2050},floors:[
    {polygon:rect(1050,1870,440,310)},
    {polygon:rect(600,1760,1340,230)},
    {polygon:rect(600,1590,230,320)},{polygon:rect(1710,1590,230,320)},
    {polygon:west},{polygon:east},
    {polygon:rect(850,860,230,470)},{polygon:rect(1450,860,230,470)},
    {polygon:rect(850,800,830,230)},{polygon:heart},
  ],buildings:[
    {footprint:rect(390,1120,180,36)},{footprint:rect(390,1156,36,300)},
    {footprint:rect(1970,1120,180,36)},{footprint:rect(2114,1156,36,300)},
    {footprint:rect(950,270,640,36)},
  ],barriers:[],props:[],npcs:[]},
  paths:[],
  scenery:[
    {k:'crate',x:1080,y:2070,r:17,s:1,v:0},{k:'crate',x:1115,y:2100,r:17,s:1,v:1},
    {k:'lantern',x:1100,y:1950,r:6,s:1,v:0},{k:'lantern',x:470,y:1560,r:6,s:1,v:0},
    {k:'lantern',x:2070,y:1560,r:6,s:1,v:0},{k:'lantern',x:1020,y:690,r:6,s:1,v:0},
    {k:'lantern',x:1520,y:690,r:6,s:1,v:0},
  ],
  npcs:[
    {id:'west_wheel',name:'West pressure wheel',role:'clue',x:520,y:1470,r:18},
    {id:'east_wheel',name:'East pressure wheel',role:'clue',x:2020,y:1470,r:18},
    {id:'pump_crank',name:'Main pump crank',role:'clue',x:1270,y:780,r:18},
    {id:'work_record',name:'Maintenance record',role:'clue',x:1460,y:420,r:18},
  ],
  interactions:[
    {id:'west_wheel',name:'West pressure wheel',x:520,y:1470,radius:110,kind:'mechanism'},
    {id:'east_wheel',name:'East pressure wheel',x:2020,y:1470,radius:110,kind:'mechanism'},
    {id:'pump_crank',name:'Main pump crank',x:1270,y:780,radius:110,kind:'mechanism'},
    {id:'work_record',name:'Maintenance record',x:1460,y:420,radius:110,kind:'ledger'},
  ],
  portals:[{x:1270,y:2120,to:'bracken_sluice',label:'Return to Bracken Sluice'}],
  locations:[],
  encounters:[
    {id:'west_chamber',x:740,y:1390,members:[{type:'grave_bat',dx:0,dy:0},{type:'grave_bat',dx:100,dy:-40},{type:'reedclaw',dx:-120,dy:50},{type:'bog_slime',dx:70,dy:110}]},
    {id:'east_chamber',x:1780,y:1390,members:[{type:'mossback',dx:0,dy:0},{type:'gloomshroom',dx:-130,dy:-30},{type:'thornling',dx:110,dy:100},{type:'bog_slime',dx:100,dy:-100},{type:'grave_bat',dx:-160,dy:60}]},
    {id:'pump_heart',x:1270,y:520,members:[{type:'mossback',dx:0,dy:0,tier:2,name:'The Sumpbound Keeper',combat:'keeper'}]},
  ],
  dungeon:{stages:[
    {id:'west',trigger:'west_wheel',encounter:'west_chamber',area:west},
    {id:'east',trigger:'east_wheel',encounter:'east_chamber',area:east},
    {id:'heart',trigger:'pump_crank',encounter:'pump_heart',area:heart},
  ]},
  landmarks:[{name:'Intake Stairs',x:1270,y:2000},{name:'West Filter',x:740,y:1550},{name:'East Filter',x:1780,y:1550},{name:'Pump Heart',x:1270,y:600}],
  wheel:{x:1100,y:420,radius:38},
  routes:[
    [[1270,2050],[1270,1875],[715,1875],[715,1600],[740,1390],[590,1470]],
    [[715,1875],[1825,1875],[1825,1600],[1780,1390],[1950,1470]],
    [[740,1390],[965,1230],[965,915],[1330,915],[1330,720],[1270,650],[1270,520],[1410,470]],
    [[1780,1390],[1565,1230],[1565,915],[1270,915]],
    [[1270,2050],[1270,2080]],
  ],
};
