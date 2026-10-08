import { CanvasSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { baselineY } from '@shared/townDepth';
import type { Point, TownBuilding, TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { beam, line, noise, path, polygon, stones, TOWN_INK, windowPane, type Paint } from './townPaint';

const DENSITY = 2, STRIP = 4;
type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** A face has its own baseline; the recess rear wall must not share the front wall's depth. */
export function bakeFace(bounds: Bounds, baseline: Point[], draw: (c: Paint) => void): MapLayers['sorted'] {
  const x0 = Math.floor(bounds.x0 - 4), y0 = Math.floor(bounds.y0 - 4);
  const w = Math.ceil(bounds.x1 + 4 - x0), h = Math.ceil(bounds.y1 + 4 - y0);
  const canvas = document.createElement('canvas'); canvas.width = w * DENSITY; canvas.height = h * DENSITY;
  const c = canvas.getContext('2d')!; c.scale(DENSITY, DENSITY); c.translate(-x0, -y0); draw(c);
  const source = new CanvasSource({ resource: canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: false });
  const sorted: MapLayers['sorted'] = [];
  const strip=baseline.every(p=>p[1]===baseline[0][1])?w:STRIP;
  let live = Math.ceil(w / strip);
  for (let x = 0; x < w; x += strip) {
    const width = Math.min(strip, w - x), depth = baselineY(baseline, x0 + x + width / 2);
    const texture = new Texture({ source, frame: new Rectangle(x, 0, width, h) });
    const view = new Sprite(texture); view.position.set(x0 + x, y0);
    view.on('destroyed', () => { texture.destroy(false); if (--live === 0) source.destroy(); });
    sorted.push({ view, y: depth, bounds: { x0: x0 + x, x1: x0 + x + width, y0, y1: y0 + h } });
  }
  return sorted;
}

function wall(c: Paint, a: Point, b: Point, height: number, style: NonNullable<TownBuilding['look']>['style'], seed: number, door: boolean) {
  // Orient the wall's local horizontal axis toward screen right. Vertical always projects upwards.
  const l = a[0] < b[0] ? a : b, r = a[0] < b[0] ? b : a;
  const dx = r[0]-l[0], dy = r[1]-l[1], len = Math.hypot(dx,dy);
  if (dx < .01) return;
  c.save(); c.transform(dx/len,dy/len,0,1,l[0],l[1]-height);
  c.beginPath();c.rect(0,0,len,height);c.clip();
  c.fillStyle = style==='inn' ? '#5c584b' : style==='forge'?'#4a4540':style==='mystic'?'#49404f':'#505346';c.fillRect(0,0,len,height);
  // Broken plaster patches, then raised stone foundation. All detail is deterministic and baked.
  for(let i=0;i<len/7;i++) {
    const x=noise(i,3,seed)*len, y=noise(i,5,seed)*height;
    polygon(c,[[x,y],[x+12,y-6],[x+26,y+2],[x+20,y+18],[x-6,y+12]],i%2?'rgba(39,43,39,.18)':'rgba(153,139,109,.12)');
  }
  const base = Math.min(height,style==='inn'?52:style==='forge'?88:42);
  c.save();c.translate(0,height-base);stones(c,len,base,seed);c.restore();
  const bays=Math.max(1,Math.round(len/(style==='inn'?91:76))), bay=len/bays;
  for(let i=0;i<=bays;i++)beam(c,[i*bay,0],[i*bay,height],7,style==='shack');
  beam(c,[0,height-base],[len,height-base],6);
  beam(c,[0,5],[len,5],9); beam(c,[0,height],[len,height],4);
  if(style==='jewel'||style==='mystic') {
    // Wooden counter beneath the artisan canopy; the entire stall remains solid.
    c.fillStyle='#292d2c';c.fillRect(9,13,len-18,Math.max(4,height-48));
    beam(c,[0,height-35],[len,height-35],9);
    for(let xx=22;xx<len-15;xx+=37)windowPane(c,xx,height-29,12,16,true);
  } else if(style==='forge') {
    // Raised, barred firebox reads as solid masonry rather than another walkable door.
    const x=len*.18,w=len*.5,top=34,bottom=height-35;
    c.fillStyle='#211e1c';c.fillRect(x,top,w,bottom-top);
    for(let i=0;i<13;i++) {
      const xx=x+8+noise(i,1,seed)*(w-16),yy=bottom-5-noise(i,2,seed)*14;
      polygon(c,[[xx-5,yy],[xx-2,yy-5],[xx+5,yy-2],[xx+3,yy+3]],i%3?'#9e552a':'#d09547',TOWN_INK,1.5);
    }
    for(let xx=x+9;xx<x+w;xx+=13)line(c,[[xx,top+2],[xx,bottom-1]],'#444743',3.5);
    beam(c,[x-4,top-4],[x+w+4,top-4],10);
    beam(c,[x-4,bottom+3],[x+w+4,bottom+3],10);
    line(c,[[x-3,top],[x-3,bottom]],'#75746a',7);
    line(c,[[x+w+3,top],[x+w+3,bottom]],'#62665e',7);
    for(let i=0;i<4;i++)line(c,[[len*.76+i*9,18],[len*.76+i*9,height-12]],'#2b2924',3);
  } else if (door) {
    const dw=Math.min(len-16,84), x=(len-dw)/2, top=height-110;
    polygon(c,[[x,height],[x,top+14],[x+12,top],[x+dw-12,top],[x+dw,top+14],[x+dw,height]],'#3c2c22',TOWN_INK,4);
    c.fillStyle='#c58a4d';c.fillRect(x+7,top+17,dw-14,93);
    c.fillStyle='#f5c67d';c.fillRect(x+10,top+19,dw*.5,91);
    // Open leaf on the inner jamb; recess itself remains walkable.
    polygon(c,[[x+dw-29,top+18],[x+dw-6,top+25],[x+dw-6,height],[x+dw-29,height-6]],'#725438',TOWN_INK,2);
    for(let yy=top+35;yy<height;yy+=30)line(c,[[x+dw-28,yy],[x+dw-7,yy+4]],'#252724',3);
    beam(c,[x-3,top+10],[x-3,height],7,true);beam(c,[x+dw+3,top+10],[x+dw+3,height],7,true);
    beam(c,[x-3,top+10],[x+12,top-4],7,true);beam(c,[x+12,top-4],[x+dw-12,top-4],7,true);beam(c,[x+dw-12,top-4],[x+dw+3,top+10],7,true);
  } else for(let i=0;i<bays;i++) {
    const x=i*bay;
    if (style==='inn' && bay>60 && height>130) {
      windowPane(c,x+bay*.29,31,bay*.36,47,(i+seed)%3!==0);
      beam(c,[x+7,10],[x+bay-7,26],4);
      beam(c,[x+7,height-base-7],[x+bay*.34,height-base-34],5);
    } else {
      beam(c,[x+7,10],[x+bay-7,height-base-7],5,true);
      if(i===1&&bay>55)windowPane(c,x+bay*.3,22,22,28,true);
      for(let yy=12;yy<height-base;yy+=13)line(c,[[x+8,yy],[x+bay-8,yy+2]],'rgba(31,34,30,.35)',1.2);
    }
  }
  c.restore();
  line(c,[a,b],TOWN_INK,2.5);
}

function roof(c: Paint,b: TownBuilding) {
  const spec=b.look!.roof;
  const faces=spec.faces.map((ids,i)=>({ids,i,y:ids.reduce((s,j)=>s+spec.vertices[j][1],0)/ids.length})).sort((a,b)=>a.y-b.y);
  for(const face of faces) {
    const points=face.ids.map(i=>[spec.vertices[i][0],spec.vertices[i][1]-spec.vertices[i][2]] as Point);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    c.save();path(c,points);c.clip();c.fillStyle=b.look!.roofColor??'#293337';c.fillRect(left,top,right-left,bottom-top);
    const cloth=b.look!.style==='jewel'||b.look!.style==='mystic';
    // Shingle courses follow the dominant eave slope; no screen-axis checkerboard.
    const a=spec.vertices[face.ids[0]],z=spec.vertices[face.ids[1]],slope=(z[1]-z[2]-a[1]+a[2])/(z[0]-a[0]||1);
    const m=Math.max(-.65,Math.min(.65,slope));
    c.translate(left,top);c.transform(1,m,0,1,0,0);
    const span=right-left, range=bottom-top+Math.abs(m)*span;
    if(cloth) {
      for(let xx=0;xx<span;xx+=25) {c.fillStyle=(xx/25)%2?'rgba(21,23,27,.20)':'rgba(189,178,141,.13)';c.fillRect(xx,-span,12,span+range);}
    } else for(let row=-Math.ceil(span/12);row<range/13+2;row++)for(let col=-1;col<span/23+1;col++) {
      const n=noise(col,row,face.i+17), x=col*23+(row%2)*11.5,y=row*13;
      const v=Math.round((b.look!.style==='inn'?43:46)+n*15);
      const tone=b.look!.roofColor?parseInt(b.look!.roofColor.slice(1),16):null;
      const color=tone===null?`rgb(${v-8},${v+2},${v+6})`:`rgb(${(tone>>16&255)-12+n*14},${(tone>>8&255)-12+n*14},${(tone&255)-12+n*14})`;
      polygon(c,[[x+1,y],[x+21,y-1],[x+22,y+12+n*3],[x+13,y+14],[x,y+12]],b.look!.style==='cellar'?'#655b47':color,'#20282c',1);
      line(c,[[x+2,y+11],[x+13,y+13],[x+21,y+11+n*3]],`rgba(151,164,153,${.14+n*.15})`,1);
      if(n>.78)line(c,[[x+7,y+3],[x+6,y+10]],'#1f292d',.8);
      if(n>.9)polygon(c,[[x+3,y+12],[x+6,y+8],[x+12,y+13]],'#4b5843');
    }
    c.restore();path(c,points);c.strokeStyle=TOWN_INK;c.lineWidth=3;c.stroke();
    line(c,[points[0],points[1]],'#768075',2);
  }
  // Ridged cap timbers define the original silhouette at normal camera scale.
  const ridges=spec.vertices.filter(v=>v[2]>b.look!.eaveHeight+30);
  if(ridges.length===2)beam(c,[ridges[0][0],ridges[0][1]-ridges[0][2]],[ridges[1][0],ridges[1][1]-ridges[1][2]],7,true);
  if(b.look!.dormer) {
    const d=b.look!.dormer,[x,gy]=d.position,y=gy-d.elevation,w=d.width;
    // Small gabled dormer interrupts the main roof; its own proportions/textures are original.
    polygon(c,[[x-w/2,y],[x-w/2,y-54],[x,y-85],[x+w/2,y-54],[x+w/2,y]],'#655e4d',TOWN_INK,3);
    windowPane(c,x-w*.24,y-49,w*.48,40,true);
    beam(c,[x-w/2,y-54],[x,y-85],5,true);beam(c,[x,y-85],[x+w/2,y-54],5,true);
    beam(c,[x-w/2-3,y],[x+w/2+3,y],5);
    polygon(c,[[x-w/2-8,y-53],[x,y-91],[x+28,y-112],[x-w/2+21,y-77]],'#394447',TOWN_INK,3);
    for(let i=0;i<4;i++)line(c,[[x-w/2-4+i*10,y-56-i*8],[x-w/2+23+i*10,y-80-i*8]],'#58645f',1.3);
  }
  if(['jewel','mystic','cellar'].includes(b.look!.style))return;
  const ch=b.look!.chimney, [x,y]=ch.position, h=ch.height;
  polygon(c,[[x-18,y-h+24],[x+13,y-h+32],[x+13,y-h+92],[x-18,y-h+83]],'#69645a',TOWN_INK,2.5);
  polygon(c,[[x+13,y-h+32],[x+26,y-h+17],[x+26,y-h+77],[x+13,y-h+92]],'#454b49',TOWN_INK,2);
  for(let i=0;i<4;i++)line(c,[[x-17,y-h+37+i*13],[x+12,y-h+45+i*13],[x+25,y-h+31+i*13]],'#353937',2);
  polygon(c,[[x-23,y-h+24],[x-7,y-h+7],[x+31,y-h+17],[x+14,y-h+37]],'#777567',TOWN_INK,3);
  polygon(c,[[x-13,y-h+23],[x-5,y-h+15],[x+19,y-h+20],[x+12,y-h+28]],'#202425');
}

function innSign(c: Paint, height: number) {
  // Original wren-and-wick emblem, anchored on the inn's solid right jamb.
  beam(c,[0,0],[0,-height],8);
  beam(c,[-3,3-height],[43,3-height],7);
  line(c,[[11,7-height],[11,21-height]],'#8a805f',2);line(c,[[33,7-height],[33,21-height]],'#8a805f',2);
  polygon(c,[[4,20-height],[41,20-height],[43,54-height],[21,62-height],[2,54-height]],'#464e49','#a19266',2);
  c.fillStyle='#d4bb7c';c.beginPath();c.ellipse(18,37-height,9,5,-.2,0,Math.PI*2);c.fill();
  polygon(c,[[10,36-height],[5,28-height],[13,33-height]],'#d4bb7c');polygon(c,[[24,34-height],[33,34-height],[26,38-height]],'#d4bb7c');
  line(c,[[21,42-height],[21,48-height]],'#d4bb7c',2);line(c,[[11,50-height],[32,50-height]],'#d4bb7c',2);
}

export function townBuildings(t: TownData): MapLayers['sorted'] {
  const out: MapLayers['sorted']=[];
  for(const b of t.buildings) {
    if(!b.look)continue;
    const start=out.length;
    const p=b.footprint,h=b.look.eaveHeight;
    for(let i=0;i<p.length;i++) {
      const a=p[i],z=p[(i+1)%p.length]; if(z[0]>=a[0])continue;
      out.push(...bakeFace({x0:Math.min(a[0],z[0]),x1:Math.max(a[0],z[0]),y0:Math.min(a[1],z[1])-h,y1:Math.max(a[1],z[1])},[a,z],c=>wall(c,a,z,h,b.look!.style,i,i===b.look!.doorFace)));
    }
    const vs=b.look.roof.vertices;
    out.push(...bakeFace({x0:Math.min(...vs.map(v=>v[0])),x1:Math.max(...vs.map(v=>v[0])),y0:Math.min(...vs.map(v=>v[1]-v[2]),b.look.chimney.position[1]-b.look.chimney.height),y1:Math.max(...vs.map(v=>v[1]-v[2]))+12},b.baseline,c=>roof(c,b)));
    if(b.look.sign) {
      const s=b.look.sign,[x,y]=s.position;
      out.push(...bakeFace({x0:x-7,x1:x+47,y0:y-s.height-4,y1:y+5},[[x-7,y+12],[x+47,y+12]],c=>{c.save();c.translate(x,y);innSign(c,s.height);c.restore();}));
    }
    if(b.interior)for(let i=start;i<out.length;i++)out[i].building=b.id;
  }
  return out;
}
