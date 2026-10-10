import type { Point } from '../townTypes';
import { ZoneBuilder, rect, room } from '../zoneKit';

// Reedvault Pumpworks (L7–9, private dungeon) — rooms on a loop instead of three boxes (DESIGN.md §1, §2).
// Ids kept: west_wheel, east_wheel, pump_crank, work_record; west_chamber, east_chamber, pump_heart; stages west/east/heart.
const S = 56.32, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
const z = new ZoneBuilder('reedvault_pumpworks', [88, 80], 'pump', P(50, 84), { theme: 'glade', surface: 'masonry' });
const vermin = ['grave_bat', 'reedclaw', 'bog_slime', 'grave_bat'], works = ['mossback', 'gloomshroom', 'vault_moth', 'bog_slime'];
const R = (id: string, cx: number, cy: number, w: number, h: number, o: Parameters<typeof z.region>[3] = {}) => z.region(id, P(cx, cy), [w * S / 2, h * S / 2], { role: 'room', ground: 'flag', poly: room(cx * S, cy * S, w * S, h * S, 2.2 * S), dress: 1.1, ...o });

R('stairs', 50, 83, 22, 11);
R('hall', 50, 64, 36, 17, { roster: vermin, packs: 2 });
const west = R('west', 17, 54, 26, 22, { dress: 0.6 }), east = R('east', 83, 54, 26, 22, { dress: 0.6 });
// The valve gallery stays free of solid furniture: the single-monster combat probes (server/test/reedclaw, siltusk, frontier)
// measure attacks in this open floor.
R('valves', 17, 28, 24, 16, { roster: vermin, packs: 1, dress: 0 });
R('tanks', 83, 28, 24, 16, { roster: works, packs: 1 });
const heart = R('heart', 50, 22, 34, 24, { dress: 0 });
R('records', 50, 5.5, 20, 9, { ground: 'planks', dress: 0 });

z.road([P(50, 83), P(50, 64)], 200, 'flag');
z.road([P(50, 64), P(30, 60), P(17, 54)], 200, 'flag');
z.road([P(50, 64), P(70, 60), P(83, 54)], 200, 'flag');
z.road([P(17, 54), P(17, 28)], 190, 'flag');
z.road([P(83, 54), P(83, 28)], 190, 'flag');
z.road([P(17, 28), P(33, 24), P(50, 22)], 190, 'flag');
z.road([P(83, 28), P(67, 24), P(50, 22)], 190, 'flag');
z.road([P(50, 22), P(50, 5.5)], 170, 'flag');

z.portal(...P(50, 87), 'bracken_sluice', 'Return to Bracken Sluice');
z.shrine('shrine_stairs', ...P(42, 82), 'empowered');
z.decor('crates', ...P(57.5, 81)); z.decor('lamppost', ...P(41, 79.5)); z.decor('lamppost', ...P(59, 79.5));
z.landmark('Intake Stairs', ...P(50, 86));
z.decor('barrels', ...P(36, 60)); z.decor('crates', ...P(64, 69)); z.decor('pillar', ...P(36, 68)); z.decor('pillar', ...P(64, 59), 1, 1);
z.landmark('Filter Hall', ...P(50, 70));

// West and east filters: each wheel starts its chamber encounter (stages keep their order and ids).
z.contact('west_wheel', 'West pressure wheel', ...P(10.5, 50), 'mechanism');
z.pack('west_chamber', ...P(19, 55), ['grave_bat', 'grave_bat', 'reedclaw', 'bog_slime', 'reedclaw', 'grave_bat']);
z.contact('east_wheel', 'East pressure wheel', ...P(89.5, 50), 'mechanism');
z.pack('east_chamber', ...P(81, 55), ['mossback', 'gloomshroom', 'vault_moth', 'bog_slime', 'grave_bat', 'vault_moth']);
z.decor('pillar', ...P(8, 59)); z.decor('pillar', ...P(92, 59), 1, 1);
z.landmark('West Filter', ...P(17, 60)); z.landmark('East Filter', ...P(83, 60));
z.decor('barrels', ...P(11, 31)); z.decor('crates', ...P(23, 32)); z.landmark('Valve Gallery', ...P(17, 33));
z.cache('cache_tanks', ...P(89, 31), 'Settling-tank locker'); z.land('water', rect(78 * S, 22 * S, 10 * S, 2 * S)); z.landmark('Settling Tanks', ...P(83, 33));

// Pump heart (keeper arena) and the record room behind it.
z.contact('pump_crank', 'Main pump crank', ...P(50, 31.5), 'mechanism');
z.pack('pump_heart', ...P(50, 20), [{ type: 'mossback', dx: 0, dy: 0, tier: 2, name: 'The Sumpbound Keeper', combat: 'keeper' }]);
z.wheel = { x: Math.round(39 * S), y: Math.round(14 * S), radius: 38 };
z.decor('pillar', ...P(36, 30)); z.decor('pillar', ...P(64, 30)); z.light(...P(50, 24), 0x9ad8ff, 220);
z.landmark('Pump Heart', ...P(50, 28));
z.contact('work_record', 'Maintenance record', ...P(54.5, 4.5), 'ledger');
z.decor('table', ...P(46, 5.5)); z.light(...P(50, 5), 0xffc070, 150);
z.landmark('Record Room', ...P(50, 9));

z.dungeon = { stages: [
  { id: 'west', trigger: 'west_wheel', encounter: 'west_chamber', area: west },
  { id: 'east', trigger: 'east_wheel', encounter: 'east_chamber', area: east },
  { id: 'heart', trigger: 'pump_crank', encounter: 'pump_heart', area: heart },
] };
for (const [x, y] of [P(50, 74), P(10, 54), P(90, 54), P(50, 14)]) z.sound('water', x, y);
z.emit('fog', ...P(50, 70), 3); z.emit('motes', ...P(50, 22), 8);

// Second pass (LOG W4): machines in the rooms, pipes on the walls.
z.structure('pumpengine', ...P(61, 15)); z.structure('tank', ...P(90, 26)); z.structure('tank', ...P(64.5, 70.5));
z.decor('pipe', ...P(38, 58.5), 1.2, 0); z.decor('pipe', ...P(62, 58.5), 1.2, 1); z.decor('pipe', ...P(26, 47), 1, 2); z.decor('pipe', ...P(74, 47), 1, 0);
z.stores(...P(57, 85.5));
export const PUMPWORKS = z.build();
