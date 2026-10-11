// node scripts/perf/png.mjs a.png b.png [out-heatmap.png] [mask=circle:cx,cy,r] -> per-channel max/mean abs diff (inside mask)
import fs from 'node:fs'; import zlib from 'node:zlib';
export function decode(file) { const buf = fs.readFileSync(file); let o = 8, width, height, bpp, idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bpp = data[9] === 6 ? 4 : 3; } if (type === 'IDAT') idat.push(data); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * bpp, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) { const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), prev = y ? px.subarray((y - 1) * stride, y * stride) : null, cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } cur[i] = v & 255; } }
  return { width, height, bpp, px }; }
export function encode(file, w, h, rgb) {
  const rows = []; for (let y = 0; y < h; y++) { const r = Buffer.alloc(1 + w * 3); rgb.copy(r, 1, y * w * 3, (y + 1) * w * 3); rows.push(r); }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]));
}
if (process.argv[1].endsWith('png.mjs')) {
  const [fa, fb, out, maskArg] = process.argv.slice(2);
  const A = decode(fa), B = decode(fb); const W = A.width, H = A.height;
  let mask = null; if (maskArg && maskArg.startsWith('circle:')) { const [cx, cy, r] = maskArg.slice(7).split(',').map(Number); mask = (x, y) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r; }
  const max = [0, 0, 0], sum = [0, 0, 0]; let n = 0, over2 = 0, over8 = 0; const heat = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * A.bpp, j = (y * W + x) * B.bpp, h = (y * W + x) * 3;
    if (mask && !mask(x, y)) { heat[h] = heat[h + 1] = heat[h + 2] = 40; continue; }
    n++; let dm = 0; for (let k = 0; k < 3; k++) { const d = Math.abs(A.px[i + k] - B.px[j + k]); max[k] = Math.max(max[k], d); sum[k] += d; dm = Math.max(dm, d); }
    if (dm > 2) over2++; if (dm > 8) over8++;
    heat[h] = Math.min(255, dm * 16); heat[h + 1] = A.px[i + 1] >> 2; heat[h + 2] = A.px[i + 2] >> 2; }
  if (out) encode(out, W, H, heat);
  console.log(JSON.stringify({ pixels: n, max, mean: sum.map((s) => +(s / n).toFixed(3)), over2, over8 }));
}
