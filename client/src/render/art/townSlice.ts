import { CanvasSource, Container, Graphics, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import { groundBoundary, inGround } from '@shared/townGeometry';
import type { Point, TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { buildTownBlockout } from './townBlockout';
import { townBuildings } from './townBuildings';
import { glowSprite, flameSprite } from './fx';
import { field, line, noise, path, polygon, type Paint } from './townPaint';

const CHUNK=512, DENSITY=2;

/** Only the approved slice region is painted. Other districts remain visibly blockout. */
class SliceGround extends Container {
  private tiles: { sprite: Sprite; x: number; y: number }[]=[];
  private matrix=new Matrix();
  constructor(t: TownData) {
    super();
    const [x0,y0,x1,y1]=t.lookSlice!.bounds;
    for(let y=Math.floor(y0/CHUNK)*CHUNK;y<y1;y+=CHUNK)for(let x=Math.floor(x0/CHUNK)*CHUNK;x<x1;x+=CHUNK) {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=CHUNK*DENSITY;
      const c=canvas.getContext('2d')!;c.scale(DENSITY,DENSITY);c.translate(-x,-y);
      c.beginPath();c.rect(x0,y0,x1-x0,y1-y0);c.clip();
      paintGround(c,t,x,y);
      const texture=new Texture({source:new CanvasSource({resource:canvas,resolution:DENSITY,scaleMode:'linear',autoGenerateMipmaps:true})});
      const sprite=new Sprite(texture);sprite.position.set(x,y);this.addChild(sprite);this.tiles.push({sprite,x,y});
      sprite.on('destroyed',()=>texture.destroy(true));
    }
    this.onRender=(r:Renderer)=>{
      const m=this.getGlobalTransform(this.matrix,false),s=r.screen;
      for(const tile of this.tiles) {
        const x=tile.x*m.a+m.tx,y=tile.y*m.d+m.ty;
        tile.sprite.visible=x<s.width&&x+CHUNK*m.a>0&&y<s.height&&y+CHUNK*m.d>0;
      }
    };
  }
}

function paintGround(c:Paint,t:TownData,x0:number,y0:number) {
  const floors=new Path2D();
  for(const f of t.floors){
    // Match winding before nonzero clipping: overlapping roads must form a union, not cancel.
    const area=f.polygon.reduce((s,p,i)=>{const q=f.polygon[(i+1)%f.polygon.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    const ring=area<0?[...f.polygon].reverse():f.polygon;
    ring.forEach((p,i)=>i?floors.lineTo(...p):floors.moveTo(...p));floors.closePath();
  }
  c.save();c.clip(floors);
  // A continuous soil field crosses chunk boundaries. No repeated texture stamp or hard patch discs.
  const soil=document.createElement('canvas');soil.width=soil.height=CHUNK/2;
  const sc=soil.getContext('2d')!,pixels=sc.createImageData(CHUNK/2,CHUNK/2);
  for(let y=0;y<CHUNK/2;y++)for(let x=0;x<CHUNK/2;x++) {
    const wx=x0+x*2,wy=y0+y*2,broad=field(wx/190,wy/160,67),fine=field(wx/28,wy/24,91),grain=noise(wx,wy,8)*2;
    const i=(y*CHUNK/2+x)*4;
    pixels.data[i]=43+broad*19+fine*5+grain;pixels.data[i+1]=45+broad*15+fine*4+grain;pixels.data[i+2]=47+broad*9+fine*4+grain;pixels.data[i+3]=255;
  }
  sc.putImageData(pixels,0,0);c.drawImage(soil,x0,y0,CHUNK,CHUNK);
  const edges=groundBoundary(t),seed=t.lookSlice!.seed;
  for(let row=Math.floor(y0/15)-1;row<Math.ceil((y0+CHUNK)/15)+1;row++)for(let col=Math.floor(x0/25)-1;col<Math.ceil((x0+CHUNK)/25)+1;col++) {
    const n=noise(col,row,seed),x=col*25+(row%2)*12.5+noise(col,row,8)*5,y=row*15+noise(col,row,9)*4;
    if(!inGround(t,x,y))continue;
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
    polygon(c,[[x+4,y],[x+w-4,y-1],[x+w,y+3],[x+w-2,y+h-2],[x+4,y+h],[x,y+h-3],[x+1,y+3]],`rgb(${v+2},${v+2},${v+1})`,'rgba(28,31,32,.32)',.8);
    line(c,[[x+4,y+1],[x+w-5,y]],'rgba(147,146,131,.16)',.7);
    if(n>.84)line(c,[[x+w*.7,y],[x+w*.56,y+4],[x+w*.59,y+h]],'rgba(28,32,32,.55)',.8);
  }
  c.globalAlpha=1;
  for(let i=0;i<900;i++) {
    const x=x0+noise(i,x0,33)*CHUNK,y=y0+noise(i,y0,34)*CHUNK;
    c.fillStyle=i%2?'rgba(143,131,108,.08)':'rgba(22,31,33,.12)';c.fillRect(x,y,1.5, .7);
  }
  for(const b of t.buildings.filter(b=>b.look)) {
    // All projected shadows share the existing upper-left key direction.
    const shift=b.look!.eaveHeight*.22;
    c.save();c.globalAlpha=.28;
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
  for(const l of t.lights) {
    const [x,y]=l.position,r=l.radius;
    const glow=c.createRadialGradient(x,y,8,x,y,r);
    glow.addColorStop(0,'rgba(220,143,59,.30)');glow.addColorStop(.3,'rgba(195,116,46,.15)');glow.addColorStop(1,'rgba(193,117,47,0)');
    c.fillStyle=glow;c.fillRect(x-r,y-r,r*2,r*2);
  }
  c.restore();
  // Keep unfinished footprints and their labels visible beneath this layer.
  c.save();c.globalCompositeOperation='destination-out';for(const b of t.buildings)polygon(c,b.footprint,'#000');c.restore();
}

function lamp(t:TownData): MapLayers['sorted'] {
  const l=t.lights.find(l=>l.id==='inn-lamp');if(!l)return [];
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
  return [{view,y,bounds:{x0:x-35,x1:x+75,y0:y-h-45,y1:y+10}}];
}

export function buildTownSlice(t:TownData): MapLayers {
  const base=buildTownBlockout(t);
  base.ground.addChild(new SliceGround(t));
  return {ground:base.ground,decals:base.decals,sorted:[...townBuildings(t),...lamp(t)]};
}
