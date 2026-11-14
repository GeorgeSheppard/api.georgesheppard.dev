import { deflateSync, crc32 } from 'node:zlib';

/** Encode a tiny RGBA PNG from rows of hex colours ('#rrggbb', '#rrggbbaa' or '.' for transparent). */
export function pngFromGrid(rows: string[]): Buffer {
  const h = rows.length,
    w = rows[0]?.length ? rows[0].split(/\s+/).length : 0;
  if (!h || !w || h > 128 || w > 128) throw new Error('grid must be 1..128 per side');
  const raw = Buffer.alloc(h * (1 + w * 4));
  rows.forEach((row, y) => {
    const cells = row.trim().split(/\s+/);
    if (cells.length !== w) throw new Error(`row ${y} has ${cells.length} cells, expected ${w}`);
    raw[y * (1 + w * 4)] = 0;
    cells.forEach((c, x) => {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      if (c !== '.') {
        const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
        if (!m) throw new Error(`bad colour "${c}"`);
        const n = parseInt(m[1], 16);
        r = n >> 16;
        g = (n >> 8) & 255;
        b = n & 255;
        a = m[2] ? parseInt(m[2], 16) : 255;
      }
      raw.set([r, g, b, a], y * (1 + w * 4) + 1 + x * 4);
    });
  });
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
