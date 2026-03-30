import { mkdirSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const BASE = path.resolve(import.meta.dirname, "..");

const IMAGES = [
  ["https://a.storyblok.com/f/337048/147x41/4343e31b5a/ryder.svg", "ryder.svg"],
  ["https://a.storyblok.com/f/337048/181x34/ff208a2c17/prologis.svg", "prologis.svg"],
  ["https://a.storyblok.com/f/337048/118x46/d178bf93df/nfi.svg", "nfi.svg"],
  ["https://a.storyblok.com/f/337048/170x44/9386c9fae8/lineage.svg", "lineage.svg"],
  ["https://a.storyblok.com/f/337048/114x45/04e08dca33/8vc.svg", "8vc.svg"],
  ["https://a.storyblok.com/f/337048/5112x3410/74c4e40128/quote-image.jpg/m/1970x0/filters:format(jpeg):quality(85)", "quote-bg.jpg"],
  ["https://a.storyblok.com/f/337048/322x111/af7139842d/logo-05.png", "ryder-dark.png"],
  ["https://a.storyblok.com/f/337048/300x94/ee9cdac15b/coca-cola.svg", "coca-cola.svg"],
  ["https://a.storyblok.com/f/337048/2500x2500/6c9f6434ea/hp.svg", "hp.svg"],
  ["https://terminal-industries.com/static/images/gartner.svg", "gartner.svg"],
  ["https://terminal-industries.com/static/images/linkedin.svg", "linkedin.svg"],
  ["https://terminal-industries.com/static/images/x.svg", "x.svg"],
  ["https://terminal-industries.com/static/images/youtube.svg", "youtube.svg"],
];

const VIDEOS = [
  ["https://a.storyblok.com/f/337048/x/85fd9d83d7/vid_4-1_wide_prerender_1.mp4", "benefit-01-wide.mp4"],
  ["https://a.storyblok.com/f/337048/x/cca5bc6b32/vid_4-1_vert_prerender_1.mp4", "benefit-01-vert.mp4"],
  ["https://a.storyblok.com/f/337048/x/b29a0119a7/vid_4-2_wide_prerender_1.mp4", "benefit-02-wide.mp4"],
  ["https://a.storyblok.com/f/337048/x/cd4b14d97d/vid_4-2_vert_prerender_1.mp4", "benefit-02-vert.mp4"],
  ["https://a.storyblok.com/f/337048/x/0f153ebd58/vid_4-3_wide_v02_1.mp4", "benefit-03-wide.mp4"],
  ["https://a.storyblok.com/f/337048/x/6aa67249be/vid_4-3_vert_v02_1.mp4", "benefit-03-vert.mp4"],
  ["https://a.storyblok.com/f/337048/x/f0f51ea10f/vid_3-1_prerender_1.mp4", "feature-01.mp4"],
  ["https://a.storyblok.com/f/337048/x/5c039660e1/vid_3-3_prerender_1.mp4", "feature-02.mp4"],
  ["https://a.storyblok.com/f/337048/x/daeedd63c8/vid_3-5_prerender_1.mp4", "feature-03.mp4"],
  ["https://a.storyblok.com/f/337048/x/5d1992bef6/vid_3-2_prerender_1.mp4", "feature-04.mp4"],
  ["https://a.storyblok.com/f/337048/x/cbcaf12722/hp-where-4.mp4", "hero-bg.mp4"],
  ["https://a.storyblok.com/f/337048/x/408e8d26ba/vid_5-4_prerender_1.mp4", "feature-05.mp4"],
];

const IMAGES_DIR = path.join(BASE, "public", "images");
const VIDEOS_DIR = path.join(BASE, "public", "videos");

mkdirSync(IMAGES_DIR, { recursive: true });
mkdirSync(VIDEOS_DIR, { recursive: true });

async function downloadFile(url, destPath) {
  const label = path.basename(destPath);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const body = Readable.fromWeb(res.body);
    await pipeline(body, createWriteStream(destPath));
    console.log(`  OK  ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}: ${err.message}`);
  }
}

async function downloadBatch(items, dir, concurrency = 4) {
  const queue = items.map(([url, name]) => [url, path.join(dir, name)]);
  const active = new Set();

  for (const [url, dest] of queue) {
    const p = downloadFile(url, dest).then(() => active.delete(p));
    active.add(p);
    if (active.size >= concurrency) {
      await Promise.race(active);
    }
  }
  await Promise.all(active);
}

async function main() {
  console.log("Downloading images...");
  await downloadBatch(IMAGES, IMAGES_DIR);
  console.log("\nDownloading videos...");
  await downloadBatch(VIDEOS, VIDEOS_DIR);
  console.log("\nDone!");
}

main();
