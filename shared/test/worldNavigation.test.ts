import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../src/mapgen';
import { nextTravelPoint, worldConnections, zoneRoute } from '../src/worldNavigation';

test('routes follow authored exits or existing town waypoint and respect unavailable destinations',()=>{
  assert.deepEqual(zoneRoute('bracken_sluice','saltwind_pans'),['bracken_sluice','rillwake_crossing','hearthmere','saltwind_pans']);
  assert.deepEqual(zoneRoute('bracken_sluice','whispering_glade'),[],'retired fields are unreachable (DECISIONS D-W19)');
  assert.deepEqual(zoneRoute('hearthmere','bracken_sluice',id=>id!=='bracken_sluice'),[]);
  assert.deepEqual(zoneRoute('unknown','bracken_sluice'),[]);
  assert.equal(worldConnections().some(e=>e.from==='rillwake_crossing'&&e.to==='bracken_sluice'&&e.kind==='exit'),true);
  assert.deepEqual(zoneRoute('hearthmere','reedvault_pumpworks'),['hearthmere','bracken_sluice','reedvault_pumpworks']);
  assert(!worldConnections().some(e=>e.to==='reedvault_pumpworks'&&e.kind==='waypoint'));
});
test('objective guidance resolves physical next exit or town waypoint without inventing a portal',()=>{
  const town=generateMap('hearthmere',1),bracken=generateMap('bracken_sluice',1);
  // the west gate leads onto the Water Road (D-W19); every other field is a waypoint hop
  assert.equal(nextTravelPoint(town,'rillwake_crossing'),town.portals.find(p=>p.to==='rillwake_crossing'));
  assert.equal(nextTravelPoint(town,'saltwind_pans'),town.town?.npcs.find(n=>n.role==='waypoint'));
  assert.equal(nextTravelPoint(bracken,'saltwind_pans'),bracken.portals.find(p=>p.to==='rillwake_crossing'));
  assert.equal(nextTravelPoint(bracken,'bracken_sluice'),undefined);
  assert.equal(nextTravelPoint(town,'bracken_sluice',id=>id!=='bracken_sluice'),undefined);
});
