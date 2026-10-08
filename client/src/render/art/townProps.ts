import type { TownData, Point } from '@shared/townTypes';
import type { MapLayers } from './index';
import { bakeFace } from './townBuildings';
import { beam, line, noise, polygon, TOWN_INK, type Paint } from './townPaint';

function disc(c:Paint,x:number,y:number,r:number,color:string) {
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();c.strokeStyle=TOWN_INK;c.lineWidth=2;c.stroke();
}
export function townProps(t:TownData):MapLayers['sorted'] {
  const result:MapLayers['sorted']=[];
  for(const p of t.props) {
    const {x,y,radius:r}=p,h=p.height??40;
    const canopy=p.kind==='tree'?h*.53:r+8;
    result.push(...bakeFace({x0:x-canopy-5,x1:x+canopy+5,y0:y-h-(p.kind==='table'?r*.7+3:8),y1:y+r+3},[[x-canopy,y],[x+canopy,y]],c=>{
      c.save();c.translate(x,y);disc(c,0,0,r,p.kind==='tree'?'#383e30':'#4a4840');
      if(p.kind==='tree') {
        beam(c,[-r*.7,5],[0,-h*.9],r*.48,true);
        beam(c,[0,-h*.45],[-h*.29,-h*.77],6,true);beam(c,[0,-h*.6],[h*.31,-h*.86],5,true);
        for(let i=0;i<9;i++) {
          const a=i*2.4,xx=Math.cos(a)*h*.26,yy=-h*.74+Math.sin(a)*h*.17,rr=h*(.2+noise(i,x,6)*.09);
          const points:Point[]=[];for(let j=0;j<9;j++){const k=j*Math.PI*2/9,dist=rr*(.8+noise(i,j,x)*.2);points.push([xx+Math.cos(k)*dist,yy+Math.sin(k)*dist*.7]);}
          polygon(c,points,['#354738','#41503a','#596046'][i%3],TOWN_INK,2);
          line(c,points.slice(0,4),'#6d7050',1.5);
        }
      } else if(p.kind==='rock') {
        polygon(c,[[-r,0],[-r*.6,-h],[r*.3,-h-3],[r,-h*.4],[r*.7,r*.5],[-r*.5,r*.5]],'#64665b',TOWN_INK,2.5);
        polygon(c,[[-r*.6,-h],[r*.3,-h-3],[r*.1,-h*.45],[-r,0]],'#7b7c6b');line(c,[[r*.1,-h*.45],[r*.5,-h*.15],[r*.7,r*.5]],'#383f3d',2);
      } else if(p.kind==='table') {
        for(const xx of [-r*.6,r*.6])beam(c,[xx,0],[xx,-h],5);
        c.beginPath();c.ellipse(0,-h,r, r*.7,0,0,Math.PI*2);c.fillStyle='#82704e';c.fill();c.strokeStyle=TOWN_INK;c.lineWidth=3;c.stroke();
        for(let yy=-r*.4;yy<r*.5;yy+=9){const w=Math.sqrt(r*r-(yy/.7)**2);line(c,[[-w,-h+yy],[w,-h+yy]],'#504633',1);}
        disc(c,-7,-h-3,4,'#b2a180');line(c,[[8,-h],[8,-h-13]],'#d3bb79',4);
      } else if(p.kind==='barrel') {
        polygon(c,[[-r+2,-h],[-r,-h*.7],[-r+2,0],[r-2,0],[r,-h*.7],[r-2,-h]],'#766040',TOWN_INK,3);
        for(let xx=-r+6;xx<r;xx+=8)line(c,[[xx,-h],[xx,0]],'#433c2e',2);
        for(const yy of [-h+5,-7])line(c,[[-r,yy],[r,yy]],'#434a48',5);
        c.beginPath();c.ellipse(0,-h,r-2,6,0,0,Math.PI*2);c.fillStyle='#887253';c.fill();c.stroke();
      } else if(p.kind==='well') {
        disc(c,0,-15,r,'#777b6d');disc(c,0,-20,r-7,'#223d42');
        for(let i=0;i<10;i++){const a=i*Math.PI/5;line(c,[[Math.cos(a)*(r-7),-20+Math.sin(a)*(r-7)],[Math.cos(a)*r,-15+Math.sin(a)*r]],'#3e4540',2);}
        beam(c,[-r+3,0],[-r+3,-h],5);beam(c,[r-3,0],[r-3,-h],5);beam(c,[-r-1,-h],[r+1,-h],6);line(c,[[0,-h],[0,-9]],'#a69367',1.8);
      } else if(p.kind==='anvil') {
        polygon(c,[[-r*.55,0],[-r*.5,-19],[r*.55,-19],[r*.6,0]],'#63503c',TOWN_INK,2);
        polygon(c,[[-r,-h],[-r*.4,-h+8],[-r*.35,-15],[r*.45,-15],[r*.5,-h+8],[r,-h+3],[r,-h-3]],'#697575',TOWN_INK,2);
        line(c,[[-r,-h],[r,-h-3]],'#adb4a3',2);
      } else if(p.kind==='cart') {
        polygon(c,[[-r,-h+15],[r,-h+3],[r,0],[-r,5]],'#66543d',TOWN_INK,3);
        for(let yy=-h+20;yy<0;yy+=10)line(c,[[-r,yy],[r,yy-12]],'#3b342b',2);
        for(const xx of [-r+3,r-3]){disc(c,xx,0,11,'#414039');line(c,[[xx-8,0],[xx+8,0]],'#98805a',3);line(c,[[xx,-8],[xx,8]],'#98805a',3);}
        beam(c,[-r*.5,-h+12],[r*.55,-h-7],5,true);
      } else {
        polygon(c,[[-r*.65,0],[-r,-h+9],[-r*.8,-h],[r*.8,-h],[r,-h+9],[r*.65,0]],'#46413a',TOWN_INK,3);
        c.beginPath();c.ellipse(0,-h,r,7,0,0,Math.PI*2);c.fillStyle='#bd6c33';c.fill();
        for(const xx of [-r*.65,0,r*.65])line(c,[[xx,0],[xx,-h]],'#8e7959',2);
      }
      c.restore();
    }));
  }
  for(const b of t.barriers) {
    const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],len=Math.hypot(dx,dy);
    result.push(...bakeFace({x0:Math.min(b.a[0],b.b[0])-8,x1:Math.max(b.a[0],b.b[0])+8,y0:Math.min(b.a[1],b.b[1])-60,y1:Math.max(b.a[1],b.b[1])+8},[b.a,b.b],c=>{
      for(const h of [19,43])beam(c,[b.a[0],b.a[1]-h],[b.b[0],b.b[1]-h],5,true);
      const count=Math.ceil(len/45);for(let i=0;i<=count;i++){const x=b.a[0]+dx*i/count,y=b.a[1]+dy*i/count;beam(c,[x,y],[x,y-54],b.radius*2);}
    }));
  }
  return result;
}
