import { ADVENTURES } from './adventure';
import { ZONES } from './data/zones';
import town from './data/town/hearthmere.json';
import type { MapData } from './mapgen';

export interface WorldConnection { from:string; to:string; kind:'exit'|'waypoint' }

/** Connectivity only: positions in the regional UI are not world distances. */
export function worldConnections():WorldConnection[] {
  const connections:WorldConnection[]=[];
  const add=(from:string,to:string,kind:WorldConnection['kind'])=>connections.push({from,to,kind});
  for(const p of town.portals)add(town.id,p.to,'exit');
  for(const a of Object.values(ADVENTURES))for(const p of a.portals)add(a.id,p.to,'exit');
  for(const z of Object.values(ZONES))if(z.kind==='field') {
    // Existing procedural fields always have their home portal; authored fields own theirs.
    if(!ADVENTURES[z.id])add(z.id,town.id,'exit');
    add(town.id,z.id,'waypoint');
  }
  return connections;
}

export function zoneRoute(from:string,to:string,allowed:(zone:string)=>boolean=()=>true):string[] {
  if(from===to)return [from];
  const edges=worldConnections(),pending=[[from]],seen=new Set([from]);
  for(let i=0;i<pending.length;i++) {
    const path=pending[i],at=path[path.length-1];
    for(const edge of edges)if(edge.from===at&&!seen.has(edge.to)&&allowed(edge.to)) {
      const next=[...path,edge.to];if(edge.to===to)return next;
      seen.add(edge.to);pending.push(next);
    }
  }
  return [];
}

export function nextTravelPoint(map:MapData,to:string,allowed?:(zone:string)=>boolean) {
  if(map.zone===to)return undefined;
  const next=zoneRoute(map.zone,to,allowed)[1];
  if(!next)return undefined;
  return map.portals.find(p=>p.to===next)
    ??(map.town?.npcs.find(n=>n.role==='waypoint'));
}
