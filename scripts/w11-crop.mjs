// Crop carousel region from full screenshots using sharp.
import sharp from 'sharp';
import { existsSync } from 'node:fs';

const FILES = [
  ['/tmp/w11/dev-fullpage.png', '/tmp/w11/dev-tv.png'],
  ['/tmp/w11/preview-fullpage.png', '/tmp/w11/preview-tv.png'],
];
// TV gallery top=4071 h=523, but at devicePixelRatio=1 the screenshot is 1:1
const cropY = 3950, cropH = 700;

for (const [src, dst] of FILES) {
  if (!existsSync(src)) continue;
  await sharp(src).extract({ left: 0, top: cropY, width: 1440, height: cropH }).toFile(dst);
  console.log('wrote', dst);
}
