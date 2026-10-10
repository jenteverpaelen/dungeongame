import { PLAYER_RADIUS } from '@shared/constants';
import type { CollisionWorld } from '@shared/movement';

export interface PathPoint {x:number;y:number}
const STEP=PLAYER_RADIUS*1.5;
const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

/** Cosmetic route only. Every edge must fit the same circle used by actual movement. */
export class QuestPathfinder {
  private cols:number;
  private rows:number;
  private free:Int8Array;
  constructor(private collision:CollisionWorld) {
    this.cols=Math.ceil(collision.widthPx/STEP);this.rows=Math.ceil(collision.heightPx/STEP);
    this.free=new Int8Array(this.cols*this.rows);
  }
  private point(id:number):PathPoint {return {x:(id%this.cols+.5)*STEP,y:(Math.floor(id/this.cols)+.5)*STEP};}
  clear(a:PathPoint,b:PathPoint):boolean {
    if(this.collision.town)return !this.collision.town.circlePathBlocked(a.x,a.y,PLAYER_RADIUS,b.x-a.x,b.y-a.y);
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(PLAYER_RADIUS/2)));
    for(let i=0;i<=steps;i++)if(!this.collision.isFree(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,PLAYER_RADIUS))return false;
    return true;
  }
  private open(id:number):boolean {
    if(!this.free[id]){const p=this.point(id);this.free[id]=this.collision.isFree(p.x,p.y,PLAYER_RADIUS)?1:-1;}
    return this.free[id]===1;
  }
  /** Yield frequently so a distant route never monopolizes a rendering frame. */
  *search(start:PathPoint,target:PathPoint):Generator<void,PathPoint[]> {
    const goal=this.collision.resolve(target.x,target.y,PLAYER_RADIUS);
    if(this.clear(start,goal))return [start,goal];
    const cost=new Map<number,number>(),parent=new Map<number,number>();
    const heap:{id:number;g:number;f:number}[]=[];
    const push=(id:number,g:number)=>{
      const p=this.point(id),n={id,g,f:g+Math.hypot(p.x-goal.x,p.y-goal.y)};
      let i=heap.length;heap.push(n);
      while(i>0){const j=(i-1)>>1;if(heap[j].f<=n.f)break;heap[i]=heap[j];i=j;}heap[i]=n;
    };
    const pop=()=>{
      const first=heap[0],last=heap.pop()!;
      if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=last.f)break;heap[i]=heap[j];i=j;}heap[i]=last;}
      return first;
    };
    const cx=Math.floor(start.x/STEP),cy=Math.floor(start.y/STEP);
    for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){
      if(x<0||y<0||x>=this.cols||y>=this.rows)continue;
      const id=y*this.cols+x,p=this.point(id);
      if(this.open(id)&&this.clear(start,p)){const g=Math.hypot(p.x-start.x,p.y-start.y);cost.set(id,g);push(id,g);}
    }
    let visited=0;
    while(heap.length){
      if(++visited%16===0)yield;
      const n=pop();if(n.g!==cost.get(n.id))continue;
      const p=this.point(n.id);
      if(Math.hypot(p.x-goal.x,p.y-goal.y)<=STEP*2&&this.clear(p,goal)){
        const path=[goal,p];let id=n.id;
        while(parent.has(id)){id=parent.get(id)!;path.push(this.point(id));}path.push(start);path.reverse();
        const smooth=[start];let i=0;
        while(i<path.length-1){let j=Math.min(path.length-1,i+16);while(j>i+1&&!this.clear(path[i],path[j]))j--;smooth.push(path[j]);i=j;yield;}
        return smooth;
      }
      const x=n.id%this.cols,y=Math.floor(n.id/this.cols);
      for(const [dx,dy] of DIRECTIONS){
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=this.cols||ny>=this.rows)continue;
        const id=ny*this.cols+nx,g=n.g+STEP*Math.hypot(dx,dy);
        if(g>=(cost.get(id)??Infinity)||!this.open(id)||!this.clear(p,this.point(id)))continue;
        cost.set(id,g);parent.set(id,n.id);push(id,g);
      }
    }
    return [];
  }
}
