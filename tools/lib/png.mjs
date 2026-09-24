// Minimal RGB(A) PNG writer and reader for evidence images; no dependencies beyond zlib.
import zlib from 'node:zlib';

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** `pixels` holds `channels` bytes per pixel, rows top to bottom. */
export function encodePng(width, height, pixels, channels = 3) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  const stride = width * channels, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Reads 8-bit RGB or RGBA PNGs as written by Chrome and by encodePng; returns RGBA. */
export function decodePng(buffer) {
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos), name = buffer.toString('ascii', pos + 4, pos + 8), data = buffer.subarray(pos + 8, pos + 8 + length);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || (type !== 2 && type !== 6) || data[12] !== 0) throw new Error('unsupported PNG');
    } else if (name === 'IDAT') idat.push(data);
    pos += 12 + length;
  }
  const channels = type === 6 ? 4 : 3, stride = width * channels, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(width * height * 4), prev = new Uint8Array(stride), line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 3; k++) out[(y * width + x) * 4 + k] = line[x * channels + k];
      out[(y * width + x) * 4 + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}
