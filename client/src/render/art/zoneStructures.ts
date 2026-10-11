// Big zone landmarks (docs/rework/worlds/LOG.md W4): towers, a windmill, cottages and ruins, kiln stacks, drying racks,
// wrecks, a granary, beacons, pump houses, well heads, signal masts and dungeon machines — original Canvas2D art in the
// town's hand (ink outlines, light from the upper left). Origin = front-centre of the solid footprint (w × d).
import { ellipse, hash, INK, line, poly, rrect, tone, type Paint } from './townKit';
import type { Point } from '@shared/townTypes';

export interface StructureArt { box: { x0: number; y0: number; x1: number; y1: number }; draw: (c: Paint) => void; rotor?: { x: number; y: number; r: number; kind: 'sails' | 'wheel' } }
const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const shade = (c: Paint, w: number, d: number) => { c.save(); c.globalAlpha = 0.3; ellipse(c, w * 0.08, -d * 0.35, w * 0.62, d * 0.62, '#0c1216'); c.restore(); };

function stoneCourses(c: Paint, x0: number, y0: number, w: number, h: number, base: string, seed: number, rowH = 16) {
  for (let row = 0; row * rowH < h; row++) for (let x = x0 - (row % 2) * 14; x < x0 + w; x += 30) {
    const xx = Math.max(x0, x), ww = Math.min(x0 + w, x + 28) - xx, yy = y0 - row * rowH; if (ww < 3) continue;
    poly(c, [[xx + 1, yy - 1], [xx + ww - 1, yy - 1], [xx + ww - 1, yy - rowH + 2], [xx + 1, yy - rowH + 2]], tone(base, 0.74 + hash(Math.round(x), row, seed) * 0.32), 'rgba(20,16,18,0.38)', 0.9);
  }
}
function roof(c: Paint, x0: number, x1: number, eave: number, ridge: number, col: string, overhang = 16) {
  poly(c, [[x0 - overhang, eave], [(x0 + x1) / 2, ridge], [x1 + overhang, eave]], col, INK, 1.6);
  poly(c, [[x0 - overhang, eave], [(x0 + x1) / 2, ridge], [(x0 + x1) / 2 - 6, eave]], tone(col, 1.15));
  for (let k = 1; k < 6; k++) { const t = k / 6; line(c, [[x0 - overhang + ((x0 + x1) / 2 - x0 + overhang) * t, eave + (ridge - eave) * t], [x1 + overhang - (x1 + overhang - (x0 + x1) / 2) * t, eave + (ridge - eave) * t]], 'rgba(20,12,10,0.25)', 1.2); }
}
function windowLit(c: Paint, x: number, y: number, w: number, h: number, lit = true) {
  rrect(c, x - 2, y - 2, w + 4, h + 4, 1.5, INK); rrect(c, x, y, w, h, 1, lit ? '#e8b060' : '#2a3034');
  if (lit) rrect(c, x + 2, y + 2, w * 0.6, h - 4, 1, '#f6d690');
  line(c, [[x + w / 2, y], [x + w / 2, y + h]], '#4b3d30', 2); line(c, [[x, y + h / 2], [x + w, y + h / 2]], '#4b3d30', 2);
}
function flag(c: Paint, x: number, y: number, col: string) { line(c, [[x, y], [x, y - 46]], '#3a2a1e', 3); poly(c, [[x + 1, y - 46], [x + 30, y - 40], [x + 1, y - 32]], col, INK, 1); }

const ART: Record<string, (w: number, d: number, v: number) => StructureArt> = {
  watchtower: (w, d, v) => ({ box: box(-w / 2 - 30, -340, w / 2 + 40, 10), draw: (c) => {
    shade(c, w, d);
    const legs: Point[] = [[-w / 2 + 10, 0], [w / 2 - 10, 0], [-w / 2 + 22, -d * 0.7], [w / 2 - 22, -d * 0.7]];
    for (const [x, y] of legs) line(c, [[x, y], [x * 0.55, -230]], '#5a4030', 9);
    for (const [x, y] of legs) line(c, [[x, y], [x * 0.55, -230]], 'rgba(255,224,180,0.15)', 2);
    for (const h of [-70, -150]) { line(c, [[-w / 2 + 14, h + 30], [w / 2 - 20, h - 30]], '#4a3424', 4); line(c, [[w / 2 - 14, h + 30], [-w / 2 + 20, h - 30]], '#4a3424', 4); }
    rrect(c, -w * 0.42, -244, w * 0.84, 16, 2, '#6a4a30', INK, 1.4);
    poly(c, [[-w * 0.36, -244], [-w * 0.36, -292], [w * 0.36, -292], [w * 0.36, -244]], '#7a5a3a', INK, 1.4);
    for (let x = -w * 0.32; x < w * 0.34; x += 12) line(c, [[x, -246], [x, -290]], 'rgba(20,12,8,0.35)', 1);
    windowLit(c, -12, -282, 24, 20, true);
    poly(c, [[-w * 0.48, -290], [0, -330], [w * 0.48, -290]], v === 1 ? '#5a6a7a' : '#8a5a3a', INK, 1.6);
    line(c, [[w * 0.3, -244], [w * 0.36, 0]], '#6a5038', 3); for (let y = -20; y > -240; y -= 22) line(c, [[w * 0.3 + (y / -240) * -6 + 6, y], [w * 0.36 - (y / -240) * -6, y]], '#6a5038', 2);
    flag(c, 0, -330, '#c83a2a');
  } }),
  stonetower: (w, d, v) => {
    const H = v === 1 ? 250 : 330;
    return { box: box(-w / 2 - 20, -H - 40, w / 2 + 20, 10), draw: (c) => {
      shade(c, w, d);
      const g = c.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#a49e90'); g.addColorStop(0.5, '#8a8478'); g.addColorStop(1, '#5e5a52');
      c.beginPath(); c.moveTo(-w / 2, -10); c.lineTo(-w / 2 + 6, -H); c.lineTo(w / 2 - 6, -H); c.lineTo(w / 2, -10); c.quadraticCurveTo(0, 14, -w / 2, -10); c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      for (let row = 1; row * 20 < H; row++) line(c, [[-w / 2 + 3, -row * 20], [w / 2 - 3, -row * 20]], 'rgba(20,16,18,0.32)', 1.1);
      for (let row = 0; row * 20 < H; row++) for (let k = 0; k < 4; k++) line(c, [[-w / 2 + 18 + k * (w - 36) / 3 + (row % 2) * 12, -row * 20], [-w / 2 + 18 + k * (w - 36) / 3 + (row % 2) * 12, -row * 20 - 20]], 'rgba(20,16,18,0.22)', 1);
      if (v === 1) { poly(c, [[-w / 2 + 6, -H], [-w / 4, -H - 34], [-w / 10, -H + 6], [w / 6, -H - 22], [w / 2 - 6, -H + 4]], '#8a8478', INK, 1.4); for (let i = 0; i < 6; i++) ellipse(c, -w / 2 + hash(i, 1, 9) * w, -hash(i, 2, 9) * 60 - 10, 9, 4, '#4f7a3c'); }
      else { rrect(c, -w / 2 - 6, -H - 18, w + 12, 18, 2, '#9a958a', INK, 1.4); for (let x = -w / 2 - 6; x < w / 2 + 6; x += 22) rrect(c, x, -H - 36, 12, 18, 1.5, '#a8a294', INK, 1.2); flag(c, 0, -H - 36, '#24456a'); }
      for (const y of [-H * 0.35, -H * 0.62]) rrect(c, -5, y, 10, 26, 3, '#1e1c1a');
      c.beginPath(); c.moveTo(-18, 0); c.lineTo(-18, -44); c.quadraticCurveTo(0, -62, 18, -44); c.lineTo(18, 0); c.closePath(); c.fillStyle = '#3a2a20'; c.fill(); c.strokeStyle = INK; c.stroke();
    } };
  },
  windmill: (w, d) => ({ box: box(-150, -400, 150, 10), rotor: { x: 0, y: -282, r: 140, kind: 'sails' }, draw: (c) => {
    shade(c, w, d);
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#d8d0bc'); g.addColorStop(0.5, '#bdb39c'); g.addColorStop(1, '#8a8270');
    poly(c, [[-w / 2, -6], [-w * 0.32, -260], [w * 0.32, -260], [w / 2, -6]]); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
    for (let y = -40; y > -250; y -= 42) line(c, [[-w / 2 + (-y / 260) * w * 0.18 + 4, y], [w / 2 - (-y / 260) * w * 0.18 - 4, y]], 'rgba(60,50,40,0.25)', 1.2);
    c.beginPath(); c.moveTo(-16, -4); c.lineTo(-16, -44); c.quadraticCurveTo(0, -60, 16, -44); c.lineTo(16, -4); c.closePath(); c.fillStyle = '#4a3424'; c.fill(); c.strokeStyle = INK; c.stroke();
    windowLit(c, -10, -150, 20, 18, true);
    poly(c, [[-w * 0.38, -258], [0, -318], [w * 0.38, -258]], '#6a4a34', INK, 1.6); poly(c, [[-w * 0.38, -258], [0, -318], [-6, -258]], '#7a5a40');
    ellipse(c, 0, -282, 12, 12, '#3a2a20', INK, 1.4);
  } }),
  ruinhouse: (w, d, v) => ({ box: box(-w / 2 - 30, -210, w / 2 + 30, 10), draw: (c) => {
    shade(c, w, d); const base = '#8e887a';
    poly(c, [[-w / 2, -d * 0.6], [-w / 2, -150], [-w / 2 + 40, -168], [-w / 2 + 90, -140], [w / 2 - 70, -150], [w / 2, -120], [w / 2, -d * 0.6]], tone(base, 0.82), INK, 1.4);
    poly(c, [[-w / 2, 0], [-w / 2, -120], [-w / 2 + 60, -132], [-w / 2 + 96, -96], [-w / 2 + 120, -110], [-w / 2 + 150, -62], [w / 2 - 110, -56], [w / 2 - 80, -100], [w / 2 - 40, -88], [w / 2, -114], [w / 2, 0]], base, INK, 1.6);
    stoneCourses(c, -w / 2 + 2, -2, w - 4, 52, base, 7);
    for (const x of [-w / 2 + 40, w / 2 - 60]) { rrect(c, x, -92, 30, 34, 2, '#1e1c1a', INK, 1.2); line(c, [[x + 15, -92], [x + 15, -58]], '#4b3d30', 2); }
    line(c, [[-w / 2 + 70, -150], [w / 2 - 60, -170]], '#4a3424', 7); line(c, [[-w / 2 + 120, -110], [-w / 2 + 170, -186]], '#4a3424', 6); line(c, [[w / 2 - 110, -100], [w / 2 - 150, -176]], '#4a3424', 6);
    for (let i = 0; i < 16; i++) ellipse(c, -w / 2 + hash(i, 1, v) * w, -hash(i, 2, v) * 130 - 10, 8 + hash(i, 3, v) * 8, 4 + hash(i, 4, v) * 3, i % 3 ? '#3f6a34' : '#4f7a3c');
    for (let i = 0; i < 10; i++) { const x = -w / 2 + 120 + hash(i, 5, v) * 80, y = -4 - hash(i, 6, v) * 14; poly(c, [[x - 9, y], [x - 4, y - 7], [x + 8, y - 5], [x + 6, y + 3]], tone(base, 0.8 + hash(i, 7, v) * 0.3), INK, 0.9); }
  } }),
  house: (w, d, v) => ({ box: box(-w / 2 - 30, -260, w / 2 + 30, 10), draw: (c) => {
    shade(c, w, d); const wall = v === 1 ? '#cfc4a8' : '#d8ccb0', roofCol = v === 2 ? '#5a6a7a' : v === 1 ? '#8a5a3a' : '#9a7a4a';
    rrect(c, -w / 2, -120, w, 120, 2, wall, INK, 1.6);
    for (const x of [-w / 2 + 4, -w / 6, w / 6, w / 2 - 10]) line(c, [[x, -118], [x, -2]], '#5a4030', 6);
    line(c, [[-w / 2, -60], [w / 2, -60]], '#5a4030', 5); line(c, [[-w / 2, -116], [w / 2, -116]], '#5a4030', 6);
    stoneCourses(c, -w / 2 + 2, -2, w - 4, 18, '#8a8478', 3, 9);
    windowLit(c, -w / 3 - 14, -104, 28, 30, true); windowLit(c, w / 3 - 14, -104, 28, 30, v !== 2);
    c.beginPath(); c.moveTo(-22, -2); c.lineTo(-22, -64); c.quadraticCurveTo(0, -80, 22, -64); c.lineTo(22, -2); c.closePath(); c.fillStyle = '#5a3a24'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    roof(c, -w / 2, w / 2, -116, -232, roofCol);
    rrect(c, w / 4, -250, 26, 60, 2, '#7a7468', INK, 1.4);
  } }),
  kilnstack: (w, d, v) => ({ box: box(-w / 2 - 20, -420, w / 2 + 20, 10), draw: (c) => {
    shade(c, w, d);
    poly(c, [[-w / 2, 0], [-w / 2 + 10, -110], [w / 2 - 10, -110], [w / 2, 0]], '#7a4a3a', INK, 1.6);
    stoneCourses(c, -w / 2 + 3, -2, w - 6, 106, '#8a5a44', 11, 13);
    poly(c, [[-28, -110], [-20, -400], [20, -400], [28, -110]], '#6a3e30', INK, 1.6);
    for (let y = -120; y > -396; y -= 13) line(c, [[-26 + (-110 - y) / 290 * 8, y], [26 - (-110 - y) / 290 * 8, y]], 'rgba(30,14,10,0.35)', 1);
    rrect(c, -26, -410, 52, 14, 3, '#4a2a22', INK, 1.4);
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(-30, -48); c.quadraticCurveTo(0, -78, 30, -48); c.lineTo(30, 0); c.closePath(); c.fillStyle = '#2a1410'; c.fill(); c.strokeStyle = INK; c.stroke();
    ellipse(c, 0, -22, 22, 16, v ? '#ff9a3a' : '#e0642a'); ellipse(c, 0, -20, 12, 9, '#ffd070');
  } }),
  statue: (w, d, v) => ({ box: box(-w / 2 - 20, -250, w / 2 + 20, 10), draw: (c) => {
    shade(c, w, d); const stone = '#9a958a';
    rrect(c, -w / 2, -48, w, 48, 3, tone(stone, 0.8), INK, 1.5); rrect(c, -w / 2 - 6, -56, w + 12, 12, 2, stone, INK, 1.4);
    poly(c, [[-26, -56], [-30, -140], [-16, -196], [16, -196], [30, -140], [26, -56]], stone, INK, 1.6);
    poly(c, [[-26, -58], [-30, -140], [-16, -194], [-8, -140]], tone(stone, 1.15));
    ellipse(c, 0, -212, 16, 18, stone, INK, 1.4); poly(c, [[-18, -204], [0, -236], [18, -204]], tone(stone, 0.85), INK, 1.2);
    line(c, [[34, -50], [40, -236]], '#7a756a', 6); ellipse(c, 40, -240, 9, 9, v === 1 ? '#c8a0ff' : '#ffd070', INK, 1);
    for (let i = 0; i < 8; i++) ellipse(c, -30 + hash(i, 1, 4) * 60, -60 - hash(i, 2, 4) * 120, 6, 3, '#4f7a3c');
  } }),
  dryingrack: (w, d, v) => ({ box: box(-w / 2 - 10, -150, w / 2 + 10, 10), draw: (c) => {
    shade(c, w, d * 2);
    for (let i = 0; i <= 4; i++) { const x = -w / 2 + 8 + i * (w - 16) / 4; line(c, [[x - 10, 0], [x, -120]], '#5a4030', 5); line(c, [[x + 10, 0], [x, -120]], '#5a4030', 5); }
    line(c, [[-w / 2, -116], [w / 2, -116]], '#6a4a30', 6); line(c, [[-w / 2, -70], [w / 2, -70]], '#6a4a30', 4);
    for (let i = 0; i < 12; i++) {
      const x = -w / 2 + 16 + i * (w - 32) / 11;
      if (v === 1) { poly(c, [[x - 9, -114], [x + 9, -114], [x + 8, -80], [x - 8, -78]], ['#efe8d8', '#e0d8c4', '#f4f0e6'][i % 3], INK, 0.8); }
      else if (v === 2) { ellipse(c, x, -98, 4, 12, ['#a8bcc4', '#c8a07a', '#9ab0b8'][i % 3], INK, 0.7); line(c, [[x, -114], [x, -110]], '#c8b890', 1); }
      else { c.save(); c.globalAlpha = 0.75; poly(c, [[x - 12, -114], [x + 12, -114], [x + 8, -60], [x - 10, -62]], 'rgba(120,110,80,0.6)'); c.restore(); line(c, [[x - 8, -112], [x + 6, -64]], 'rgba(60,50,30,0.6)', 0.8); }
    }
  } }),
  boatwreck: (w, d, v) => ({ box: box(-w / 2 - 40, -230, w / 2 + 40, 16), draw: (c) => {
    shade(c, w, d);
    c.save(); c.rotate(-0.08);
    c.beginPath(); c.moveTo(-w / 2, -24); c.quadraticCurveTo(-w / 2 + 40, 10, 0, 12); c.quadraticCurveTo(w / 2 - 30, 10, w / 2, -40); c.lineTo(w / 2 - 20, -64); c.quadraticCurveTo(0, -40, -w / 2 + 16, -52); c.closePath();
    c.fillStyle = '#5a4030'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
    for (let i = 0; i < 9; i++) { const x = -w / 2 + 30 + i * (w - 60) / 8; line(c, [[x, 6], [x + 6, -54 - (i % 3) * 18]], '#3e2c20', 4); }
    for (let i = 0; i < 4; i++) line(c, [[-w / 2 + 20, -10 - i * 12], [w / 2 - 30, -16 - i * 14]], 'rgba(255,224,180,0.12)', 2);
    c.restore();
    line(c, [[-20, -40], [60, -210]], '#4a3424', 6); line(c, [[30, -150], [-70, -120]], '#c8b890', 1.2); poly(c, [[55, -200], [96, -150], [52, -150]], 'rgba(232,220,192,0.75)', INK, 1);
    for (let i = 0; i < 8; i++) ellipse(c, -w / 2 + hash(i, 1, v) * w, 4 - hash(i, 2, v) * 10, 10, 4, 'rgba(200,220,210,0.35)');
  } }),
  granary: (w, d) => ({ box: box(-w / 2 - 30, -300, w / 2 + 30, 10), draw: (c) => {
    shade(c, w, d);
    for (const x of [-w / 2 + 20, -w / 6, w / 6, w / 2 - 20]) { rrect(c, x - 9, -70, 18, 70, 3, '#8a8478', INK, 1.2); ellipse(c, x, -72, 18, 6, '#9a958a', INK, 1.2); }
    rrect(c, -w / 2, -170, w, 98, 2, '#7a5a3a', INK, 1.6);
    for (let x = -w / 2 + 12; x < w / 2; x += 16) line(c, [[x, -168], [x, -74]], 'rgba(20,12,8,0.35)', 1.2);
    rrect(c, -20, -150, 40, 70, 2, '#4a3424', INK, 1.2);
    roof(c, -w / 2, w / 2, -168, -286, '#c8a858', 20);
    for (let k = 0; k < 30; k++) line(c, [[-w / 2 - 10 + k * (w + 20) / 30, -168], [-w / 2 - 6 + k * (w + 20) / 30, -176]], 'rgba(120,90,30,0.45)', 1);
    line(c, [[w / 2 - 50, 0], [w / 2 - 34, -150]], '#6a5038', 3); line(c, [[w / 2 - 26, 0], [w / 2 - 10, -150]], '#6a5038', 3);
    for (let y = -18; y > -150; y -= 18) line(c, [[w / 2 - 48 + (-y / 150) * 16, y], [w / 2 - 24 + (-y / 150) * 16, y]], '#6a5038', 2);
    for (const x of [-w / 2 + 30, -w / 2 + 60]) { ellipse(c, x, -10, 14, 12, '#c8b48a', INK, 1); }
  } }),
  beacontower: (w, d) => ({ box: box(-w / 2 - 20, -380, w / 2 + 20, 10), draw: (c) => {
    shade(c, w, d);
    poly(c, [[-w / 2, 0], [-w / 2 + 20, -280], [w / 2 - 20, -280], [w / 2, 0]], '#8a857a', INK, 1.6);
    stoneCourses(c, -w / 2 + 4, -2, w - 8, 270, '#8a857a', 13, 18);
    rrect(c, -w / 2 + 6, -296, w - 12, 18, 2, '#9a958a', INK, 1.4);
    for (const x of [-w / 2 + 14, w / 2 - 22]) line(c, [[x, -296], [x + 4, -350]], '#3a3430', 5);
    c.beginPath(); c.moveTo(-40, -306); c.quadraticCurveTo(0, -290, 40, -306); c.lineTo(32, -330); c.lineTo(-32, -330); c.closePath(); c.fillStyle = '#3a3430'; c.fill(); c.strokeStyle = INK; c.stroke();
    ellipse(c, 0, -336, 30, 16, '#ff9a4a'); ellipse(c, 0, -342, 18, 12, '#ffe08a');
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-18, -44); c.quadraticCurveTo(0, -60, 18, -44); c.lineTo(18, 0); c.closePath(); c.fillStyle = '#3a2a20'; c.fill(); c.strokeStyle = INK; c.stroke();
  } }),
  pumphouse: (w, d) => ({ box: box(-w / 2 - 30, -300, w / 2 + 70, 10), draw: (c) => {
    shade(c, w, d);
    rrect(c, -w / 2, -140, w, 140, 2, '#8a5a44', INK, 1.6); stoneCourses(c, -w / 2 + 2, -2, w - 4, 136, '#8a5a44', 17, 14);
    windowLit(c, -w / 3 - 14, -110, 28, 34, true); windowLit(c, w / 3 - 14, -110, 28, 34, true);
    c.beginPath(); c.moveTo(-24, -2); c.lineTo(-24, -70); c.quadraticCurveTo(0, -88, 24, -70); c.lineTo(24, -2); c.closePath(); c.fillStyle = '#3e2a20'; c.fill(); c.strokeStyle = INK; c.stroke();
    roof(c, -w / 2, w / 2, -136, -220, '#4a5a66');
    rrect(c, -w / 2 + 30, -296, 30, 110, 2, '#6a4a3a', INK, 1.4);
    rrect(c, w / 2 - 8, -80, 70, 26, 12, '#5a6466', INK, 1.4); rrect(c, w / 2 + 50, -80, 22, 80, 4, '#5a6466', INK, 1.4); ellipse(c, w / 2 + 61, -2, 18, 6, '#24515c', INK, 1.2);
  } }),
  wellhouse: (w, d, v) => ({ box: box(-w / 2 - 24, -230, w / 2 + 24, 10), draw: (c) => {
    shade(c, w, d); const stone = v === 1 ? '#6a7a78' : '#8a857a';
    c.beginPath(); c.ellipse(0, -46, w * 0.36, 18, 0, 0, Math.PI); c.lineTo(w * 0.36, -6); c.ellipse(0, -6, w * 0.36, 18, 0, 0, Math.PI, false); c.lineTo(-w * 0.36, -46); c.closePath(); c.fillStyle = stone; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    ellipse(c, 0, -46, w * 0.36, 18, tone(stone, 1.1), INK, 1.4); ellipse(c, 0, -46, w * 0.28, 12, '#1c2a30');
    for (const s of [-1, 1]) line(c, [[s * w * 0.38, -30], [s * w * 0.34, -170]], '#5a4030', 7);
    poly(c, [[-w * 0.5, -166], [0, -214], [w * 0.5, -166], [w * 0.44, -158], [0, -200], [-w * 0.44, -158]], '#6a4a30', INK, 1.4);
    line(c, [[-w * 0.34, -140], [w * 0.34, -140]], '#4a3424', 4); line(c, [[6, -140], [6, -90]], '#c8b890', 1.2); rrect(c, -2, -94, 16, 14, 2, '#6a4a2e', INK, 1);
  } }),
  signaltower: (w, d) => ({ box: box(-w / 2 - 30, -420, w / 2 + 40, 10), draw: (c) => {
    shade(c, w, d);
    rrect(c, -w / 2, -40, w, 40, 3, '#5a5650', INK, 1.4);
    for (const s of [-1, 1]) line(c, [[s * w * 0.4, -38], [s * 10, -380]], '#6a5a42', 7);
    for (let y = -70; y > -360; y -= 48) { const k = (-y - 38) / 342, hw = w * 0.4 * (1 - k) + 10 * k; line(c, [[-hw, y], [hw, y - 40]], '#6a5a42', 3); line(c, [[hw, y], [-hw, y - 40]], '#6a5a42', 3); }
    rrect(c, -40, -410, 80, 38, 3, '#2a2420', '#9a8054', 3);
    for (let i = 0; i < 6; i++) rrect(c, -34 + i * 12, -404, 7, 26, 1, i % 2 ? '#d4af37' : '#8a7030');
    flag(c, 40, -380, '#e8c35a'); flag(c, -40, -300, '#2a6a9a');
  } }),
  waterwheel: (w, d) => ({ box: box(-90, -200, 90, 20), rotor: { x: 0, y: -80, r: 70, kind: 'wheel' }, draw: (c) => {
    shade(c, w, d);
    for (const s of [-1, 1]) { rrect(c, s * 70 - 7, -150, 14, 150, 2, '#5a4030', INK, 1.3); }
    line(c, [[-70, -150], [70, -150]], '#4a3424', 8); rrect(c, -30, -190, 60, 16, 2, '#6a4a30', INK, 1.2);
    c.save(); c.globalAlpha = 0.6; poly(c, [[-12, -175], [12, -175], [16, -150], [-16, -150]], '#9ad0d8'); c.restore();
  } }),
  pumpengine: (w, d) => ({ box: box(-w / 2 - 20, -230, w / 2 + 20, 10), draw: (c) => {
    shade(c, w, d);
    rrect(c, -w / 2, -60, w, 60, 4, '#4a4a46', INK, 1.6);
    for (let x = -w / 2 + 16; x < w / 2; x += 32) ellipse(c, x, -54, 5, 3, '#8a8a80');
    rrect(c, -w / 2 + 20, -170, 70, 112, 6, '#5a6466', INK, 1.5); line(c, [[-w / 2 + 28, -164], [-w / 2 + 28, -62]], 'rgba(220,230,240,0.25)', 3);
    ellipse(c, w / 4, -120, 52, 52, undefined, '#3a3430', 9); ellipse(c, w / 4, -120, 52, 52, undefined, '#9a8054', 3);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; line(c, [[w / 4, -120], [w / 4 + Math.cos(a) * 50, -120 + Math.sin(a) * 50]], '#6a5a42', 4); }
    ellipse(c, w / 4, -120, 10, 10, '#3a3430', INK, 1.2);
    rrect(c, -w / 2 + 40, -220, 26, 54, 3, '#6a4a3a', INK, 1.3); line(c, [[-w / 2 + 90, -100], [w / 4 - 40, -110]], '#5a6466', 12);
  } }),
  tank: (w, d) => ({ box: box(-w / 2 - 16, -220, w / 2 + 16, 10), draw: (c) => {
    shade(c, w, d);
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#6a8080'); g.addColorStop(0.5, '#4e6464'); g.addColorStop(1, '#344646');
    c.beginPath(); c.moveTo(-w / 2, -16); c.lineTo(-w / 2, -180); c.ellipse(0, -180, w / 2, 26, 0, Math.PI, 0); c.lineTo(w / 2, -16); c.ellipse(0, -16, w / 2, 26, 0, 0, Math.PI); c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
    for (const y of [-60, -120]) { c.beginPath(); c.ellipse(0, y, w / 2, 26, 0, 0, Math.PI); c.strokeStyle = '#2a3434'; c.lineWidth = 4; c.stroke(); }
    ellipse(c, 0, -180, w / 2, 26, '#5e7676', INK, 1.4); ellipse(c, 0, -180, w / 2 - 14, 18, '#1e4a50');
    line(c, [[-w / 2 + 14, -170], [-w / 2 + 14, -30]], 'rgba(220,240,240,0.2)', 4);
  } }),
  relayrack: (w, d) => ({ box: box(-w / 2 - 16, -210, w / 2 + 16, 10), draw: (c) => {
    shade(c, w, d);
    rrect(c, -w / 2, -170, w, 170, 4, '#3c3f48', INK, 1.6);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) { const on = hash(r, k, 5) > 0.45; rrect(c, -w / 2 + 14 + k * (w - 28) / 6, -156 + r * 30, (w - 28) / 6 - 6, 18, 2, on ? '#2a2440' : '#1e1e26', INK, 0.8); if (on) ellipse(c, -w / 2 + 22 + k * (w - 28) / 6, -147 + r * 30, 3, 3, ['#c8a0ff', '#7ab8e8', '#ffd070'][(r + k) % 3]); }
    rrect(c, -w / 2 - 6, -186, w + 12, 18, 3, '#565a66', INK, 1.4); for (const x of [-w / 3, w / 3]) line(c, [[x, -186], [x + 10, -206]], '#9a8054', 3);
  } }),
};

export function structureArt(kind: string, w: number, d: number, v = 0): StructureArt | null { const f = ART[kind]; return f ? f(w, d, v) : null; }
/** Rotating parts (windmill sails, water wheel), baked separately so they can turn. */
export function rotorArt(kind: 'sails' | 'wheel', r: number): StructureArt {
  if (kind === 'wheel') return { box: box(-r - 6, -r - 6, r + 6, r + 6), draw: (c) => {
    ellipse(c, 0, 0, r, r, undefined, '#5a4030', 6); ellipse(c, 0, 0, r * 0.75, r * 0.75, undefined, '#4a3424', 3);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); line(c, [[ca * 8, sa * 8], [ca * r * 0.96, sa * r * 0.96]], '#5a4030', 3.4); c.save(); c.translate(ca * r * 0.96, sa * r * 0.96); c.rotate(a); rrect(c, -3, -9, 10, 18, 1.5, '#7a5a3a', INK, 1); c.restore(); }
    ellipse(c, 0, 0, 9, 9, '#3a2a1e', INK, 1.2);
  } };
  return { box: box(-r - 8, -r - 8, r + 8, r + 8), draw: (c) => {
    for (let k = 0; k < 4; k++) {
      c.save(); c.rotate((k * Math.PI) / 2);
      line(c, [[0, 0], [0, -r]], '#4a3424', 6);
      poly(c, [[4, -18], [r * 0.22, -22], [r * 0.22, -r], [4, -r + 6]], 'rgba(232,220,192,0.92)', INK, 1.2);
      for (let y = -30; y > -r; y -= 18) line(c, [[4, y], [r * 0.22, y]], 'rgba(90,70,50,0.45)', 1);
      c.restore();
    }
    ellipse(c, 0, 0, 10, 10, '#3a2a20', INK, 1.4);
  } };
}
