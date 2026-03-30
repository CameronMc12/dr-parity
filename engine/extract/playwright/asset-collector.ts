/**
 * Asset collector for Dr Parity's extraction engine.
 *
 * Discovers and downloads all images, videos, SVGs, favicons, and OG images
 * from a page. Inline SVGs are extracted and deduplicated for conversion into
 * React components by the generation pipeline.
 *
 * Design decisions:
 * - A single `page.evaluate()` call discovers every asset to minimise
 *   Node ↔ browser round-trips.
 * - Downloads run in parallel batches (default concurrency 4) using a
 *   simple promise-pool to stay polite to origin servers.
 * - SVGs are deduplicated by a lightweight content hash and auto-named
 *   by their DOM context (parent link, aria-label, nearby heading, etc.).
 * - File sizes are tracked so the caller can warn on bloated assets.
 */

import type { Page } from 'playwright';
import type { AssetManifest, AssetEntry, SvgEntry } from '../../types/extraction';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AssetCollectionResult {
  manifest: AssetManifest;
  totalDownloaded: number;
  totalSize: number;
  errors: string[];
}

export interface CollectionOptions {
  /** Project root directory. */
  outputDir: string;
  /** Max parallel downloads. Default 4. */
  concurrency?: number;
  /** Skip files larger than this (bytes). Default 50 MB. */
  maxFileSize?: number;
  /** Skip video downloads. Default false. */
  skipVideos?: boolean;
  /** Extract inline SVGs as React component candidates. Default true. */
  svgAsComponents?: boolean;
}

type ResolvedOptions = Required<CollectionOptions>;

const DEFAULT_OPTIONS: Omit<ResolvedOptions, 'outputDir'> = {
  concurrency: 4,
  maxFileSize: 50 * 1024 * 1024,
  skipVideos: false,
  svgAsComponents: true,
};

/**
 * Discover and download every visual asset from the page.
 */
export async function collectAssets(
  page: Page,
  options: CollectionOptions,
): Promise<AssetCollectionResult> {
  const opts: ResolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  let totalDownloaded = 0;
  let totalSize = 0;

  // Ensure output directories exist.
  const dirs = [
    join(opts.outputDir, 'public', 'images'),
    join(opts.outputDir, 'public', 'videos'),
    join(opts.outputDir, 'public', 'seo'),
  ];
  await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));

  // Step 1: Discover all assets in one evaluate.
  const discovered = await discoverAssets(page);

  // Step 2: Extract and deduplicate inline SVGs.
  const svgEntries = opts.svgAsComponents
    ? deduplicateSvgs(discovered.inlineSvgs)
    : [];

  // Step 3: Build download queue.
  const queue = buildDownloadQueue(discovered, opts);

  // Step 4: Download in parallel batches.
  const downloadResults = await downloadBatch(
    page,
    queue,
    opts.outputDir,
    opts.concurrency,
    opts.maxFileSize,
  );

  for (const result of downloadResults) {
    if (result.error) {
      errors.push(result.error);
    } else {
      totalDownloaded++;
      totalSize += result.size;
    }
  }

  // Step 5: Write SVG files.
  const svgDir = join(opts.outputDir, 'public', 'images');
  for (const svg of svgEntries) {
    try {
      const filename = `${sanitizeFilename(svg.componentName ?? svg.filename)}.svg`;
      const localPath = join(svgDir, filename);
      await writeFile(localPath, svg.content, 'utf-8');
      svg.localPath = `public/images/${filename}`;
      svg.filename = filename;
      totalDownloaded++;
      totalSize += Buffer.byteLength(svg.content, 'utf-8');
    } catch (err) {
      errors.push(`SVG write failed: ${svg.componentName ?? 'unknown'} — ${String(err)}`);
    }
  }

  // Step 6: Assemble manifest.
  const manifest = assembleManifest(downloadResults, svgEntries);

  if (totalSize > 100 * 1024 * 1024) {
    errors.push(
      `Total asset size exceeds 100 MB (${(totalSize / 1024 / 1024).toFixed(1)} MB). Consider optimising images.`,
    );
  }

  return { manifest, totalDownloaded, totalSize, errors };
}

// ---------------------------------------------------------------------------
// Asset discovery (single page.evaluate)
// ---------------------------------------------------------------------------

interface DiscoveredImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface DiscoveredVideo {
  src: string;
  poster: string;
  type: string;
}

interface DiscoveredBackground {
  url: string;
  element: string;
}

interface DiscoveredInlineSvg {
  outerHTML: string;
  viewBox: string;
  parentTag: string;
  parentHref: string;
  ariaLabel: string;
  nearbyText: string;
}

interface DiscoveredFavicon {
  href: string;
  rel: string;
  sizes: string;
}

interface DiscoveredAssets {
  images: DiscoveredImage[];
  videos: DiscoveredVideo[];
  backgrounds: DiscoveredBackground[];
  inlineSvgs: DiscoveredInlineSvg[];
  favicons: DiscoveredFavicon[];
  ogImage: string;
}

async function discoverAssets(page: Page): Promise<DiscoveredAssets> {
  return page.evaluate(() => {
    // --- Images ---
    const images = Array.from(document.querySelectorAll('img')).map((img) => ({
      src: img.src || img.currentSrc || '',
      alt: img.alt || '',
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0,
    }));

    // --- Videos ---
    const videos = Array.from(document.querySelectorAll('video')).map((v) => {
      const source = v.querySelector('source');
      return {
        src: v.src || source?.src || '',
        poster: v.poster || '',
        type: source?.type || '',
      };
    });

    // --- Background images ---
    const backgrounds: Array<{ url: string; element: string }> = [];
    const allElements = document.querySelectorAll('*');
    for (const el of Array.from(allElements)) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (urlMatch && !urlMatch[1].startsWith('data:')) {
          const cls = el.className;
          const clsStr = typeof cls === 'string' ? cls.split(' ')[0] || '' : '';
          backgrounds.push({
            url: urlMatch[1],
            element: `${el.tagName}.${clsStr}`,
          });
        }
      }
    }

    // --- Inline SVGs ---
    const inlineSvgs = Array.from(document.querySelectorAll('svg')).map((svg) => {
      const parent = svg.parentElement;
      return {
        outerHTML: svg.outerHTML,
        viewBox: svg.getAttribute('viewBox') || '',
        parentTag: parent?.tagName || '',
        parentHref: parent?.getAttribute('href') || parent?.closest('a')?.getAttribute('href') || '',
        ariaLabel: svg.getAttribute('aria-label') || svg.getAttribute('role') || '',
        nearbyText: parent?.textContent?.trim().slice(0, 40) || '',
      };
    });

    // --- Favicons ---
    const favicons = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel*="icon"], link[rel="apple-touch-icon"]',
      ),
    ).map((l) => ({
      href: l.href || '',
      rel: l.rel || '',
      sizes: l.sizes?.toString() || '',
    }));

    // --- OG Image ---
    const ogImage =
      document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || '';

    return { images, videos, backgrounds, inlineSvgs, favicons, ogImage };
  });
}

// ---------------------------------------------------------------------------
// SVG deduplication & naming
// ---------------------------------------------------------------------------

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cleanSvgMarkup(html: string): string {
  return html
    .replace(/\s+data-[\w-]+="[^"]*"/g, '') // Remove data-* attributes.
    .replace(/\s+class="[^"]*"/g, '')        // Remove class attributes.
    .replace(/\s+style="[^"]*"/g, '')        // Remove inline styles.
    .replace(/\s+id="[^"]*"/g, '')           // Remove ids.
    .replace(/<!--[\s\S]*?-->/g, '')         // Remove comments.
    .replace(/\s+/g, ' ')                    // Normalise whitespace.
    .trim();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function inferSvgName(svg: DiscoveredInlineSvg, index: number): string {
  // Priority 1: aria-label.
  if (svg.ariaLabel && svg.ariaLabel !== 'img' && svg.ariaLabel !== 'presentation') {
    return toPascalCase(svg.ariaLabel) + 'Icon';
  }

  // Priority 2: Parent link context.
  if (svg.parentHref === '/' || svg.parentHref === '#') {
    return 'LogoIcon';
  }
  if (svg.parentHref) {
    const segment = svg.parentHref
      .replace(/^https?:\/\/[^/]+/, '')
      .replace(/^\//, '')
      .split('/')[0];
    if (segment) {
      return toPascalCase(segment) + 'Icon';
    }
  }

  // Priority 3: Nearby text.
  if (svg.nearbyText && svg.nearbyText.length < 30) {
    return toPascalCase(svg.nearbyText) + 'Icon';
  }

  // Priority 4: Parent tag context.
  if (svg.parentTag === 'BUTTON') {
    return `ButtonIcon${index}`;
  }
  if (svg.parentTag === 'NAV' || svg.parentTag === 'HEADER') {
    return `NavIcon${index}`;
  }

  return `Icon${index}`;
}

function deduplicateSvgs(svgs: DiscoveredInlineSvg[]): SvgEntry[] {
  const seen = new Map<string, SvgEntry>();
  const nameCount = new Map<string, number>();

  for (let i = 0; i < svgs.length; i++) {
    const svg = svgs[i];
    const cleaned = cleanSvgMarkup(svg.outerHTML);
    const hash = simpleHash(cleaned);

    if (seen.has(hash)) continue;

    let name = inferSvgName(svg, i);

    // Deduplicate names.
    const count = nameCount.get(name) ?? 0;
    if (count > 0) {
      name = `${name}${count}`;
    }
    nameCount.set(name, count + 1);

    const entry: SvgEntry = {
      originalUrl: '',
      localPath: '',
      filename: `${sanitizeFilename(name)}.svg`,
      content: cleaned,
      viewBox: svg.viewBox || undefined,
      componentName: name,
    };

    seen.set(hash, entry);
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Download queue builder
// ---------------------------------------------------------------------------

type AssetCategory = 'images' | 'videos' | 'favicons' | 'ogImages';

interface QueueItem {
  url: string;
  category: AssetCategory;
  alt?: string;
  width?: number;
  height?: number;
  sizes?: string;
  rel?: string;
}

function buildDownloadQueue(
  discovered: DiscoveredAssets,
  opts: ResolvedOptions,
): QueueItem[] {
  const queue: QueueItem[] = [];
  const seenUrls = new Set<string>();

  function enqueue(item: QueueItem): void {
    if (!item.url || item.url.startsWith('data:') || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    queue.push(item);
  }

  // Images.
  for (const img of discovered.images) {
    enqueue({
      url: img.src,
      category: 'images',
      alt: img.alt,
      width: img.width,
      height: img.height,
    });
  }

  // Background images.
  for (const bg of discovered.backgrounds) {
    enqueue({ url: bg.url, category: 'images' });
  }

  // Videos.
  if (!opts.skipVideos) {
    for (const vid of discovered.videos) {
      if (vid.src) {
        enqueue({ url: vid.src, category: 'videos' });
      }
      if (vid.poster) {
        enqueue({ url: vid.poster, category: 'images' });
      }
    }
  }

  // Favicons.
  for (const fav of discovered.favicons) {
    enqueue({
      url: fav.href,
      category: 'favicons',
      rel: fav.rel,
      sizes: fav.sizes,
    });
  }

  // OG image.
  if (discovered.ogImage) {
    enqueue({ url: discovered.ogImage, category: 'ogImages' });
  }

  return queue;
}

// ---------------------------------------------------------------------------
// Parallel batch downloader
// ---------------------------------------------------------------------------

interface DownloadResult {
  item: QueueItem;
  localPath: string;
  filename: string;
  size: number;
  mimeType: string;
  error?: string;
}

function categoryDir(category: AssetCategory): string {
  switch (category) {
    case 'images':
      return 'public/images';
    case 'videos':
      return 'public/videos';
    case 'favicons':
    case 'ogImages':
      return 'public/seo';
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
}

function generateFilename(url: string, category: AssetCategory, index: number): string {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    const ext = extname(lastSegment);

    if (ext && lastSegment.length < 80) {
      return sanitizeFilename(lastSegment);
    }

    // No extension — guess from category.
    const defaultExt =
      category === 'videos' ? '.mp4' : category === 'favicons' ? '.png' : '.png';
    const baseName = lastSegment || `${category}-${index}`;
    return sanitizeFilename(baseName) + defaultExt;
  } catch {
    return `${category}-${index}.bin`;
  }
}

async function downloadBatch(
  page: Page,
  queue: QueueItem[],
  outputDir: string,
  concurrency: number,
  maxFileSize: number,
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  const filenameCount = new Map<string, number>();
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < queue.length) {
      const index = cursor++;
      const item = queue[index];
      const result = await downloadOne(page, item, outputDir, index, maxFileSize, filenameCount);
      results.push(result);
    }
  }

  // Launch `concurrency` workers.
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(next());
  }
  await Promise.all(workers);

  return results;
}

async function downloadOne(
  page: Page,
  item: QueueItem,
  outputDir: string,
  index: number,
  maxFileSize: number,
  filenameCount: Map<string, number>,
): Promise<DownloadResult> {
  const dir = categoryDir(item.category);
  let filename = generateFilename(item.url, item.category, index);

  // Deduplicate filenames.
  const count = filenameCount.get(filename) ?? 0;
  if (count > 0) {
    const ext = extname(filename);
    const base = filename.slice(0, -ext.length || undefined);
    filename = `${base}-${count}${ext}`;
  }
  filenameCount.set(filename, count + 1);

  const localPath = join(dir, filename);
  const absolutePath = join(outputDir, localPath);

  try {
    const response = await page.context().request.get(item.url);
    if (!response.ok()) {
      return {
        item,
        localPath,
        filename,
        size: 0,
        mimeType: '',
        error: `HTTP ${response.status()} for ${item.url}`,
      };
    }

    const buffer = await response.body();

    if (buffer.byteLength > maxFileSize) {
      return {
        item,
        localPath,
        filename,
        size: buffer.byteLength,
        mimeType: '',
        error: `Skipped ${item.url}: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB exceeds limit`,
      };
    }

    await writeFile(absolutePath, buffer);

    const contentType = response.headers()['content-type'] ?? '';

    return {
      item,
      localPath,
      filename,
      size: buffer.byteLength,
      mimeType: contentType.split(';')[0].trim(),
    };
  } catch (err) {
    return {
      item,
      localPath,
      filename,
      size: 0,
      mimeType: '',
      error: `Download failed: ${item.url} — ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Manifest assembly
// ---------------------------------------------------------------------------

function toAssetEntry(result: DownloadResult): AssetEntry {
  return {
    originalUrl: result.item.url,
    localPath: result.localPath,
    filename: result.filename,
    mimeType: result.mimeType || undefined,
    size: result.size || undefined,
    dimensions:
      result.item.width && result.item.height
        ? { width: result.item.width, height: result.item.height }
        : undefined,
  };
}

function assembleManifest(
  downloadResults: DownloadResult[],
  svgEntries: SvgEntry[],
): AssetManifest {
  const manifest: AssetManifest = {
    images: [],
    videos: [],
    svgs: svgEntries,
    fonts: [], // Populated by font-extractor.
    favicons: [],
    ogImages: [],
    other: [],
  };

  for (const result of downloadResults) {
    if (result.error) continue;

    const entry = toAssetEntry(result);

    switch (result.item.category) {
      case 'images':
        manifest.images.push(entry);
        break;
      case 'videos':
        manifest.videos.push(entry);
        break;
      case 'favicons':
        manifest.favicons.push(entry);
        break;
      case 'ogImages':
        manifest.ogImages.push(entry);
        break;
    }
  }

  return manifest;
}
