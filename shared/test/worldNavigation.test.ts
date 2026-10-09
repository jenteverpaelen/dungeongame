import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../src/mapgen';
import { nextTravelPoint, worldConnections, zoneRoute } from '../src/worldNavigation';

test('routes follow authored exits or existing town waypoint and respect unavailable destinations',()=>{
  assert.deepEqual(zoneRoute('bracken_sluice','whispering_glade'),['bracken_sluice','rillwake_crossing','hearthmere','whispering_glade']);
  assert.deepEqual(zoneRoute('hearthmere','bracken_sluice',id=>id!=='bracken_sluice'),[]);
  assert.deepEqual(zoneRoute('unknown','bracken_sluice'),[]);
  assert.equal(worldConnections().some(e=>e.from==='rillwake_crossing'&&e.to==='bracken_sluice'&&e.kind==='exit'),true);
});
test('objective guidance resolves physical next exit or town waypoint without inventing a portal',()=>{
  const town=generateMap('hearthmere',1),bracken=generateMap('bracken_sluice',1);
  assert.equal(nextTravelPoint(town,'rillwake_crossing'),town.town?.npcs.find(n=>n.role==='waypoint'));
  assert.equal(nextTravelPoint(bracken,'whispering_glade'),bracken.portals.find(p=>p.to==='rillwake_crossing'));
  assert.equal(nextTravelPoint(bracken,'bracken_sluice'),undefined);
  assert.equal(nextTravelPoint(town,'bracken_sluice',id=>id!=='bracken_sluice'),undefined);
});
