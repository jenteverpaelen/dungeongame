import { BitmapText, Container, Graphics } from 'pixi.js';
import type { CharacterSave } from '@shared/types';
import type { MapData } from '@shared/mapgen';
import type { CollisionWorld } from '@shared/movement';
import { questObjective, questPoint, trackedQuest } from '@shared/quests';
import { ZONES } from '@shared/data/zones';
import { PLAYER_RADIUS } from '@shared/constants';
import { QuestPathfinder, type PathPoint } from '../game/questPath';
import { PLATE_FONT, ensureFonts } from './vfx/fonts';

type Objective = ReturnType<typeof questObjective>;
/** Presentation unit shared with the quest tracker: 50 world units per metre. */
const METRE=50;
const SPACING=PLAYER_RADIUS*1.25;
/** Sparks run this far along the trail from the hero, then fade and start again [P]. */
const SPARKS=3,SPARK_RUN=620,SPARK_SPEED=310;
/** Screen pixels the edge marker keeps clear of the HUD: portrait, minimap and tracker column, skill bar [P]. */
const INSET={left:70,right:300,top:90,bottom:230};

export interface GuideView {camX:number;camY:number;halfW:number;halfH:number;zoom:number;time:number}

/** The focused quest's route (docs/rework/OWNER-LIST-2026-10-13.md, waypoint tracker): a gold breadcrumb trail that
 *  reroutes as the hero moves, with sparks running toward the goal (Fable II), a pulsing beacon at the end, and a marker
 *  pinned to the screen edge with the distance while the goal is off screen (WoW map pins). Multi-target steps lead to
 *  the nearest target, as the tracker's distance does. Navigation is local presentation, never automatic movement. */
export class QuestGuide {
  readonly root=new Container();
  /** Lives in the text layer so it draws over buildings and people. */
  readonly marker=new Container();
  private dots=new Graphics();
  private beacon=new Container();
  private pulse=new Graphics();
  private sparks:Graphics[]=[];
  private arrow=new Graphics();
  private label:BitmapText;
  private labelText='';
  private collision:CollisionWorld|null=null;
  private finder:QuestPathfinder|null=null;
  private map:MapData|null=null;
  private save:CharacterSave|null=null;
  private objective:Objective|undefined;
  private objectiveKey='';
  private goal:PathPoint|undefined;
  private path:PathPoint[]=[];
  private cum:number[]=[];
  private from:PathPoint|undefined;
  private search:Generator<void,PathPoint[]>|undefined;
  private lastSearch=0;
  private lastPick=-Infinity;

  constructor() {
    ensureFonts();
    this.root.eventMode='none';this.marker.eventMode='none';
    const ring=new Graphics().circle(0,0,10).fill({color:0xffdb83,alpha:.16}).circle(0,0,10).stroke({color:0xffdb83,width:2,alpha:.9});
    this.pulse.circle(0,0,20).stroke({color:0xffe7a6,width:2.5,alpha:1});
    this.beacon.addChild(ring,this.pulse);
    this.root.addChild(this.dots,this.beacon);
    for(let i=0;i<SPARKS;i++){
      const s=new Graphics().circle(0,0,11).fill({color:0xffe9a8,alpha:.2}).circle(0,0,6.5).fill({color:0xfff1c4,alpha:.45}).circle(0,0,3.6).fill({color:0xffffff,alpha:1});
      this.sparks.push(s);this.root.addChild(s);
    }
    const disc=new Graphics().circle(0,0,12).fill({color:0x1c1309,alpha:.88}).circle(0,0,12).stroke({color:0xe8c06a,width:2,alpha:1})
      .poly([0,-5,4,0,0,5,-4,0]).fill({color:0xffdb83});
    this.arrow.poly([14,-7,23,0,14,7]).fill({color:0xffdb83}).stroke({color:0x1c1309,width:1.5});
    this.label=new BitmapText({text:'',style:{fontFamily:PLATE_FONT,fontSize:13}});
    this.label.tint=0xffe2a0;this.label.anchor.set(.5,0);this.label.y=15;
    this.marker.addChild(this.arrow,disc,this.label);
    this.root.visible=false;this.marker.visible=false;
  }
  refresh(map:MapData|null,save:CharacterSave|null,collision:CollisionWorld|null) {
    if(collision!==this.collision){this.collision=collision;this.finder=collision?new QuestPathfinder(collision):null;this.reset();}
    this.map=map;this.save=save;
    const q=save&&trackedQuest(save);
    this.objective=save&&q?questObjective(save,q):undefined;
    const key=this.objective?`${map?.zone}|${this.objective.zone}|${this.objective.target}|${(this.objective.targets??[]).join(',')}`:'';
    if(key!==this.objectiveKey){this.objectiveKey=key;this.reset();this.lastPick=-Infinity;}
  }
  hide() {this.root.visible=false;this.marker.visible=false;}
  update(me:PathPoint|null,active:boolean,v:GuideView) {
    if(!active||!me||!this.objective||!this.map||!this.save){this.hide();return;}
    const now=performance.now();
    // Nearest remaining target, re-chosen as the hero moves (the same point the tracker measures to).
    if(now-this.lastPick>500){
      this.lastPick=now;
      const next=questPoint(this.map,this.objective,this.save,me,this.objective.targets);
      if(!next){this.reset();this.goal=undefined;}
      else if(!this.goal||Math.hypot(next.x-this.goal.x,next.y-this.goal.y)>1){this.reset();this.goal={x:next.x,y:next.y};}
    }
    const goal=this.goal;
    if(!goal||!this.finder){this.hide();return;}
    this.root.visible=true;
    if(!this.search&&(!this.from||now-this.lastSearch>400&&Math.hypot(me.x-this.from.x,me.y-this.from.y)>PLAYER_RADIUS*3)){
      this.from={x:me.x,y:me.y};this.lastSearch=now;
      this.search=this.finder.search(this.from,goal);
    }
    const deadline=performance.now()+2;
    while(this.search&&performance.now()<deadline){
      const result=this.search.next();
      if(result.done){this.search=undefined;this.draw(result.value);}
    }
    this.animate(me,goal,v);
  }
  private reset() {this.path=[];this.cum=[];this.from=undefined;this.search=undefined;this.dots.clear();}
  private draw(path:PathPoint[]) {
    this.dots.clear();this.path=path;this.cum=[0];
    for(let i=1;i<path.length;i++)this.cum.push(this.cum[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
    // The first crumb sits a step ahead of the hero's feet; the last stops short of the beacon.
    const total=this.cum[this.cum.length-1]??0;
    for(let d=PLAYER_RADIUS*1.6;d<total-14;d+=SPACING){
      const p=this.at(d);
      this.dots.circle(p.x,p.y,5).fill({color:0x2a1c08,alpha:.5});
      this.dots.circle(p.x,p.y,2.9).fill({color:0xffd77a,alpha:.92});
    }
  }
  private at(d:number):PathPoint {
    const path=this.path;let i=1;
    while(i<path.length-1&&this.cum[i]<d)i++;
    const a=path[i-1],b=path[i],len=this.cum[i]-this.cum[i-1],k=len>0?Math.min(1,Math.max(0,(d-this.cum[i-1])/len)):0;
    return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};
  }
  private animate(me:PathPoint,goal:PathPoint,v:GuideView) {
    const t=v.time,total=this.cum[this.cum.length-1]??0,run=Math.min(SPARK_RUN,total);
    for(let i=0;i<SPARKS;i++){
      const s=this.sparks[i];
      if(run<PLAYER_RADIUS*4){s.visible=false;continue;}
      const d=(t*SPARK_SPEED+i*run/SPARKS)%run,p=this.at(d+PLAYER_RADIUS*1.6);
      s.visible=true;s.position.set(p.x,p.y);s.alpha=Math.sin(Math.PI*d/run);
    }
    const phase=(t*.7)%1;
    this.beacon.position.set(goal.x,goal.y);
    this.pulse.scale.set(.45+phase*.95);this.pulse.alpha=(1-phase)*.85;
    // Edge marker: only while the goal is off screen and still a few metres away.
    const metres=Math.round(Math.hypot(goal.x-me.x,goal.y-me.y)/METRE),z=v.zoom;
    const onScreen=Math.abs(goal.x-v.camX)<v.halfW-30/z&&Math.abs(goal.y-v.camY)<v.halfH-30/z;
    if(onScreen||metres<4){this.marker.visible=false;return;}
    const left=v.camX-v.halfW+INSET.left/z,right=v.camX+v.halfW-INSET.right/z,top=v.camY-v.halfH+INSET.top/z,bottom=v.camY+v.halfH-INSET.bottom/z;
    const cx=(left+right)/2,cy=(top+bottom)/2,dx=goal.x-cx,dy=goal.y-cy;
    const tx=dx>0?(right-cx)/dx:dx<0?(left-cx)/dx:Infinity,ty=dy>0?(bottom-cy)/dy:dy<0?(top-cy)/dy:Infinity,k=Math.min(1,tx,ty);
    this.marker.visible=true;this.marker.position.set(cx+dx*k,cy+dy*k);
    this.arrow.rotation=Math.atan2(dy,dx);
    // The label opens toward the middle of the screen so it never runs off the edge it is pinned to.
    const side=k===tx&&Math.abs(dx)>1?Math.sign(dx):0;
    this.label.anchor.x=side>0?1:side<0?0:.5;this.label.x=side*12;
    const away=this.objective&&this.map&&this.objective.zone!==this.map.zone?ZONES[this.objective.zone]?.name:undefined;
    const text=away?`${away} · ${metres} m`:`${metres} m`;
    if(text!==this.labelText){this.labelText=text;this.label.text=text;}
  }
}
