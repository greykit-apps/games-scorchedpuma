#!/usr/bin/env node
/* Scorched Puma's icons, from one pixel drawing: a puma-crewed tank firing,
 * in the battlefield's 16-bit manner.
 *
 *   node tools/make-icons.js
 *
 * Writes icon.svg (crisp rects), favicon-16x16.png, favicon-32x32.png,
 * apple-touch-icon.png (180) and favicon.ico (16, 32, 48, each a PNG
 * inside). No dependencies: the PNG and ICO writers are below. The share
 * card is tools/og.html, rendered in a browser. */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");

/* the drawing, 32 x 32: a puma crew's tank under a dithered night sky, a shot
 * bursting overhead. Drawn in the browser with the game's own art (js/art.js)
 * and kept here as pixels, so this tool needs nothing but node. */
const PAL = { a: "#081028", b: "#0b1735", c: "#8a1410", d: "#d8261c", e: "#fff3a0", f: "#ff5a28", g: "#ffd23f", h: "#ff9a3c", i: "#0f1e42", j: "#ffffff", k: "#0b0d14", l: "#f4f6fa", m: "#d4d8e2", n: "#6b7080", o: "#132550", p: "#c98f4f", q: "#cfd8ff", r: "#ecca98", s: "#5a3618", t: "#172c5d", u: "#dfb47e", v: "#e9cba6", w: "#d8a25e", x: "#926e3f", y: "#61482a", z: "#1b336a", A: "#3c3f4a", B: "#2b2d36", C: "#a4a9b6", D: "#555a66", E: "#1a1b22", F: "#b8e070", G: "#8cc04a", H: "#4a6a26", I: "#6f9a3c", J: "#5a7e30" };
const PLATE = "#05070f";
const ART = [
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "babababababababababababababababa",
  "ababababababababababababccdccbab",
  "bbbbbbbbbbbbbbbbbbbbbebcdfffdcgb",
  "bbbbbbbbbbbbbbbbbbbbbbcdfhghfdcb",
  "bbibbbibbbibbbibbbibbbcfhggghfcb",
  "bbbibbbibbbibbbibbbibbdfgejggfdi",
  "iiibiiibiiibiiibiiibkicfhggghfcb",
  "bibibibibibibibibibkblcdfhghfdci",
  "iiiiiiiiiiiiiiiiiikimincdfffddii",
  "iiiiiiikiiikiiiiikimineiccdcciii",
  "oioioikpkkkpkiokkimqniqioioiohoi",
  "ioioiokrppsrkokqmminioioiqioioio",
  "ooooookppppskkomonnooooooooooooo",
  "ioooiokpprrrkkkonoooioooioooiooo",
  "toootookkkuvuuuktoootoootoootooo",
  "otoootookvvwwwwwktoootoootoootoo",
  "tototkkkuuwwwwwwxkkktotototototo",
  "ototkuvvvvvvuuuuuuuuktototototot",
  "tttkwwwwwwwwwwwwwwwwwktttttttttt",
  "tttkyxxxxxxxxxxyyyxxyktttttttttt",
  "ztztkAAAAAAAAAAAAAAAktztztztztzt",
  "tztkBBCDBCDBCDBCDBCDBktztztztztz",
  "zzzzkEnEEnEEnEEnEEnEkzzzzzzzzzzz",
  "FFFFFkkkkkkkkkkkkkkkFFFFFFFFFFFF",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "HIIIIIIIIHIIIIIIIIHIIIIIIIIHIIII",
  "IIHIIIIIIIIHIIIIIIIIHIIIIIIIIHII",
  "JJJJHJJJJJJJJHJJJJJJJJHJJJJJJJJH",
  "JJJJJJHJJJJJJJJHJJJJJJJJHJJJJJJJ",
  "JJJJJJJJHJJJJJJJJHJJJJJJJJHJJJJJ",
];
const N = ART.length, PAD = 0, SIDE = N;

/* ---- icon.svg ---- */
const rects = [];
ART.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) rects.push(`<rect x="${x + PAD}" y="${y + PAD}" width="1" height="1" fill="${PAL[ch]}"/>`); }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}" shape-rendering="crispEdges">
<rect width="${SIDE}" height="${SIDE}" rx="4" fill="${PLATE}"/>
<clipPath id="p"><rect width="${SIDE}" height="${SIDE}" rx="4"/></clipPath>
<g clip-path="url(#p)">
${rects.join("\n")}
</g>
</svg>
`;
fs.writeFileSync(path.join(ROOT, "icon.svg"), svg);

/* ---- rasters: each output pixel the average of 4x4 samples of the drawing ---- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cellAt = (gx, gy) => {
  /* rounded plate corners, radius 3 cells */
  const r = 4, cx = gx < r ? r : gx > SIDE - r ? SIDE - r : gx, cy = gy < r ? r : gy > SIDE - r ? SIDE - r : gy;
  if (Math.hypot(gx - cx, gy - cy) > r) return null;
  const x = Math.floor(gx) - PAD, y = Math.floor(gy) - PAD;
  const ch = x >= 0 && y >= 0 && x < N && y < N ? ART[y][x] : ".";
  return hex(PAL[ch] || PLATE);
};
function raster(size) {
  const px = Buffer.alloc(size * size * 4), S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = cellAt((x + (sx + 0.5) / S) / size * SIDE, (y + (sy + 0.5) / S) / size * SIDE);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const i = (y * size + x) * 4;
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; px[i + 3] = 255 * a / (S * S); }
  }
  return png(size, size, px);
}

/* ---- a minimal PNG writer: RGBA, no filtering ---- */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/* ---- ICO: a directory of PNGs ---- */
function ico(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let off = 6 + 16 * images.length;
  const dir = images.map(([size, data]) => {
    const e = Buffer.alloc(16);
    e[0] = size % 256; e[1] = size % 256; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(off, 12); off += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map(([, d]) => d)]);
}

fs.writeFileSync(path.join(ROOT, "favicon-16x16.png"), raster(16));
fs.writeFileSync(path.join(ROOT, "favicon-32x32.png"), raster(32));
fs.writeFileSync(path.join(ROOT, "apple-touch-icon.png"), raster(180));
fs.writeFileSync(path.join(ROOT, "favicon.ico"), ico([[16, raster(16)], [32, raster(32)], [48, raster(48)]]));
console.log("wrote icon.svg, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png, favicon.ico");
