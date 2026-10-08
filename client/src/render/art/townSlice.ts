import { CanvasSource, Container, Graphics, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import { groundBoundary, inPolygon, type Edge } from '@shared/townGeometry';
import type { Point, TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { buildTownBlockout } from './townBlockout';
import { townBuildings } from './townBuildings';
import { townProps } from './townProps';
import { glowSprite, flameSprite } from './fx';
import { field, line, noise, path, polygon, type Paint } from './townPaint';

const CHUNK=512, DENSITY=1.5, MAX_CHUNKS=36;

/** Bounded, camera-prefetched ground textures for the full authored town. */
class SliceGround extends Container {
  bakeMs=0;
  baked=0;
  private tiles = new Map<string, { sprite: Sprite; x: number; y: number; used: number }>();
  private matrix=new Matrix();
  private wanted: [number,number][]=[];
  private serial=0;
  private capacity=MAX_CHUNKS;
  private candidates:[number,number][]=[];
  private window=[Infinity,Infinity,Infinity,Infinity];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private edges: Edge[];
  constructor(private t: TownData) {
    super();
    this.edges=groundBoundary(t);
    const cx=Math.floor(t.entry.x/CHUNK),cy=Math.floor(t.entry.y/CHUNK);
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)this.bake(x,y);
    this.onRender=(r:Renderer)=>{
      const m=this.getGlobalTransform(this.matrix,false),s=r.screen;
      const minX=Math.floor(-m.tx/m.a/CHUNK),minY=Math.floor(-m.ty/m.d/CHUNK);
      const maxX=Math.floor((s.width-m.tx)/m.a/CHUNK),maxY=Math.floor((s.height-m.ty)/m.d/CHUNK);
      this.wanted.length=0;this.serial++;
      // Spell framing may expose more than 36 chunks. Keep all visible terrain, capped
      // by the town's 12×8 chunks, then return to the normal cache as the camera closes.
      const cols=Math.ceil(t.size[0]*64/CHUNK),rows=Math.ceil(t.size[1]*64/CHUNK);
      const visible=(Math.min(cols-1,maxX)-Math.max(0,minX)+1)*(Math.min(rows-1,maxY)-Math.max(0,minY)+1);
      this.capacity=Math.max(MAX_CHUNKS,Math.min(cols*rows,visible));
      const candidates=this.candidates;
      if(minX!==this.window[0]||minY!==this.window[1]||maxX!==this.window[2]||maxY!==this.window[3]) {
        this.window[0]=minX;this.window[1]=minY;this.window[2]=maxX;this.window[3]=maxY;candidates.length=0;
        for(let y=minY-1;y<=maxY+1;y++)for(let x=minX-1;x<=maxX+1;x++) {
          if(x>=0&&y>=0&&x<cols&&y<rows)candidates.push([x,y]);
        }
        const rank=(p:[number,number])=>(p[0]>=minX&&p[0]<=maxX&&p[1]>=minY&&p[1]<=maxY?0:1000)+Math.abs(p[0]-(minX+maxX)/2)+Math.abs(p[1]-(minY+maxY)/2);
        candidates.sort((a,b)=>rank(a)-rank(b));candidates.length=Math.min(candidates.length,this.capacity);
      }
      for(const p of candidates){const tile=this.tiles.get(`${p[0]},${p[1]}`);if(tile)tile.used=this.serial;else this.wanted.push(p);}
      for(const tile of this.tiles.values()) {
        const x=tile.x*m.a+m.tx,y=tile.y*m.d+m.ty;
        tile.sprite.visible=x<s.width&&x+CHUNK*m.a>0&&y<s.height&&y+CHUNK*m.d>0;
      }
      while(this.tiles.size>this.capacity)if(!this.evict())break;
      if(this.wanted.length&&!this.timer)this.timer=setTimeout(()=>this.prefetch(),1);
    };
    this.on('destroyed',()=>{if(this.timer)clearTimeout(this.timer);this.tiles.clear();});
  }
  private prefetch() {
    this.timer=undefined;if(this.destroyed)return;
    const next=this.wanted.shift();if(next)this.bake(...next);
    if(this.wanted.length)this.timer=setTimeout(()=>this.prefetch(),8);
  }
  private bake(col:number,row:number) {
    const key=`${col},${row}`;if(this.tiles.has(key))return;
    if(this.tiles.size>=this.capacity&&!this.evict())return;
    const began=performance.now();
    const x=col*CHUNK,y=row*CHUNK,canvas=document.createElement('canvas');canvas.width=canvas.height=CHUNK*DENSITY;
    const c=canvas.getContext('2d')!;c.scale(DENSITY,DENSITY);c.translate(-x,-y);
    paintGround(c,this.t,x,y,this.edges);
    const texture=new Texture({source:new CanvasSource({resource:canvas,resolution:DENSITY,scaleMode:'linear',autoGenerateMipmaps:true})});
    const sprite=new Sprite(texture);sprite.position.set(x,y);this.addChild(sprite);this.tiles.set(key,{sprite,x,y,used:this.serial});
    sprite.on('destroyed',()=>texture.destroy(true));
    this.bakeMs+=performance.now()-began;this.baked++;
  }
  private evict():boolean {
    let oldest:string|undefined,age=Infinity;
    for(const [k,v] of this.tiles)if(!v.sprite.visible&&v.used<age){oldest=k;age=v.used;}
    if(!oldest)return false;
    this.tiles.get(oldest)!.sprite.destroy();this.tiles.delete(oldest);return true;
  }
}

function paintGround(c:Paint,t:TownData,x0:number,y0:number,allEdges:Edge[]) {
  const touches=(p:readonly Point[],pad=0)=>Math.max(...p.map(v=>v[0]))>=x0-pad&&Math.min(...p.map(v=>v[0]))<=x0+CHUNK+pad&&Math.max(...p.map(v=>v[1]))>=y0-pad&&Math.min(...p.map(v=>v[1]))<=y0+CHUNK+pad;
  const regions=(t.landscape??[]).filter(r=>touches(r.polygon,4));
  // Sample a continuous world field, with a one-pixel gutter for seamless interpolation.
  const terrain=document.createElement('canvas'),step=4,side=CHUNK/step+2;
  terrain.width=terrain.height=side;
  const tc=terrain.getContext('2d')!,tp=tc.createImageData(side,side);
  for(let py=0;py<side;py++)for(let px=0;px<side;px++) {
    const x=x0+(px-1)*step,y=y0+(py-1)*step;
    const region=regions.find(r=>inPolygon(x,y,r.polygon));
    const water=region?.kind==='water',ash=region?.kind==='ash';
    const v=field(x/160,y/130,39)*10+field(x/(water?130:24),y/(water?12:26),41)*5;
    const i=(py*side+px)*4,base=water?[29,45,51]:ash?[50,46,41]:[30,40,32];
    for(let k=0;k<3;k++)tp.data[i+k]=base[k]+v;tp.data[i+3]=255;
  }
  tc.putImageData(tp,0,0);c.drawImage(terrain,x0-step,y0-step,side*step,side*step);
  const edges=allEdges.filter(e=>Math.max(e.ax,e.bx)>x0-40&&Math.min(e.ax,e.bx)<x0+CHUNK+40&&Math.max(e.ay,e.by)>y0-40&&Math.min(e.ay,e.by)<y0+CHUNK+40);
  for(const e of edges) {
    // Visible bank ends exactly at the shared collision edge; height is projected outwards.
    const a:[number,number]=[e.ax,e.ay],b:[number,number]=[e.bx,e.by];
    polygon(c,[a,b,[e.bx-e.nx*17,e.by-e.ny*17+15],[e.ax-e.nx*17,e.ay-e.ny*17+15]],'#202b29');
    line(c,[a,b],'#69705b',4);
  }
  const floors=new Path2D();
  for(const f of t.floors){
    if(!touches(f.polygon))continue;
    // Match winding before nonzero clipping: overlapping roads must form a union, not cancel.
    const area=f.polygon.reduce((s,p,i)=>{const q=f.polygon[(i+1)%f.polygon.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    const ring=area<0?[...f.polygon].reverse():f.polygon;
    ring.forEach((p,i)=>i?floors.lineTo(...p):floors.moveTo(...p));floors.closePath();
  }
  c.save();c.clip(floors);
  // A continuous soil field crosses chunk boundaries. No repeated texture stamp or hard patch discs.
  const soil=document.createElement('canvas');soil.width=soil.height=CHUNK/4;
  const sc=soil.getContext('2d')!,pixels=sc.createImageData(CHUNK/4,CHUNK/4);
  for(let y=0;y<CHUNK/4;y++)for(let x=0;x<CHUNK/4;x++) {
    const wx=x0+x*4,wy=y0+y*4,broad=field(wx/190,wy/160,67),fine=field(wx/28,wy/24,91),grain=noise(wx,wy,8)*2;
    const i=(y*CHUNK/4+x)*4;
    pixels.data[i]=43+broad*19+fine*5+grain;pixels.data[i+1]=45+broad*15+fine*4+grain;pixels.data[i+2]=47+broad*9+fine*4+grain;pixels.data[i+3]=255;
  }
  sc.putImageData(pixels,0,0);c.drawImage(soil,x0,y0,CHUNK,CHUNK);
  const seed=t.lookSlice!.seed;
  for(let row=Math.floor(y0/15)-1;row<Math.ceil((y0+CHUNK)/15)+1;row++)for(let col=Math.floor(x0/25)-1;col<Math.ceil((x0+CHUNK)/25)+1;col++) {
    const n=noise(col,row,seed),x=col*25+(row%2)*12.5+noise(col,row,8)*5,y=row*15+noise(col,row,9)*4;
    // Leave earthen margins beside the real boundary rather than drawing stones to a tiled rectangle.
    let gap=100;
    for(const e of edges) {
      const dx=e.bx-e.ax,dy=e.by-e.ay,along=Math.max(0,Math.min(1,((x-e.ax)*dx+(y-e.ay)*dy)/(dx*dx+dy*dy)));
      gap=Math.min(gap,Math.hypot(x-e.ax-along*dx,y-e.ay-along*dy));
    }
    const worn=field(x/150,y/125,46),spread=field(x/54,y/43,119);
    if(gap<8+n*22||n<.11+Math.max(0,.52-worn)*1.2)continue;
    c.globalAlpha=Math.min(1,.25+worn*.85+spread*.1);
    const v=Math.round(60+n*12),w=17+n*6,h=10+noise(row,col,4)*3;
    if(x<1510&&y>1300)continue;
    if(y<1250&&n<.4||x>4350&&n<.6)continue;
    polygon(c,[[x+4,y],[x+w-4,y-1],[x+w,y+3],[x+w-2,y+h-2],[x+4,y+h],[x,y+h-3],[x+1,y+3]],`rgb(${v+2},${v+2},${v+1})`,'rgba(28,31,32,.32)',.8);
    line(c,[[x+4,y+1],[x+w-5,y]],'rgba(147,146,131,.16)',.7);
    if(n>.84)line(c,[[x+w*.7,y],[x+w*.56,y+4],[x+w*.59,y+h]],'rgba(28,32,32,.55)',.8);
  }
  c.globalAlpha=1;
  // Continuous pier decking, clipped to the exact road union. Courses are world anchored.
  c.save();c.beginPath();c.rect(0,1300,1510,2200);c.clip();
  c.fillStyle='#514a39';c.fillRect(x0,y0,CHUNK,CHUNK);
  for(let row=Math.floor((y0-CHUNK*.2)/19)-8;row<(y0+CHUNK)/19+8;row++) {
    const yy=row*19,n=noise(row,0,72);
    line(c,[[x0-20,yy+x0*.12],[x0+CHUNK+20,yy+(x0+CHUNK+20)*.12]],'#292e29',2);
    line(c,[[x0-20,yy+2+x0*.12],[x0+CHUNK+20,yy+2+(x0+CHUNK+20)*.12]],'rgba(151,131,91,.25)',1);
    for(let col=Math.floor(x0/130)-1;col<(x0+CHUNK)/130+1;col++) {
      const xx=col*130+(row%2)*65;
      line(c,[[xx,yy+xx*.12],[xx,yy+18+xx*.12]],'#33352a',1.5);
      line(c,[[xx+9,yy+7+xx*.12],[xx+65+n*40,yy+8+(xx+65+n*40)*.12]],'rgba(30,34,28,.22)',.8);
    }
  }
  c.restore();
  for(let i=0;i<900;i++) {
    const x=x0+noise(i,x0,33)*CHUNK,y=y0+noise(i,y0,34)*CHUNK;
    c.fillStyle=i%2?'rgba(143,131,108,.08)':'rgba(22,31,33,.12)';c.fillRect(x,y,1.5, .7);
  }
  for(const b of t.buildings.filter(b=>b.look)) {
    if(!touches(b.footprint,100))continue;
    // All projected shadows share the existing upper-left key direction.
    const shift=b.look!.eaveHeight*.22;
    c.save();c.globalAlpha=t.lighting?.strength??.28;c.shadowColor='#111b22';c.shadowBlur=12;
    polygon(c,b.footprint.map(p=>[p[0]+shift,p[1]+shift*.8] as Point),'#101a20');
    for(let i=0;i<b.footprint.length;i++) {
      const a=b.footprint[i],z=b.footprint[(i+1)%b.footprint.length];
      polygon(c,[a,z,[z[0]+shift,z[1]+shift*.8],[a[0]+shift,a[1]+shift*.8]],'#101a20');
    }
    c.restore();
    path(c,b.footprint);c.strokeStyle='rgba(17,20,20,.44)';c.lineWidth=12;c.stroke();
    // Loose leaves collect beside foundations, never across the main navigation sightline.
    for(let i=0;i<100;i++) {
      const a=b.footprint[i%b.footprint.length],z=b.footprint[(i+1)%b.footprint.length],s=noise(i,4,seed);
      const x=a[0]+(z[0]-a[0])*s+(noise(i,6,seed)-.5)*58,y=a[1]+(z[1]-a[1])*s+(noise(i,7,seed)-.5)*52;
      polygon(c,[[x-2,y],[x,y-2],[x+4,y+1],[x+1,y+3]],i%3?'#686043':'#836a44');
    }
  }
  for(const p of t.props) {
    if(Math.abs(p.x-x0-CHUNK/2)>CHUNK/2+p.radius+(p.height??32)||Math.abs(p.y-y0-CHUNK/2)>CHUNK/2+p.radius+30)continue;
    c.save();c.shadowBlur=9;c.shadowColor='#101b20';c.fillStyle='rgba(14,22,24,.32)';
    c.beginPath();c.ellipse(p.x+(p.height??32)*.1,p.y+8,p.radius+(p.height??32)*.12,p.radius*.55,.35,0,Math.PI*2);c.fill();c.restore();
  }
  for(const b of t.barriers)line(c,[b.a,b.b,[b.b[0]+14,b.b[1]+11],[b.a[0]+14,b.a[1]+11]],'rgba(14,22,24,.25)',8);
  const wp=t.npcs.find(n=>n.role==='waypoint');
  if(wp) {
    for(const r of [105,94,75]){c.beginPath();c.ellipse(wp.x,wp.y,r,r*71/105,0,0,Math.PI*2);c.strokeStyle=r===105?'#77796a':'#535f59';c.lineWidth=r===105?4:2;c.stroke();}
    for(let i=0;i<20;i++){const a=i*Math.PI/10;line(c,[[wp.x+Math.cos(a)*94,wp.y+Math.sin(a)*64],[wp.x+Math.cos(a)*105,wp.y+Math.sin(a)*71]],'#353f3a',2);}
  }
  for(const l of t.lights) {
    const [x,y]=l.position,r=l.radius;
    if(x+r<x0||x-r>x0+CHUNK||y+r<y0||y-r>y0+CHUNK)continue;
    const glow=c.createRadialGradient(x,y,8,x,y,r);
    const rgb=`${l.color>>16&255},${l.color>>8&255},${l.color&255}`;
    glow.addColorStop(0,`rgba(${rgb},.24)`);glow.addColorStop(.3,`rgba(${rgb},.12)`);glow.addColorStop(1,`rgba(${rgb},0)`);
    c.fillStyle=glow;c.fillRect(x-r,y-r,r*2,r*2);
  }
  c.restore();
  // Ground under closed buildings is dark; the same polygons anchor their wall art.
  for(const b of t.buildings)if(touches(b.footprint))polygon(c,b.footprint,'#242c2c');
  for(const b of t.buildings)for(const p of b.interior?.floors??[]) {
    if(!touches(p))continue;
    c.save();path(c,p);c.clip();
    c.fillStyle=b.id==='inn'?'#6a5945':'#555551';c.fillRect(x0,y0,CHUNK,CHUNK);
    for(let y=Math.floor(y0/17)*17;y<y0+CHUNK;y+=17){line(c,[[x0,y],[x0+CHUNK,y]],'#38372d',1.5);for(let x=x0+(y%51)*4;x<x0+CHUNK;x+=90)line(c,[[x,y],[x,y+17]],'#454233',1);}
    if(b.id==='inn') {
      polygon(c,[[2410,1935],[2470,1935],[2500,1995],[2440,2010]],'#665344','#aa8a5d',2);
      for(let i=0;i<6;i++)line(c,[[2420+i*7,1943],[2451+i*7,1995]],'rgba(175,144,95,.25)',2);
    }
    c.restore();
  }
}

export function lamps(t:TownData): MapLayers['sorted'] {
 return t.lights.filter(l=>l.id.includes('lamp')).map(l=>{
  const view=new Container(),g=new Graphics(),[x,y]=l.position,h=l.height??100;
  view.position.set(x,y);
  g.moveTo(0,-h+25).lineTo(0,-h-22).lineTo(27,-h-22).stroke({width:5,color:0x211c1b});
  g.moveTo(1,-h-20).lineTo(20,-h-20).stroke({width:1.5,color:0x837453});
  g.moveTo(5,-h+5).lineTo(22,-h-18).stroke({width:3,color:0x353834});
  g.moveTo(24,-h-22).lineTo(24,-h-9).stroke({width:2,color:0x635d48});
  g.poly([16,-h-8,32,-h-8,30,-h+12,18,-h+12]).fill(0xe8b465).stroke({width:2.5,color:0x242929});
  g.poly([14,-h-8,24,-h-16,34,-h-8]).fill(0x3b4645).stroke({width:2,color:0x222724});
  g.moveTo(24,-h-8).lineTo(24,-h+12).stroke({width:2,color:0x4a4638});
  g.moveTo(17,-h+12).lineTo(31,-h+12).stroke({width:4,color:0x242929});
  const aura=glowSprite(l.color,90,.20,true);aura.position.set(24,-h+2);
  const flame=flameSprite(0xffdc99,12);flame.position.set(24,-h+9);
  view.addChild(aura,g,flame);
  view.onRender=()=>{const tm=Date.now()/1000,k=1+l.flicker*(Math.sin(tm*7)+Math.sin(tm*11)*.45);aura.alpha=.2*k;flame.scale.y=.125*k;};
  return {view,y,bounds:{x0:x-35,x1:x+75,y0:y-h-45,y1:y+10}};
 });
}

export function buildTownSlice(t:TownData): MapLayers {
  const start=performance.now();
  const base=t.stage==='complete'?{ground:new Container(),decals:new Container(),sorted:[]}:buildTownBlockout(t);
  base.ground.addChild(new SliceGround(t));
  const ground=performance.now(),buildings=townBuildings(t),architecture=performance.now(),props=townProps(t),end=performance.now();
  performance.clearMeasures('town-ground');performance.clearMeasures('town-architecture');performance.clearMeasures('town-props');
  performance.measure('town-ground',{start,end:ground});performance.measure('town-architecture',{start:ground,end:architecture});performance.measure('town-props',{start:architecture,end});
  return {ground:base.ground,decals:base.decals,sorted:[...buildings,...props,...lamps(t)]};
}
