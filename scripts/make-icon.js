// Rasterizza il logo Omnia in build/icon.ico (PNG 256x256 incapsulato in ICO).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const N = 256;
const polys = [
  { pts: [[245,25],[1000,25],[1000,195],[530,535],[0,535],[0,200]], hole: [[360,195],[605,195],[605,245],[465,365],[280,365],[280,255]] },
  { pts: [[1000,250],[1000,535],[605,535]] }
];
function inside(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const scale = 190 / 1000, ox = (N - 1000 * scale) / 2, oy = (N - 560 * scale) / 2;
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const lx = (x - ox) / scale, ly = (y - oy) / scale;
    let on = false;
    for (const q of polys) if (inside(q.pts, lx, ly) && !(q.hole && inside(q.hole, lx, ly))) on = true;
    const o = y * (N * 4 + 1) + 1 + x * 4;
    const c = on ? [0xEC, 0xE8, 0xE1] : [0xFF, 0x46, 0x55];
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
  }
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const hdr = Buffer.alloc(22);
hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
hdr[6] = 0; hdr[7] = 0; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12);
hdr.writeUInt32LE(png.length, 14); hdr.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), Buffer.concat([hdr, png]));
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), png);
console.log('icon ok');
