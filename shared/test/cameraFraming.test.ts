import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_INSETS as p, REST_VIEW_HEIGHT, SpellFraming } from '../../client/src/render/cameraFraming';
import type { GameEvent } from '../src/protocol';

function contains(f: ReturnType<SpellFraming['target']>, x: number, y: number, aspect: number) {
  const sx = .5 + (x - f.x) / (f.height * aspect), sy = .5 + (y - f.y) / f.height;
  assert.ok(sx >= p.left - 1e-8 && sx <= 1 - p.right + 1e-8 && sy >= p.top - 1e-8 && sy <= 1 - p.bottom + 1e-8,
    `World point ${x},${y} projects outside HUD-safe frame: ${sx},${sy}`);
}

test('mage impact, expanded black hole and complete meteor fall stay framed in all directions', () => {
  for (const aspect of [16/9,4/3,9/16]) for (let a=0;a<Math.PI*2;a+=Math.PI/4) {
    const x=Math.cos(a)*560,y=Math.sin(a)*560;
    const camera=new SpellFraming();
    camera.record({e:'cast',s:1,sk:'meteor',r:'meteor_shower',x:0,y:0,tx:x,ty:y,rad:162.5},true,0);
    const f=camera.target(1,0,0,aspect),scatter=162.5*1.6,rock=30+162.5*.32;
    contains(f,-70,-90,aspect);contains(f,70,32,aspect);
    contains(f,x-scatter-250-rock*1.6,y-scatter-560-rock*1.8,aspect);
    contains(f,x+scatter+162.5*1.4,y+scatter+162.5*1.4,aspect);
    camera.record({e:'aoe',s:1,v:'blackhole',x:-x,y:-y,r:308,d:3000,el:0},true,2);
    const g=camera.target(3,0,0,aspect),r=308*1.4+24;
    contains(g,-x-r,-y-r,aspect);contains(g,-x+r,-y+r,aspect);
    contains(g,x-scatter-250-rock*1.6,y-scatter-560-rock*1.8,aspect);
  }
});

test('remote spells, expired effects, buffs and zone changes do not keep the camera pulled back', () => {
  const camera=new SpellFraming();
  const event:GameEvent={e:'cast',s:9,sk:'meteor',x:0,y:0,tx:0,ty:-560,rad:130};
  camera.record(event,false,0);assert.equal(camera.target(1,0,0,16/9).height,REST_VIEW_HEIGHT);
  camera.record({...event,sk:'magic_weapon'},true,0);assert.equal(camera.target(1,0,0,16/9).active,false);
  camera.record(event,true,0);assert.ok(camera.target(1,0,0,16/9).height>REST_VIEW_HEIGHT);
  assert.equal(camera.target(7000,0,0,16/9).active,false);
  camera.record(event,true,8000);camera.clear();assert.equal(camera.target(8001,0,0,16/9).active,false);
});
