// Original material marks. References and palette relationships: town/REFERENCES S02.
import type { Point } from '@shared/townTypes';

export type Paint = CanvasRenderingContext2D;
export const TOWN_INK = '#211c1b';
export function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function field(x: number, y: number, seed: number): number {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=noise(ix,iy,seed),b=noise(ix+1,iy,seed),d=noise(ix,iy+1,seed),e=noise(ix+1,iy+1,seed);
  return a+(b-a)*u+(d-a)*v+(a-b-d+e)*u*v;
}
export function path(c: Paint, points: readonly Point[]) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
}
export function polygon(c: Paint, p: readonly Point[], fill: string, stroke?: string, width = 1) {
  path(c, p); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
export function line(c: Paint, p: readonly Point[], color: string, width = 1) {
  c.beginPath(); p.forEach((v, i) => i ? c.lineTo(...v) : c.moveTo(...v));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
}
export function beam(c: Paint, a: Point, b: Point, width: number, pale = false) {
  line(c, [a, b], TOWN_INK, width + 3);
  line(c, [a, b], pale ? '#796c55' : '#544638', width);
  line(c, [[a[0] - 1, a[1] - 1], [b[0] - 1, b[1] - 1]], pale ? '#97876a' : '#77644b', 1.2);
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  for (let t = 16; t < len; t += 43) {
    const x = a[0] + dx * t / len, y = a[1] + dy * t / len;
    c.fillStyle = '#282725'; c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
  }
}
export function stones(c: Paint, width: number, height: number, seed: number) {
  for (let row = 0; row * 17 < height; row++) for (let col = -1; col * 33 < width; col++) {
    const n = noise(col, row, seed), x = col * 33 + (row % 2) * 16, y = row * 17;
    const w = 29 + n * 4, h = 14 + noise(row, col, seed) * 2;
    const v = Math.round(54 + n * 20);
    polygon(c, [[x + 3,y+1],[x+w-3,y],[x+w,y+4],[x+w-1,y+h-2],[x+4,y+h],[x,y+h-4]], `rgb(${v+7},${v+5},${v+3})`, '#343333', 1.5);
    line(c, [[x+4,y+2],[x+w-4,y+1]], 'rgba(189,179,154,.18)', 1);
    if(n>.8)line(c,[[x+w*.5,y+1],[x+w*.42,y+6],[x+w*.63,y+11]],'#40413c',.8);
  }
}
export function windowPane(c: Paint, x: number, y: number, w: number, h: number, lit: boolean) {
  c.fillStyle = TOWN_INK; c.fillRect(x-4,y-4,w+8,h+8);
  c.fillStyle = lit ? '#bf8750' : '#242a2e'; c.fillRect(x,y,w,h);
  c.fillStyle = lit ? '#edc481' : '#3c4749'; c.fillRect(x+2,y+2,w*.65,h-5);
  line(c, [[x+w*.52,y],[x+w*.52,y+h]], '#4b3d30', 3);
  line(c, [[x,y+h*.46],[x+w,y+h*.46]], '#4b3d30', 3);
  beam(c,[x-5,y+h+3],[x+w+5,y+h+3],5,true);
  for(const dx of [-10,w+5]) {
    c.fillStyle='#514a3c';c.fillRect(x+dx,y,7,h);
    for(let yy=4;yy<h;yy+=7)line(c,[[x+dx,y+yy],[x+dx+7,y+yy-1]],'#726852',1);
  }
}
