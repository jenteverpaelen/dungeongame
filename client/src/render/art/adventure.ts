import { Container, Graphics } from 'pixi.js';
import type { AdventureData } from '@shared/adventureTypes';
import { groundBoundary, type Edge } from '@shared/townGeometry';
import type { Point } from '@shared/townTypes';
import { hash2 } from './util';
import { field } from './townPaint';

const edges=new WeakMap<AdventureData,Edge[]>();
function polygon(c:CanvasRenderingContext2D,p:Point[]) { c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath(); }

/** Paint the very same ground union used for swept collision; no blurred collision shoreline. */
export function paintAdventureGround(c:CanvasRenderingContext2D,a:AdventureData,x0:number,y0:number) {
  const salt=a.surface==='salt',slate=a.surface==='slate',masonry=a.surface==='masonry'||slate,ash=a.surface==='ash';
  let boundary=edges.get(a);if(!boundary){boundary=groundBoundary(a.geometry);edges.set(a,boundary);}
  c.save();c.translate(-x0,-y0);
  c.fillStyle=ash?'#2a1a16':masonry?'#192a2d':'#263d42';c.fillRect(x0,y0,512,512);
  // Cold, slowly flooded water around the remaining banks. Fine detail is deterministic.
  for(let y=Math.floor(y0/24)*24;y<y0+512;y+=24)for(let x=Math.floor(x0/48)*48;x<x0+512;x+=48) {
    const h=hash2(x,y,71);c.strokeStyle=ash?(h>.6?'#4a3a35':'#302521'):h>.6?'#354e50':'#2c4548';c.lineWidth=1;
    c.beginPath();c.moveTo(x,y+h*18);c.lineTo(x+10+h*22,y+h*18);c.stroke();
  }
  // One clip path for the union avoids internal seams between adjacent authored areas.
  c.save();c.beginPath();
  for(const f of a.geometry.floors){
    const area=f.polygon.reduce((s,p,i)=>{const q=f.polygon[(i+1)%f.polygon.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    const points=area<0?[...f.polygon].reverse():f.polygon;
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  }
  c.clip();c.fillStyle='#48533d';c.fillRect(x0,y0,512,512);
  const grain=document.createElement('canvas');grain.width=grain.height=128;
  const gc=grain.getContext('2d')!,im=gc.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const wx=x0+x*4,wy=y0+y*4,n=field(wx/170,wy/170,11)*15+field(wx/29,wy/29,12)*8+hash2(wx,wy,17)*5,k=(y*128+x)*4;
    im.data[k]=(salt?120:ash?74:masonry?55:49)+n;im.data[k+1]=(salt?123:ash?58:60)+n;im.data[k+2]=(salt?105:slate?72:ash?53:masonry?57:43)+n*.7;im.data[k+3]=255;
  }
  gc.putImageData(im,0,0);c.drawImage(grain,x0,y0,512,512);
  if(masonry)for(let y=Math.floor(y0/64)*64;y<y0+576;y+=64)for(let x=Math.floor(x0/128)*128-64;x<x0+576;x+=128){
    const offset=(Math.floor(y/64)%2)*64;c.strokeStyle='#333e3b';c.lineWidth=3;c.strokeRect(x+offset,y,128,64);
    c.strokeStyle='rgba(160,165,145,.14)';c.lineWidth=1;c.strokeRect(x+offset+3,y+3,122,58);
  }
  for(let y=Math.floor(y0/27)*27;y<y0+530;y+=27)for(let x=Math.floor(x0/27)*27;x<x0+530;x+=27) {
    const h=hash2(x,y,11),xx=x+h*23,yy=y+hash2(y,x,33)*25;
    if(!masonry&&!ash&&!salt&&h>.64){c.strokeStyle='rgba(155,157,111,.2)';c.lineWidth=.8;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-2,yy-5);c.moveTo(xx,yy);c.lineTo(xx+3,yy-7);c.stroke();}
    if(salt&&h>.64){c.strokeStyle='rgba(232,226,208,.45)';c.lineWidth=1;c.beginPath();c.moveTo(xx-7,yy);c.lineTo(xx,yy-4);c.lineTo(xx+7,yy+2);c.stroke();}
    if(ash&&h>.88){c.save();c.translate(xx,yy);c.rotate(h*37);c.strokeStyle='rgba(42,26,22,.28)';c.lineWidth=1;c.beginPath();c.moveTo(-8,0);c.lineTo(0,-4);c.lineTo(6,2);c.stroke();c.restore();}
  }
  for(const p of a.paths) {
    c.lineCap='round';c.lineJoin='round';c.beginPath();p.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.strokeStyle=p.bridge?'#4e4030':'#575442';c.lineWidth=p.width+15;c.stroke();
    c.strokeStyle=p.bridge?'#8a7655':'#70654d';c.lineWidth=p.width;c.stroke();
    if(p.bridge) {
      const [first,last]=[p.points[0],p.points[p.points.length-1]];
      for(let x=first[0];x<last[0];x+=17){c.strokeStyle='#473b2c';c.lineWidth=2;c.beginPath();c.moveTo(x,first[1]-p.width/2);c.lineTo(x,first[1]+p.width/2);c.stroke();}
    }
  }
  for(let y=Math.floor(y0/38)*38;y<y0+512;y+=38)for(let x=Math.floor(x0/38)*38;x<x0+512;x+=38) {
    const h=hash2(x,y,81);c.fillStyle='rgba(23,29,22,.2)';c.beginPath();c.ellipse(x+h*20,y,2+h*3,1+h*2,0,0,Math.PI*2);c.fill();
  }
  c.restore();
  // Narrow bank edge follows exact collision, including bridge approaches.
  for(const e of boundary) {
    if(Math.max(e.ax,e.bx)<x0-12 || Math.min(e.ax,e.bx)>x0+524 || Math.max(e.ay,e.by)<y0-12 || Math.min(e.ay,e.by)>y0+524)continue;
    c.lineCap='round';c.beginPath();c.moveTo(e.ax,e.ay);c.lineTo(e.bx,e.by);c.strokeStyle='#202f2d';c.lineWidth=7;c.stroke();
    c.beginPath();c.moveTo(e.ax+e.nx*3,e.ay+e.ny*3);c.lineTo(e.bx+e.nx*3,e.by+e.ny*3);c.strokeStyle='#85856a';c.lineWidth=2;c.stroke();
  }
  for(const prop of a.scenery)if(prop.r>0){c.fillStyle='rgba(13,22,20,.3)';c.beginPath();c.ellipse(prop.x+8,prop.y+4,prop.r*prop.s*1.3,prop.r*prop.s*.5,0,0,Math.PI*2);c.fill();}
  for(const b of a.geometry.buildings){polygon(c,b.footprint);c.fillStyle='#333b35';c.fill();}
  c.restore();
}

export function adventureStructures(a:AdventureData): {view:Container;y:number}[] {
  const out:{view:Container;y:number}[]=[];
  for(const b of a.geometry.buildings) {
    const xs=b.footprint.map(p=>p[0]),ys=b.footprint.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.max(...ys),w=Math.max(...xs)-x,d=y-Math.min(...ys);
    const kiln=a.kilns?.find(k=>k.x===x&&k.y+k.d===y&&k.w===w),work=a.works?.find(k=>k.x===x&&k.y+k.d===y&&k.w===w),h=kiln?.h??work?.h??54;
    const g=new Graphics();g.position.set(x,y);
    g.rect(0,-h,w,h).fill(0x45483f).stroke({color:0x242e29,width:2});
    g.rect(0,-h-d,w,d).fill(0x858775).stroke({color:0x343e35,width:2});
    for(let row=0;row<Math.ceil(h/18);row++)for(let xx=-16+(row%2)*26;xx<w;xx+=48)g.moveTo(Math.max(0,xx),-row*18).lineTo(Math.min(w,xx+46),-row*18).stroke({color:0x2b352f,width:2});
    for(let xx=14;xx<w;xx+=49)g.moveTo(xx,-h).lineTo(xx+4,-h-d).stroke({color:0xa0a08a,width:1});
    if(work?.kind==='pan'){
      // Open evaporation tray: low solid brick support, iron lip and original salt crust.
      g.rect(0,-h-d,w,d).fill(0x4a3a35).stroke({color:0x242e29,width:5});
      g.rect(7,-h-d+7,w-14,d-14).fill(0x85856a);
      for(let yy=12;yy<d-10;yy+=16)for(let xx=12;xx<w-10;xx+=19){
        g.ellipse(xx,-h-d+yy,5+hash2(xx,yy,13)*5,3).fill(hash2(xx,yy,14)>.5?0xe8e2d0:0xa0a08a);
      }
      g.moveTo(w*.2,-h*.5).lineTo(w*.8,-h*.5).stroke({color:0x242e29,width:5});
    }
    if(work?.kind==='relay'){
      // Stone pedestal, braced mast and shutter. The full base remains solid.
      g.rect(0,-h,w,h).fill(0x45483f);
      for(let yy=0;yy<h;yy+=24)g.moveTo(0,-yy).lineTo(w,-yy).stroke({color:0x242e29,width:2});
      g.rect(w*.43,-h-80,w*.14,80).fill(0x65533b).stroke({color:0x302c23,width:2});
      g.moveTo(w*.14,-h).lineTo(w*.5,-h-55).lineTo(w*.86,-h).stroke({color:0x8c7550,width:5});
      g.rect(w*.2,-h-70,w*.6,42).fill(0x2a1a16).stroke({color:0x9a8054,width:4});
      for(let xx=w*.24;xx<w*.78;xx+=13)g.rect(xx,-h-66,6,34).fill(0xd4af37);
    }
    if(kiln){
      // Staggered, weathered stone courses; the footprint and front baseline stay exact.
      g.rect(0,-h,w,h).fill(0x302c23);
      for(let row=0;row<Math.ceil(h/24);row++)for(let xx=-24+(row%2)*28;xx<w;xx+=56){
        const left=Math.max(2,xx+2),right=Math.min(w-2,xx+53),top=Math.max(-h+2,-(row+1)*24+2),bottom=-row*24-2;
        if(right<=left||bottom<=top)continue;
        const tone=[0x45483f,0x505047,0x59584b,0x4b4b40][Math.floor(hash2(xx,row,91)*4)];
        g.rect(left,top,right-left,bottom-top).fill(tone);
        g.moveTo(left+2,top+2).lineTo(right-2,top+2).stroke({color:0x858775,alpha:.25,width:1});
      }
      g.rect(0,-h-d,w,d).fill(0x655e4d);
      for(let row=0;row<Math.ceil(d/32);row++)for(let xx=-28+(row%2)*32;xx<w;xx+=64){
        const left=Math.max(2,xx+2),right=Math.min(w-2,xx+61),top=-h-d+row*32+2,bottom=Math.min(-h-2,top+28);
        if(right>left&&bottom>top)g.rect(left,top,right-left,bottom-top).fill(hash2(xx,row,19)>.5?0x777260:0x6c6959);
      }
      g.rect(w*.3,-h,w*.4,h).fill({color:0x2a1a16,alpha:.15});
      // Sealed firing mouth, not a walkable doorway. Its entire footprint is solid.
      const mw=w*.4,mh=h*.6,cx=w/2;
      g.roundRect(cx-mw/2,-mh,mw,mh,18).fill(0x2a1a16).stroke({color:0x6b5a48,width:8});
      g.roundRect(cx-mw*.4,-mh*.8,mw*.8,mh*.7,10).fill(0xb24e27);
      g.ellipse(cx,-mh*.3,mw*.22,mh*.2).fill(0xff7a1a);
      for(let xx=cx-mw*.35;xx<cx+mw*.4;xx+=16)g.rect(xx,-mh*.82,5,mh*.82).fill(0x302c23);
      g.rect(cx-mw*.45,-mh*.36,mw*.9,7).fill(0x302c23);
      g.ellipse(cx,-h-d*.5,w*.25,d*.3).fill(0x2a1a16).stroke({color:0x6b5a48,width:9});
      g.ellipse(cx,-h-d*.5,w*.15,d*.16).fill(0x5a1a10);
    }
    out.push({view:g,y});
  }
  for(const b of a.geometry.barriers) {
    const g=new Graphics(),y=Math.max(b.a[1],b.b[1]);g.position.set(b.a[0],y);
    g.moveTo(0,-20).lineTo(b.b[0]-b.a[0],b.b[1]-y-20).stroke({color:0x65533b,width:b.radius*2});
    for(let x=0;x<=b.b[0]-b.a[0];x+=76)g.rect(x-5,-28,10,28).fill(0x8c7550).stroke({color:0x302c23,width:1});
    out.push({view:g,y});
  }
  const w=a.wheel;if(!w)return out;
  const root=new Container();root.position.set(w.x,w.y);
  const wheel=new Graphics().ellipse(0,-48,w.radius,62).stroke({color:0x332d23,width:14}).ellipse(0,-48,w.radius,62).stroke({color:0x9a8054,width:5});
  for(let i=0;i<10;i++){const a=i*Math.PI/5;wheel.moveTo(0,-48).lineTo(Math.cos(a)*w.radius,-48+Math.sin(a)*62).stroke({color:0x786545,width:6});}
  wheel.circle(0,-48,8).fill(0x303b35);root.addChild(wheel);out.push({view:root,y:w.y});
  return out;
}
