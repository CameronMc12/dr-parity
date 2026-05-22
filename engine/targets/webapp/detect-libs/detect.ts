/**
 * Scan a crawl directory's captured DOM snapshots for known UI library
 * signatures and bucket them by swap strategy.
 *
 * Phase 2's signatures.json is a cheap first-pass list of library names.
 * Detection here re-scans per state because we need evidence (selectors,
 * occurrence counts) and bucketing data Phase 2 doesn't surface.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { LIB_REGISTRY } from './registry';
import type {
  DetectedLib,
  LibDetectionResult,
  LibSignature,
  UnknownPattern,
} from './types';

const KNOWN_DATA_PREFIXES = [
  'data-rbd',
  'data-dnd-kit',
  'data-droppable',
  'data-headlessui',
  'data-radix',
  'data-floating-ui',
  'data-framer',
  'data-motion',
  'data-rmsc',
  'data-tippy',
  'data-uppy',
  'data-slot',
  'data-chart',
  'data-state',
  'data-orientation',
  'data-side',
  'data-align',
  // Generic React / framework attrs we should NOT flag.
  'data-testid',
  'data-react',
  'data-reactroot',
];

interface SignatureHit {
  occurrences: number;
  evidence: string[];
}

function listStateDomPaths(crawlDir: string): string[] {
  const statesDir = join(crawlDir, 'states');
  if (!existsSync(statesDir)) return [];
  const entries = readdirSync(statesDir, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dom = join(statesDir, entry.name, 'dom.html');
    if (existsSync(dom)) paths.push(dom);
  }
  return paths;
}

function loadCheapSignatures(crawlDir: string): Set<string> {
  const path = join(crawlDir, 'signatures.json');
  if (!existsSync(path)) return new Set();
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as { signatures?: string[] };
    return new Set(parsed.signatures ?? []);
  } catch {
    return new Set();
  }
}

function describeElement(el: any, $: any): string {
  const tag = (el.tagName as string) ?? 'div';
  const attrs = (el.attribs ?? {}) as Record<string, string>;
  const id = attrs.id ? `#${attrs.id}` : '';
  const cls =
    typeof attrs.class === 'string' && attrs.class.length > 0
      ? `.${attrs.class.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
  void $;
  return `${tag}${id}${cls}`;
}

function scanDocForSignature(
  $: any,
  signature: LibSignature,
  hit: SignatureHit,
): void {
  const seen = new Set(hit.evidence);

  for (const attr of signature.detection.domAttrs ?? []) {
    $(`[${attr}]`).each((_i: number, el: any) => {
      hit.occurrences += 1;
      if (hit.evidence.length < 3) {
        const ev = describeElement(el, $);
        if (!seen.has(ev)) {
          hit.evidence.push(ev);
          seen.add(ev);
        }
      }
    });
  }

  for (const prefix of signature.detection.classPrefixes ?? []) {
    $('[class]').each((_i: number, el: any) => {
      const cls = (el.attribs?.class as string | undefined) ?? '';
      const tokens = cls.split(/\s+/);
      const matched = tokens.some((t) => t.startsWith(prefix));
      if (matched) {
        hit.occurrences += 1;
        if (hit.evidence.length < 3) {
          const ev = describeElement(el, $);
          if (!seen.has(ev)) {
            hit.evidence.push(ev);
            seen.add(ev);
          }
        }
      }
    });
  }
}

function collectUnknownDataAttrs(
  $: any,
  detectedAttrs: Set<string>,
  unknown: Map<string, number>,
): void {
  $('*').each((_i: number, el: any) => {
    const attrs = (el.attribs ?? {}) as Record<string, string>;
    for (const name of Object.keys(attrs)) {
      if (!name.startsWith('data-')) continue;
      if (detectedAttrs.has(name)) continue;
      if (KNOWN_DATA_PREFIXES.some((p) => name.startsWith(p))) continue;
      // Tally counts; we only report attrs that show up in ≥ 3 places, to
      // skip ad-hoc author-defined data attrs.
      unknown.set(name, (unknown.get(name) ?? 0) + 1);
    }
  });
}

export async function detectLibs(
  crawlDir: string,
): Promise<LibDetectionResult> {
  const cheapHits = loadCheapSignatures(crawlDir);
  const domPaths = listStateDomPaths(crawlDir);

  const hits = new Map<string, SignatureHit>();
  for (const sig of LIB_REGISTRY) {
    hits.set(sig.id, { occurrences: 0, evidence: [] });
  }

  const detectedAttrs = new Set<string>();
  for (const sig of LIB_REGISTRY) {
    for (const a of sig.detection.domAttrs ?? []) detectedAttrs.add(a);
  }

  const unknownAttrCounts = new Map<string, number>();

  for (const path of domPaths) {
    let html: string;
    try {
      html = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    const $ = cheerio.load(html, null, false);
    for (const sig of LIB_REGISTRY) {
      const hit = hits.get(sig.id);
      if (!hit) continue;
      scanDocForSignature($, sig, hit);
    }
    collectUnknownDataAttrs($, detectedAttrs, unknownAttrCounts);
  }

  // If we never opened any DOM but Phase 2 left a cheap list, fall back
  // to that — at minimum we can flag the lib as present even without
  // evidence selectors.
  if (domPaths.length === 0 && cheapHits.size > 0) {
    for (const sig of LIB_REGISTRY) {
      if (cheapHits.has(sig.displayName) || cheapHits.has(sig.id)) {
        const hit = hits.get(sig.id);
        if (hit) hit.occurrences = 1;
      }
    }
  }

  const detected: DetectedLib[] = [];
  const manualOnly: DetectedLib[] = [];

  for (const sig of LIB_REGISTRY) {
    const hit = hits.get(sig.id);
    if (!hit) continue;
    const min = sig.detection.minOccurrences ?? 1;
    if (hit.occurrences < min) continue;
    const entry: DetectedLib = {
      signature: sig,
      occurrences: hit.occurrences,
      evidence: hit.evidence,
    };
    if (sig.swapStrategy === 'manual-only') manualOnly.push(entry);
    else detected.push(entry);
  }

  // Build a final cross-check set of EVERY attr a registered lib claims, so
  // we can drop spurious "unknown" reports that actually belong under an
  // existing library entry (e.g. data-state belongs to Radix, data-slot to
  // shadcn, data-motion-pop-id to framer-motion).
  const registeredAttrs = new Set<string>();
  for (const sig of LIB_REGISTRY) {
    for (const a of sig.detection.domAttrs ?? []) registeredAttrs.add(a);
  }

  const unknown: UnknownPattern[] = [];
  for (const [attr, count] of unknownAttrCounts.entries()) {
    if (count < 3) continue;
    if (registeredAttrs.has(attr)) continue;
    if (KNOWN_DATA_PREFIXES.some((p) => attr.startsWith(p))) continue;
    unknown.push({
      evidence: `[${attr}] (×${count})`,
      whyFlagged:
        'Recurring data attribute with no registered library signature. Likely a custom or unsupported third-party library.',
    });
  }
  unknown.sort((a, b) => a.evidence.localeCompare(b.evidence));

  return { detected, unknown, manualOnly };
}
