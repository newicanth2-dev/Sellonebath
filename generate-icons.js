/**
 * PWA Icon Generator - Pure Node.js (no dependencies)
 * สร้างไอคอน PNG 192x192 และ 512x512 สำหรับ PWA
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---- PNG encoder ----
function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row
  const IHDR = chunk("IHDR", Buffer.from([
    (width >> 24) & 0xff, (width >> 16) & 0xff, (width >> 8) & 0xff, width & 0xff,
    (height >> 24) & 0xff, (height >> 16) & 0xff, (height >> 8) & 0xff, height & 0xff,
    8, // bit depth
    2, // color type: RGB (no alpha for maskable icons)
    0, 0, 0 // compression, filter, interlace
  ]));

  // Build raw image data (filter byte 0 per row)
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 3) + 1 + x * 3;
      raw[dst]     = pixels[src];     // R
      raw[dst + 1] = pixels[src + 1]; // G
      raw[dst + 2] = pixels[src + 2]; // B
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  const IDAT = chunk("IDAT", compressed);
  const IEND = chunk("IEND", Buffer.alloc(0));

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, IHDR, IDAT, IEND]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff);
}

// ---- Icon renderer ----
function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Red gradient: top-left bright red → bottom-right dark red
      const t = (x + y) / (2 * size);
      const r = Math.round(239 - t * 60);  // 239 → 179
      const g = Math.round(68  - t * 42);  // 68  → 26
      const b = Math.round(68  - t * 42);  // 68  → 26
      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  // Draw bitmap glyphs for "฿1" in the center
  drawGlyph(pixels, size, getBahtGlyph(),   Math.floor(size * 0.18), Math.floor(size * 0.14), Math.floor(size * 0.37));
  drawGlyph(pixels, size, getOneGlyph(),    Math.floor(size * 0.50), Math.floor(size * 0.10), Math.floor(size * 0.65));
  // Draw small dots/stripe decoration
  drawBar(pixels, size, Math.floor(size * 0.70), Math.floor(size * 0.18), Math.floor(size * 0.82), 3);

  return pixels;
}

// Draw a glyph (2D boolean array) at position, scaled to targetHeight
function drawGlyph(pixels, canvasSize, glyph, x, y, targetH) {
  const rows = glyph.length;
  const cols = glyph[0].length;
  const scale = targetH / rows;
  const w = Math.round(cols * scale);
  const h = Math.round(rows * scale);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const gy = Math.floor(py / scale);
      const gx = Math.floor(px / scale);
      if (gy < rows && gx < cols && glyph[gy][gx]) {
        const cx = x + px;
        const cy = y + py;
        if (cx >= 0 && cx < canvasSize && cy >= 0 && cy < canvasSize) {
          const idx = (cy * canvasSize + cx) * 4;
          pixels[idx]     = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 255;
        }
      }
    }
  }
}

function drawBar(pixels, canvasSize, y, x1, x2, thickness) {
  for (let dy = 0; dy < thickness; dy++) {
    for (let x = x1; x < x2; x++) {
      const cy = y + dy;
      if (cy < canvasSize && x < canvasSize) {
        const idx = (cy * canvasSize + x) * 4;
        pixels[idx]     = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
        pixels[idx + 3] = 180;
      }
    }
  }
}

// Pixel art bitmap for "฿" (Thai Baht sign) - 7 cols × 11 rows
function getBahtGlyph() {
  return [
    [0,1,1,1,0,0,0],
    [0,1,0,0,1,0,0],
    [0,1,0,0,1,0,0],
    [0,1,1,1,0,0,0],
    [0,1,0,0,1,0,0],
    [0,1,0,0,1,0,0],
    [0,1,1,1,0,0,0],
    [1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0],
  ];
}

// Pixel art bitmap for "1" - 5 cols × 11 rows
function getOneGlyph() {
  return [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,1,1,0],
    [0,0,0,0,0],
  ];
}

// ---- Generate both sizes ----
const outDir = __dirname;

for (const size of [192, 512]) {
  const pixels = renderIcon(size);
  const png = createPNG(size, size, pixels);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Created ${outPath} (${png.length} bytes)`);
}

console.log("Done! อัพเดต manifest.json ต่อได้เลย");
