/**
 * One-time backfill: emit seo.config.ts + tracking.config.ts + SEO.astro
 * into existing clones that pre-date the Fix #5 generator. Idempotent —
 * existing files are not overwritten.
 */
import { writeSeoConfigs } from '../engine/targets/astro/scaffold';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY';
const CLONES = ['apple', 'yodezeen', 'fluid-glass', 'enerblock-net-en'];

function seedFromHomepage(outDir: string): { title: string; description: string } {
  const idx = join(outDir, 'src', 'pages', 'index.astro');
  if (!existsSync(idx)) return { title: '', description: '' };
  const src = readFileSync(idx, 'utf8');
  const t = src.match(/const\s+title\s*=\s*'([^']*)'/);
  const d = src.match(/const\s+description\s*=\s*'([^']*)'/);
  return {
    title: (t?.[1] ?? '').replace(/\\'/g, "'"),
    description: (d?.[1] ?? '').replace(/\\'/g, "'"),
  };
}

for (const slug of CLONES) {
  const dir = join(ROOT, slug);
  const seed = seedFromHomepage(dir);
  const r = writeSeoConfigs(dir, seed);
  process.stdout.write(
    `${slug}: seoConfig=${r.seoConfigWritten} tracking=${r.trackingConfigWritten} SEO.astro=${r.seoComponentWritten} (title="${seed.title.slice(0, 60)}")\n`,
  );
}
