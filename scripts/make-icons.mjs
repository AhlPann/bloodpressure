// Erzeugt die PNG-App-Icons (Herz mit Pulslinie) ohne externe Abhängigkeiten.
// Aufruf: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const RED = [180, 35, 47];
const WHITE = [255, 255, 255];

// Geometrie im 64×64-Raster, identisch mit public/favicon.svg
const circles = [
  [21.4, 25.8, 11],
  [42.6, 25.8, 11],
];
const heartPoly = [[13.6, 33.6], [29.2, 18], [32, 20.8], [34.8, 18], [50.4, 33.6], [32, 52]];
const pulse = [[16, 34], [25, 34], [28, 28], [33, 40], [37, 32], [48, 32]];
const PULSE_HALF_WIDTH = 1.5;

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

const inHeart = (x, y) => circles.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r) || inPolygon(x, y, heartPoly);
const onPulse = (x, y) => pulse.slice(1).some((p, i) => distToSegment(x, y, pulse[i], p) <= PULSE_HALF_WIDTH);

function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * @param size Kantenlänge in Pixeln
 * @param scale Größe des Motivs relativ zur Fläche (maskable: kleiner, wegen Sicherheitszone)
 * @param radius Eckenradius des Hintergrunds im 64er-Raster (0 = volle Fläche)
 */
function render(size, { scale = 1, radius = 0 } = {}) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxx = 0; pxx < size; pxx++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((pxx + (sx + 0.5) / SS) / size) * 64;
          const v = ((py + (sy + 0.5) / SS) / size) * 64;
          if (radius && !inRoundedRect(u, v, radius)) continue;
          const mu = 32 + (u - 32) / scale;
          const mv = 32 + (v - 32) / scale;
          const c = inHeart(mu, mv) && !onPulse(mu, mv) ? WHITE : RED;
          r += c[0]; g += c[1]; b += c[2]; a += 255;
        }
      }
      const n = SS * SS;
      const o = (py * size + pxx) * 4;
      // vormultiplizierte Summe → gerade Farbe
      px[o] = a ? Math.round((r * 255) / a) : 0;
      px[o + 1] = a ? Math.round((g * 255) / a) : 0;
      px[o + 2] = a ? Math.round((b * 255) / a) : 0;
      px[o + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bit-Tiefe
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const files = {
  'icon-192.png': render(192, { radius: 14 }),
  'icon-512.png': render(512, { radius: 14 }),
  'maskable-512.png': render(512, { scale: 0.72 }),
  'apple-touch-icon.png': render(180),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, out), data);
  console.log(`public/icons/${name} (${data.length} Bytes)`);
}
