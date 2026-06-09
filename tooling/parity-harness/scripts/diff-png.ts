import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// diff-png.ts <a> <b> <out>
const [a, b, out] = process.argv.slice(2);
const A = PNG.sync.read(readFileSync(a));
const B = PNG.sync.read(readFileSync(b));
const w = Math.min(A.width, B.width);
const h = Math.min(A.height, B.height);
const diff = new PNG({ width: w, height: h });
const crop = (p: PNG) => {
  if (p.width === w && p.height === h) return p.data;
  const d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    p.data.copy(d, y * w * 4, y * p.width * 4, y * p.width * 4 + w * 4);
  }
  return d;
};
const n = pixelmatch(crop(A), crop(B), diff.data, w, h, { threshold: 0.15 });
writeFileSync(out, PNG.sync.write(diff));
console.log(`${out} diffPx=${n} (${((n / (w * h)) * 100).toFixed(2)}% of ${w}x${h})`);
