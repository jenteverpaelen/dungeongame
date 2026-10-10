import { Graphics } from 'pixi.js';
import type { CharacterSave } from '@shared/types';
import type { MapData } from '@shared/mapgen';
import type { CollisionWorld } from '@shared/movement';
import { questObjective, questPoint, trackedQuest } from '@shared/quests';
import { PLAYER_RADIUS } from '@shared/constants';
import { QuestPathfinder, type PathPoint } from '../game/questPath';

/** Gold floor dots. Navigation is local presentation, never automatic movement. */
export class QuestGuide {
  readonly root = new Graphics();
  private collision:CollisionWorld|null=null;
  private finder:QuestPathfinder|null=null;
  private point:PathPoint|undefined;
  private from:PathPoint|undefined;
  private search:Generator<void,PathPoint[]>|undefined;
  private lastSearch=0;

  constructor() {this.root.eventMode='none';}
  refresh(map:MapData|null,save:CharacterSave|null,collision:CollisionWorld|null) {
    if(collision!==this.collision){this.collision=collision;this.finder=collision?new QuestPathfinder(collision):null;this.point=undefined;this.root.clear();}
    const q=save&&trackedQuest(save),objective=save&&q&&questObjective(save,q);
    const next=map&&objective?questPoint(map,objective,save!):undefined;
    if(next?.x!==this.point?.x||next?.y!==this.point?.y||!next){this.point=next;this.from=undefined;this.search=undefined;this.root.clear();}
  }
  update(me:PathPoint|null,active:boolean) {
    this.root.visible=active&&!!me&&!!this.point;
    if(!this.root.visible||!me||!this.point||!this.finder)return;
    const now=performance.now();
    if(!this.search&&(!this.from||now-this.lastSearch>400&&Math.hypot(me.x-this.from.x,me.y-this.from.y)>PLAYER_RADIUS*3)){
      this.from={x:me.x,y:me.y};this.lastSearch=now;
      this.search=this.finder.search(this.from,this.point);
    }
    const deadline=performance.now()+2;
    while(this.search&&performance.now()<deadline){
      const result=this.search.next();
      if(result.done){this.search=undefined;this.draw(result.value);}
    }
  }
  private draw(path:PathPoint[]) {
    this.root.clear();
    const spacing=PLAYER_RADIUS*2;let distance=spacing;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y);
      while(distance<length){
        const x=a.x+(b.x-a.x)*distance/length,y=a.y+(b.y-a.y)*distance/length;
        this.root.circle(x,y,4.5).fill({color:0x392810,alpha:.65});
        this.root.circle(x,y,2.5).fill({color:0xffdb83,alpha:.85});
        distance+=spacing;
      }distance-=length;
    }
    const end=path[path.length-1];if(end)this.root.circle(end.x,end.y,7).stroke({color:0xffdb83,width:2,alpha:.85});
  }
}
