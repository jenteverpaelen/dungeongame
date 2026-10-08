import { Container, Graphics, Sprite } from 'pixi.js';
import type { TownData } from '@shared/townTypes';
import { townPatrol } from '@shared/townLife';
import { PlayerArt } from './player';
import { flameSprite, glowSprite, sparkleSprite } from './fx';
import type { PlayerLook } from '@shared/protocol';
import type { ViewState } from '../types';

type Motion = {root:Container; x:number;y:number; kind:string; parts:Container[]; seed:number};
const outfits:Record<string,PlayerLook>={
 worker:{classId:'warrior',slots:{chest:{shape:'cloth',primary:0x655e4b,secondary:0x46544c,glow:0,variant:1},legs:{shape:'cloth',primary:0x404740,secondary:0x63593e,glow:0,variant:0}}},
 pilgrim:{classId:'mage',slots:{head:{shape:'hood',primary:0x656859,secondary:0x96836a,glow:0,variant:1},chest:{shape:'robe',primary:0x555d56,secondary:0x978263,glow:0,variant:0}}},
 porter:{classId:'ranger',slots:{chest:{shape:'leather',primary:0x6a5038,secondary:0x827454,glow:0,variant:0},head:{shape:'hood',primary:0x64543f,secondary:0x8b7651,glow:0,variant:0}}}
};

/** Fixed, pooled visual population. No emitted particles are allocated during a frame. */
export class TownLife {
  readonly ground=new Container();
  readonly above=new Container();
  private motions:Motion[]=[];
  private walkers:{data:NonNullable<TownData['villagers']>[number];view:PlayerArt;state:ViewState}[]=[];
  private lightSprites:{data:TownData['lights'][number];view:Sprite}[]=[];
  constructor(private town:TownData,private entities:Container) {
    for(const l of town.lights) {
      const glow=glowSprite(l.color,l.radius*2,.20,true);glow.position.set(...l.position);glow.scale.y*=.65;this.ground.addChild(glow);this.lightSprites.push({data:l,view:glow});
    }
    for(const e of town.emitters) {
      const root=new Container();root.position.set(...e.position);this.above.addChild(root);
      const parts:Container[]=[];
      for(let i=0;i<e.rate;i++) {
        let p:Container;
        if(e.kind==='smoke'||e.kind==='fog')p=glowSprite(e.kind==='fog'?0xaebcb3:0x888c7d,e.kind==='fog'?360:45,.1,false);
        else if(e.kind==='embers'||e.kind==='motes')p=sparkleSprite(e.kind==='embers'?0xffba66:0xd2b8e2,4,.8);
        else if(e.kind==='birds')p=new Graphics().moveTo(-10,0).quadraticCurveTo(-5,-5,0,0).quadraticCurveTo(5,-5,10,0).stroke({color:0x171f20,width:2});
        else p=new Graphics().poly([-3,0,0,-2,5,1,0,3]).fill([0x8b7845,0x6b6b42,0x9e7d43][i%3]);
        parts.push(p);root.addChild(p);
      }
      this.motions.push({root,parts,x:e.position[0],y:e.position[1],kind:e.kind,seed:this.motions.length});
    }
    for(const p of town.props.filter(p=>p.kind==='brazier')) {
      const root=new Container(),parts:Container[]=[];root.position.set(p.x,p.y-(p.height??40));root.zIndex=p.y+1;entities.addChild(root);
      for(let i=0;i<3;i++){const f=flameSprite(i===1?0xffda83:0xef9b4c,24);f.x=(i-1)*8;parts.push(f);root.addChild(f);}
      this.motions.push({root,parts,x:p.x,y:p.y,kind:'flame',seed:0});
    }
    for(const d of town.details??[]) {
      const root=new Container();root.position.set(...d.position);root.zIndex=d.position[1];const parts:Container[]=[];
      if(d.kind==='puddle') {
        const pool=new Graphics().ellipse(0,0,d.width,d.width*.32).fill({color:0x2a4448,alpha:.8});root.addChild(pool);
        for(let i=0;i<3;i++){const ring=new Graphics().ellipse(0,0,d.width*.7,d.width*.20).stroke({color:0x8daba4,width:1,alpha:.45});root.addChild(ring);parts.push(ring);}this.ground.addChild(root);
      } else {
        const w=d.width,g=new Graphics();
        if(d.kind==='banner')g.moveTo(0,0).lineTo(0,-121).lineTo(w+5,-121).stroke({color:0x87765b,width:4});
        else g.moveTo(0,-76).lineTo(w,-69).stroke({color:0x938266,width:1.5});
        root.addChild(g);
        const cloth=new Graphics();
        if(d.kind==='banner')cloth.poly([3,-117,w,-117,w,-67,w/2,-59,3,-67]).fill(0x776040).stroke({color:0x282f2b,width:2}).moveTo(9,-87).lineTo(w-5,-87).stroke({color:0xb7a57a,width:3});
        else for(let i=0;i<3;i++)cloth.poly([i*30+6,-75,i*30+28,-73,i*30+27,-45,i*30+3,-48]).fill([0x8a8775,0x58685f,0x726a62][i]);
        root.addChild(cloth);parts.push(cloth);entities.addChild(root);
      }
      this.motions.push({root,parts,x:d.position[0],y:d.position[1],kind:d.kind,seed:1});
    }
    for(const d of town.villagers??[]) {
      const view=new PlayerArt(outfits[d.look],true);entities.addChild(view.root);
      const state:ViewState={x:0,y:0,vx:0,vy:0,moving:false,facingLeft:false,flags:0,attackSeq:0,hpFrac:1,time:0,aps:1};
      this.walkers.push({data:d,view,state});
    }
  }
  update(dt:number,time:number,cx:number,cy:number,halfWidth:number,halfHeight:number) {
    for(const l of this.lightSprites){l.view.visible=Math.abs(l.data.position[0]-cx)<halfWidth+l.data.radius&&Math.abs(l.data.position[1]-cy)<halfHeight+l.data.radius;l.view.alpha=.13*(1+l.data.flicker*Math.sin(time*7));}
    for(const m of this.motions) {
      m.root.visible=Math.abs(m.x-cx)<halfWidth+400&&Math.abs(m.y-cy)<halfHeight+340;if(!m.root.visible)continue;
      for(let i=0;i<m.parts.length;i++) {
        const p=m.parts[i],ph=(time*.13+i/m.parts.length+m.seed*.17)%1;
        switch(m.kind) {
          case 'smoke':p.position.set(Math.sin(time*.4+i)*15+ph*27,-ph*105);p.scale.set(.14+ph*.38);p.alpha=Math.sin(ph*Math.PI)*.19;break;
          case 'fog':p.position.set((ph-.5)*700,Math.sin(i+time*.1)*45);p.scale.set(2,.25);p.alpha=Math.sin(ph*Math.PI)*.065;break;
          case 'embers':case 'motes':p.position.set(Math.sin(time+i*2)*16,-ph*65);p.alpha=Math.sin(ph*Math.PI)*.8;break;
          case 'leaves':p.position.set((ph-.5)*550,Math.sin(i*2+time*.45)*90);p.rotation=time*.3+i;break;
          case 'birds':p.position.set(Math.sin(time*.075+i)*360,-150+Math.cos(time*.075+i)*100);p.scale.y=Math.sin(time*8+i)*.65;break;
          case 'flame':p.scale.y=.20+Math.sin(time*8+i)*.035;break;
          case 'puddle':p.scale.set(.25+ph);p.alpha=(1-ph)*.35;break;
          default:p.skew.x=Math.sin(time*1.2+i)*.04;
        }
      }
    }
    for(const w of this.walkers) {
      const s=w.state;townPatrol(w.data.path,w.data.speed,w.data.pause,time,s);s.time=time;s.moving=Math.hypot(s.vx,s.vy)>1;s.facingLeft=s.vx<0;
      const root=w.view.root;root.position.set(s.x,s.y);root.zIndex=s.y;root.visible=Math.abs(s.x-cx)<halfWidth+80&&Math.abs(s.y-cy)<halfHeight+90;
      if(root.visible)w.view.update(dt,s);
    }
  }
  destroy() {
    for(const m of this.motions)if(!m.root.destroyed)m.root.destroy({children:true});
    for(const w of this.walkers)w.view.destroy();
    this.ground.destroy({children:true});this.above.destroy({children:true});
  }
}
