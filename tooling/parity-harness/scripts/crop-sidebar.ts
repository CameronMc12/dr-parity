import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

// crop-sidebar.ts <src> <dst> [left] [top] [width] [height]
const [src, dst, l = '64', t = '0', w = '256', h = '900'] = process.argv.slice(2);
const left = Number(l), top = Number(t);
const png = PNG.sync.read(readFileSync(src));
const width = Math.min(Number(w), png.width - left);
const height = Math.min(Number(h), png.height - top);
const out = new PNG({ width, height });
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const si = ((top + y) * png.width + (left + x)) << 2;
    const di = (y * width + x) << 2;
    out.data[di] = png.data[si];
    out.data[di + 1] = png.data[si + 1];
    out.data[di + 2] = png.data[si + 2];
    out.data[di + 3] = png.data[si + 3];
  }
}
mkdirSync(dst.substring(0, dst.lastIndexOf('/')), { recursive: true });
writeFileSync(dst, PNG.sync.write(out));
console.log(`${dst} ${width}x${height}`);
