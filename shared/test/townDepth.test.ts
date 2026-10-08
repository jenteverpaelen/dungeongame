import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselineY } from '../src/townDepth';
import { generateMap } from '../src/mapgen';
import { validateTown } from '../src/townValidation';

test('sloping frontage gives independent front/back order at both corners, not centre-point order', () => {
  const slope: [number,number][]=[[100,300],[200,400],[300,250]];
  // Two players at the same y can be on opposite sides of one long building.
  assert.ok(330 > baselineY(slope,110));
  assert.ok(330 < baselineY(slope,190));
  assert.equal(baselineY(slope,300),250);
  assert.equal(baselineY(slope,95),300);
  assert.equal(baselineY([[100,200],[100,300]],100),300);
});

test('inn recess rear wall sorts before a hero inside, while its front jamb sorts after', () => {
  const t=generateMap('hearthmere',42).town!,b=t.buildings.find(b=>b.id==='inn')!,p=b.doors[0].inside;
  const rear=baselineY([b.footprint[5],b.footprint[6]],p[0]);
  assert.ok(p[1]>rear+16,'hero is clear of the rear wall');
  assert.ok(p[1]<baselineY(b.baseline,p[0]),'front roof uses its own depth');
  const bad=structuredClone(t);bad.buildings.find(b=>b.id==='inn')!.look!.roof.faces[0][0]=999;
  assert.ok(validateTown(bad).some(e=>e.includes('invalid roof face')));
});
