/**
 * Core page scanner for Dr Parity's extraction engine.
 *
 * Walks the entire DOM of a Playwright Page, captures all computed styles for
 * every visible element, and returns structured extraction data ready for the
 * generation pipeline.
 *
 * Design decisions:
 * - All DOM walking runs inside a single `page.evaluate()` call per batch to
 *   avoid thousands of round-trips between Node and the browser.
 * - A hidden reference element of each tag type is created once to diff
 *   computed styles against browser defaults (filters ~300 props down to ~20-40).
 * - Sections are detected via semantic elements first, then ARIA roles, then
 *   structural heuristics.
 */

import type { Page } from 'playwright';
import type {
  ElementSpec,
  MediaSpec,
  Rect,
  SectionSpec,
} from '../../types/extraction';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Maximum depth of the element tree walk. Default 6. */
  maxDepth?: number;
  /** Maximum total elements to capture. Default 5000. */
  maxElements?: number;
  /** Elements per evaluate() batch. Default 200. */
  batchSize?: number;
  /** Include hidden (display:none / zero-dimension) elements. Default false. */
  includeHidden?: boolean;
}

export interface BatchScanOptions extends ScanOptions {
  /** Enable batch mode for pages with 50+ sections. Auto-detected if omitted. */
  batchMode?: boolean;
  /** Scan above-fold sections first. Default true. */
  prioritizeAboveFold?: boolean;
  /** Number of sections to process per batch. Default 20. */
  sectionBatchSize?: number;
}

export interface PageScanResult {
  title: string;
  description: string;
  bodyStyles: Record<string, string>;
  sections: SectionSpec[];
  totalElements: number;
  scanDuration: number;
}

const DEFAULT_OPTIONS: Required<ScanOptions> = {
  maxDepth: 6,
  maxElements: 5000,
  batchSize: 200,
  includeHidden: false,
};

/**
 * Scan a page and return structured extraction data for every visible element.
 */
export async function scanPage(
  page: Page,
  options?: ScanOptions,
): Promise<PageScanResult> {
  const opts: Required<ScanOptions> = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Step 1: Grab page metadata + body styles in one evaluate.
  const meta = await page.evaluate(() => {
    const metaDesc =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content ?? '';
    return {
      title: document.title,
      description: metaDesc,
    };
  });

  // Step 2: Discover section root elements and capture body styles.
  const { sectionHandles, bodyStyles } = await discoverSections(page);

  // Step 3: For each section, walk the DOM tree in batched evaluate calls.
  const sections: SectionSpec[] = [];
  let totalElements = 0;

  for (let i = 0; i < sectionHandles.length; i++) {
    const handle = sectionHandles[i];
    if (totalElements >= opts.maxElements) {
      break;
    }

    const remaining = opts.maxElements - totalElements;
    const sectionData = await extractSection(page, handle, i, opts, remaining);

    if (sectionData !== null) {
      totalElements += countElements(sectionData.elements);
      sections.push(sectionData);
    }

    await handle.dispose();
  }

  // Dispose any handles we skipped.
  for (let i = sections.length; i < sectionHandles.length; i++) {
    await sectionHandles[i].dispose();
  }

  const scanDuration = Date.now() - startTime;

  return {
    title: meta.title,
    description: meta.description,
    bodyStyles,
    sections,
    totalElements,
    scanDuration,
  };
}

/**
 * Scan a large page using batched section processing.
 *
 * Performs a quick section count first. If the page has fewer than 50 sections,
 * delegates to `scanPage`. Otherwise, processes sections in configurable batches
 * with optional above-fold prioritization.
 */
export async function scanPageBatched(
  page: Page,
  options?: BatchScanOptions,
): Promise<PageScanResult> {
  const sectionBatchSize = options?.sectionBatchSize ?? 20;
  const prioritizeAboveFold = options?.prioritizeAboveFold !== false;

  // Quick pass: count sections without extracting element trees
  const quickCount = await page.evaluate(() => {
    const sectionSelectors = 'section, [role="region"], main > div, main > section';
    const sections = document.querySelectorAll(sectionSelectors);
    const totalElements = document.querySelectorAll('*').length;
    return { sections: sections.length, elements: totalElements };
  });

  // If batch mode is not explicitly requested, auto-detect
  const shouldBatch = options?.batchMode ?? quickCount.sections > 50;

  if (!shouldBatch) {
    return scanPage(page, options);
  }

  console.log(
    `  Large page detected (${quickCount.sections} sections, ${quickCount.elements} elements). Using batch mode.`,
  );

  const opts: Required<ScanOptions> = {
    maxDepth: options?.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
    maxElements: options?.maxElements ?? DEFAULT_OPTIONS.maxElements,
    batchSize: options?.batchSize ?? DEFAULT_OPTIONS.batchSize,
    includeHidden: options?.includeHidden ?? DEFAULT_OPTIONS.includeHidden,
  };
  const startTime = Date.now();

  // Grab page metadata
  const meta = await page.evaluate(() => {
    const metaDesc =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content ?? '';
    return {
      title: document.title,
      description: metaDesc,
    };
  });

  // Get section positions for ordering
  const sectionPositions = await page.evaluate(() => {
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR']);

    function isSkippable(el: Element): boolean {
      return SKIP_TAGS.has(el.tagName);
    }

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    let candidates: Element[] = [];
    const sections = Array.from(document.querySelectorAll('section'));
    if (sections.length > 0) {
      candidates = sections;
    }
    if (candidates.length === 0) {
      const main = document.querySelector('main');
      if (main) {
        candidates = Array.from(main.children).filter((c) => !isSkippable(c));
      }
    }
    if (candidates.length === 0) {
      const landmarks = document.querySelectorAll(
        '[role="region"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="main"]',
      );
      candidates = Array.from(landmarks);
    }
    if (candidates.length === 0) {
      candidates = Array.from(document.body.children).filter((c) => !isSkippable(c));
    }

    const visible = candidates.filter(isVisible);
    return visible.map((el, idx) => ({
      index: idx,
      top: Math.round((el as HTMLElement).getBoundingClientRect().top + window.scrollY),
      height: Math.round((el as HTMLElement).getBoundingClientRect().height),
    }));
  });

  // Optionally sort above-fold sections first
  const sortedPositions = prioritizeAboveFold
    ? [...sectionPositions].sort((a, b) => a.top - b.top)
    : sectionPositions;

  // Discover sections and body styles (full handle-based discovery)
  const { sectionHandles, bodyStyles } = await discoverSections(page);

  // Build an order mapping from sorted positions to handle indices
  const handleOrder = sortedPositions.map((sp) => sp.index);

  const sections: SectionSpec[] = [];
  let totalElements = 0;

  // Process sections in batches
  for (let batchStart = 0; batchStart < handleOrder.length; batchStart += sectionBatchSize) {
    const batchIndices = handleOrder.slice(batchStart, batchStart + sectionBatchSize);

    if (totalElements >= opts.maxElements) break;

    console.log(
      `    Batch ${Math.floor(batchStart / sectionBatchSize) + 1}: sections ${batchStart + 1}-${Math.min(batchStart + sectionBatchSize, handleOrder.length)} of ${handleOrder.length}`,
    );

    for (const handleIdx of batchIndices) {
      if (totalElements >= opts.maxElements) break;
      if (handleIdx >= sectionHandles.length) continue;

      const handle = sectionHandles[handleIdx];
      const remaining = opts.maxElements - totalElements;
      const sectionData = await extractSection(page, handle, handleIdx, opts, remaining);

      if (sectionData !== null) {
        totalElements += countElements(sectionData.elements);
        sections.push(sectionData);
      }
    }
  }

  // Dispose all handles
  for (const handle of sectionHandles) {
    await handle.dispose();
  }

  // Re-sort sections by their original order for output consistency
  sections.sort((a, b) => a.order - b.order);

  const scanDuration = Date.now() - startTime;

  return {
    title: meta.title,
    description: meta.description,
    bodyStyles,
    sections,
    totalElements,
    scanDuration,
  };
}

// ---------------------------------------------------------------------------
// Section discovery
// ---------------------------------------------------------------------------

interface SectionDiscovery {
  sectionHandles: Awaited<ReturnType<Page['evaluateHandle']>>[];
  bodyStyles: Record<string, string>;
}

async function discoverSections(page: Page): Promise<SectionDiscovery> {
  // Returns an array of ElementHandles for each detected section root, plus
  // the non-default body styles.
  const result = await page.evaluateHandle(() => {
    const SKIP_TAGS = new Set([
      'SCRIPT',
      'STYLE',
      'LINK',
      'META',
      'NOSCRIPT',
      'BR',
      'HR',
    ]);

    function isSkippable(el: Element): boolean {
      return SKIP_TAGS.has(el.tagName);
    }

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    // Try semantic section discovery in priority order.
    let candidates: Element[] = [];

    // 1. Explicit <section> elements.
    const sections = Array.from(document.querySelectorAll('section'));
    if (sections.length > 0) {
      candidates = sections;
    }

    // 2. Direct children of <main>.
    if (candidates.length === 0) {
      const main = document.querySelector('main');
      if (main) {
        candidates = Array.from(main.children).filter(
          (c) => !isSkippable(c),
        );
      }
    }

    // 3. ARIA landmark roles.
    if (candidates.length === 0) {
      const landmarks = document.querySelectorAll(
        '[role="region"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="main"]',
      );
      candidates = Array.from(landmarks);
    }

    // 4. Fallback: direct children of body.
    if (candidates.length === 0) {
      candidates = Array.from(document.body.children).filter(
        (c) => !isSkippable(c),
      );
    }

    // Filter to visible elements only.
    const visibleCandidates = candidates.filter(isVisible);

    return visibleCandidates.length > 0 ? visibleCandidates : [document.body];
  });

  // Split the JSHandle array into individual ElementHandles.
  const length = await (result as unknown as { getProperty: (key: string) => Promise<{ jsonValue: () => Promise<number> }> })
    .getProperty('length')
    .then((h) => h.jsonValue());

  const handles: Awaited<ReturnType<Page['evaluateHandle']>>[] = [];
  for (let i = 0; i < length; i++) {
    const handle = await page.evaluateHandle(
      ({ arr, idx }) => (arr as unknown as Element[])[idx],
      { arr: result, idx: i },
    );
    handles.push(handle);
  }
  await result.dispose();

  // Extract non-default body styles.
  const bodyStyles = await page.evaluate(() => {
    const body = document.body;
    const computed = window.getComputedStyle(body);
    const ref = document.createElement('body');
    ref.style.display = 'none';
    document.documentElement.appendChild(ref);
    const defaults = window.getComputedStyle(ref);

    const diff: Record<string, string> = {};
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      const val = computed.getPropertyValue(prop);
      const def = defaults.getPropertyValue(prop);
      if (val !== def) {
        diff[prop] = val;
      }
    }

    ref.remove();
    return diff;
  });

  return { sectionHandles: handles, bodyStyles };
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

async function extractSection(
  page: Page,
  handle: Awaited<ReturnType<Page['evaluateHandle']>>,
  order: number,
  opts: Required<ScanOptions>,
  maxElements: number,
): Promise<SectionSpec | null> {
  // Run the heavy DOM-walking logic entirely inside the browser.
  // Playwright evaluate() accepts only a single arg, so we pack both
  // the element handle and config into one object.
  const raw = await page.evaluate(
    ({ el, config }: {
      el: Element;
      config: { maxDepth: number; maxElements: number; includeHidden: boolean };
    }) => {
      // ---- Begin in-browser code ----
      let elementCount = 0;
      const MAX_TEXT_LENGTH = 500;

      // Cache of default styles per tag name.
      const defaultStyleCache = new Map<string, Record<string, string>>();

      function getDefaultStyles(tagName: string): Record<string, string> {
        const cached = defaultStyleCache.get(tagName);
        if (cached) return cached;

        const ref = document.createElement(tagName);
        ref.style.display = 'none';
        ref.style.position = 'absolute';
        ref.style.visibility = 'hidden';
        document.body.appendChild(ref);
        const computed = window.getComputedStyle(ref);

        const styles: Record<string, string> = {};
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          styles[prop] = computed.getPropertyValue(prop);
        }

        ref.remove();
        defaultStyleCache.set(tagName, styles);
        return styles;
      }

      function isVisible(element: Element): boolean {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getRect(element: Element): {
        top: number;
        left: number;
        width: number;
        height: number;
      } {
        const r = element.getBoundingClientRect();
        return {
          top: r.top + window.scrollY,
          left: r.left + window.scrollX,
          width: r.width,
          height: r.height,
        };
      }

      function getNonDefaultStyles(
        element: Element,
      ): Record<string, string> {
        const computed = window.getComputedStyle(element);
        const defaults = getDefaultStyles(element.tagName);
        const diff: Record<string, string> = {};

        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          const val = computed.getPropertyValue(prop);
          if (val !== defaults[prop]) {
            diff[prop] = val;
          }
        }

        // Capture container query properties (may not be in the enumerated list
        // on older engines, so check explicitly).
        const containerType = computed.getPropertyValue('container-type');
        if (containerType && containerType !== 'normal' && !diff['container-type']) {
          diff['container-type'] = containerType;
        }
        const containerName = computed.getPropertyValue('container-name');
        if (containerName && containerName !== 'none' && !diff['container-name']) {
          diff['container-name'] = containerName;
        }

        return diff;
      }

      function getAttributes(
        element: Element,
      ): Record<string, string> {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          attrs[attr.name] = attr.value;
        }
        return attrs;
      }

      function getTextContent(element: Element): string | undefined {
        // Only capture text from leaf-ish nodes (no child elements with text).
        const childElements = element.children;
        if (childElements.length === 0) {
          const text = element.textContent?.trim();
          if (text && text.length > 0) {
            return text.length > MAX_TEXT_LENGTH
              ? text.slice(0, MAX_TEXT_LENGTH)
              : text;
          }
        }
        return undefined;
      }

      function getMediaSpec(element: Element): MediaSpecRaw | undefined {
        const tag = element.tagName.toLowerCase();

        if (tag === 'img') {
          const img = element as HTMLImageElement;
          const cs = window.getComputedStyle(img);

          // Check for parent <picture> element sources.
          let pictureSources: Array<{ srcset: string; media?: string; type?: string }> | undefined;
          if (img.parentElement?.tagName.toLowerCase() === 'picture') {
            const sources = Array.from(img.parentElement.querySelectorAll('source'));
            if (sources.length > 0) {
              pictureSources = sources.map((s) => ({
                srcset: s.srcset || '',
                media: s.getAttribute('media') || undefined,
                type: s.type || undefined,
              }));
            }
          }

          return {
            type: 'image' as const,
            src: img.src || img.currentSrc || img.getAttribute('data-src') || undefined,
            alt: img.alt || undefined,
            srcset: img.srcset || undefined,
            sizes: img.sizes || undefined,
            dataSrc: img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || undefined,
            dataLazy: img.getAttribute('data-lazy') || undefined,
            loading: (img.loading as 'lazy' | 'eager') || undefined,
            decoding: (img.decoding as 'async' | 'sync' | 'auto') || undefined,
            fetchPriority: (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority || undefined,
            pictureSources,
            naturalWidth: img.naturalWidth || undefined,
            naturalHeight: img.naturalHeight || undefined,
            objectFit: cs.objectFit || undefined,
            objectPosition: cs.objectPosition || undefined,
          };
        }

        if (tag === 'video') {
          const video = element as HTMLVideoElement;
          const source = video.querySelector('source');
          return {
            type: 'video' as const,
            src: video.src || source?.src || undefined,
            poster: video.poster || undefined,
            autoplay: video.autoplay || undefined,
            loop: video.loop || undefined,
            muted: video.muted || undefined,
          };
        }

        if (tag === 'svg') {
          return {
            type: 'svg' as const,
            outerHTML: element.outerHTML,
          };
        }

        if (tag === 'canvas') {
          return { type: 'canvas' as const };
        }

        if (tag === 'iframe') {
          return {
            type: 'iframe' as const,
            src: (element as HTMLIFrameElement).src || undefined,
          };
        }

        // Check for background-image on any element.
        const bgImage = window.getComputedStyle(element).backgroundImage;
        if (bgImage && bgImage !== 'none') {
          const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
          if (urlMatch) {
            return {
              type: 'image' as const,
              src: urlMatch[1],
            };
          }
        }

        return undefined;
      }

      // MediaSpec without the strict type union — we serialize loosely.
      interface MediaSpecRaw {
        type: string;
        src?: string;
        alt?: string;
        srcset?: string;
        sizes?: string;
        dataSrc?: string;
        dataLazy?: string;
        loading?: string;
        decoding?: string;
        fetchPriority?: string;
        pictureSources?: Array<{ srcset: string; media?: string; type?: string }>;
        poster?: string;
        autoplay?: boolean;
        loop?: boolean;
        muted?: boolean;
        naturalWidth?: number;
        naturalHeight?: number;
        objectFit?: string;
        objectPosition?: string;
        outerHTML?: string;
      }

      interface PseudoStylesRaw {
        before?: Record<string, string>;
        after?: Record<string, string>;
        placeholder?: Record<string, string>;
        marker?: Record<string, string>;
      }

      interface ElementRaw {
        tag: string;
        id?: string;
        classes: string[];
        computedStyles: Record<string, string>;
        textContent?: string;
        innerHTML?: string;
        attributes: Record<string, string>;
        children: ElementRaw[];
        boundingRect: {
          top: number;
          left: number;
          width: number;
          height: number;
        };
        isVisible: boolean;
        media?: MediaSpecRaw;
        pseudoStyles?: PseudoStylesRaw;
      }

      function walkElement(
        element: Element,
        depth: number,
      ): ElementRaw | null {
        if (elementCount >= config.maxElements) return null;
        if (depth > config.maxDepth) return null;

        const tag = element.tagName.toLowerCase();

        // Skip non-content tags.
        const SKIP = new Set([
          'script',
          'style',
          'link',
          'meta',
          'noscript',
          'br',
        ]);
        if (SKIP.has(tag)) return null;

        const visible = isVisible(element);
        if (!visible && !config.includeHidden) return null;

        elementCount++;

        const media = getMediaSpec(element);

        // --- Pseudo-element extraction ---
        const PSEUDO_PROPS = [
          'content', 'display', 'position', 'top', 'right', 'bottom', 'left',
          'width', 'height', 'backgroundColor', 'background', 'backgroundImage',
          'color', 'fontSize', 'fontWeight', 'opacity', 'transform',
          'borderRadius', 'border', 'boxShadow', 'zIndex', 'overflow',
          'padding', 'margin',
        ];

        function extractPseudoStyles(
          target: Element,
          pseudo: '::before' | '::after' | '::placeholder' | '::marker',
        ): Record<string, string> | undefined {
          const pseudoComputed = window.getComputedStyle(target, pseudo);
          const pseudoContent = pseudoComputed.content;
          // For ::placeholder and ::marker the content check is irrelevant
          const needsContentCheck = pseudo === '::before' || pseudo === '::after';
          if (
            needsContentCheck &&
            (!pseudoContent ||
              pseudoContent === 'none' ||
              pseudoContent === '""' ||
              pseudoContent === "''")
          ) {
            return undefined;
          }
          const styles: Record<string, string> = {};
          for (const prop of PSEUDO_PROPS) {
            const val = pseudoComputed.getPropertyValue(
              prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
            ) || (pseudoComputed as unknown as Record<string, string>)[prop];
            if (
              val &&
              val !== 'none' &&
              val !== 'normal' &&
              val !== 'auto' &&
              val !== '0px'
            ) {
              styles[prop] = val;
            }
          }
          return Object.keys(styles).length > 0 ? styles : undefined;
        }

        const beforeStyles = extractPseudoStyles(element, '::before');
        const afterStyles = extractPseudoStyles(element, '::after');
        let pseudoStyles: PseudoStylesRaw | undefined;
        if (beforeStyles || afterStyles) {
          pseudoStyles = {};
          if (beforeStyles) pseudoStyles.before = beforeStyles;
          if (afterStyles) pseudoStyles.after = afterStyles;
        }

        const result: ElementRaw = {
          tag,
          id: element.id || undefined,
          classes: element.className
            ? (typeof element.className === 'string'
                ? element.className.split(/\s+/).filter(Boolean)
                : [])
            : [],
          computedStyles: getNonDefaultStyles(element),
          textContent: getTextContent(element),
          attributes: getAttributes(element),
          children: [],
          boundingRect: getRect(element),
          isVisible: visible,
          media,
          pseudoStyles,
        };

        // For SVGs, store the full markup as innerHTML.
        if (tag === 'svg') {
          result.innerHTML = element.outerHTML;
        }

        // Recurse into children.
        for (let i = 0; i < element.children.length; i++) {
          if (elementCount >= config.maxElements) break;
          const child = walkElement(element.children[i], depth + 1);
          if (child !== null) {
            result.children.push(child);
          }
        }

        return result;
      }

      // ---- Section-level data ----
      const visible = isVisible(el);
      if (!visible && !config.includeHidden) return null;

      const rect = getRect(el);
      const sectionStyles = window.getComputedStyle(el);
      const bgColor = sectionStyles.backgroundColor;
      const zIndex = parseInt(sectionStyles.zIndex, 10) || 0;
      const position = sectionStyles.position;

      // Walk all children.
      const children: ElementRaw[] = [];
      for (let i = 0; i < el.children.length; i++) {
        if (elementCount >= config.maxElements) break;
        const child = walkElement(el.children[i], 1);
        if (child !== null) {
          children.push(child);
        }
      }

      // Generate a section name from content heuristics.
      const tagLower = el.tagName.toLowerCase();
      const id = el.id || '';
      const cls = el.className || '';
      const role = el.getAttribute('role') || '';

      let name = '';
      if (id) {
        name = id;
      } else if (tagLower === 'header' || tagLower === 'nav' || role === 'banner' || role === 'navigation') {
        name = 'header';
      } else if (tagLower === 'footer' || role === 'contentinfo') {
        name = 'footer';
      } else {
        // Guess from class names or first heading.
        const heading = el.querySelector('h1, h2, h3');
        if (heading) {
          const headingText = heading.textContent?.trim().toLowerCase() ?? '';
          if (headingText.length > 0 && headingText.length < 40) {
            name = headingText
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .slice(0, 30);
          }
        }

        if (!name && typeof cls === 'string') {
          const classHint = cls
            .split(/\s+/)
            .find(
              (c: string) =>
                /hero|feature|about|pricing|testimonial|cta|contact|faq|banner|showcase/i.test(
                  c,
                ),
            );
          if (classHint) {
            name = classHint.toLowerCase();
          }
        }

        if (!name) {
          name = `section`;
        }
      }

      // Map position to our union type.
      const positionMap: Record<string, string> = {
        static: 'flow',
        relative: 'flow',
        sticky: 'sticky',
        fixed: 'fixed',
        absolute: 'absolute',
      };

      // Capture outerHTML, capped at 50KB to avoid massive payloads.
      const MAX_OUTER_HTML = 50_000;
      let outerHTML: string | undefined;
      try {
        const raw = el.outerHTML;
        outerHTML = raw.length > MAX_OUTER_HTML ? raw.slice(0, MAX_OUTER_HTML) : raw;
      } catch {
        // outerHTML may fail on certain pseudo-elements
      }

      return {
        name,
        rect,
        bgColor,
        zIndex,
        position: positionMap[position] || 'flow',
        className: typeof cls === 'string' ? cls : '',
        elements: children,
        elementCount,
        outerHTML,
      };
      // ---- End in-browser code ----
    },
    {
      el: handle,
      config: {
        maxDepth: opts.maxDepth,
        maxElements: Math.min(opts.maxElements, maxElements),
        includeHidden: opts.includeHidden,
      },
    },
  );

  if (raw === null) return null;

  const rawTyped = raw as {
    name: string;
    rect: Rect;
    bgColor: string;
    zIndex: number;
    position: string;
    className: string;
    elements: SerializedElement[];
    elementCount: number;
    outerHTML?: string;
  };

  // Convert the raw serialized data into proper typed objects.
  const sectionId = `section-${order}-${rawTyped.name}`;

  return {
    id: sectionId,
    name: rawTyped.name,
    order,
    boundingRect: rawTyped.rect,
    screenshots: { desktop: '' }, // Populated by a later pipeline step.
    elements: rawTyped.elements.map(deserializeElement),
    animations: [], // Populated by animation extractor.
    interactionModel: 'static',
    responsiveBreakpoints: [], // Populated by responsive scanner.
    zIndex: rawTyped.zIndex,
    position: rawTyped.position as SectionSpec['position'],
    backgroundColor: rawTyped.bgColor,
    className: rawTyped.className,
    outerHTML: rawTyped.outerHTML,
  };
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Shape of element data as it comes back from page.evaluate(). */
interface SerializedElement {
  tag: string;
  id?: string;
  classes: string[];
  computedStyles: Record<string, string>;
  textContent?: string;
  innerHTML?: string;
  attributes: Record<string, string>;
  children: SerializedElement[];
  boundingRect: Rect;
  isVisible: boolean;
  media?: SerializedMedia;
  pseudoStyles?: {
    before?: Record<string, string>;
    after?: Record<string, string>;
    placeholder?: Record<string, string>;
    marker?: Record<string, string>;
  };
}

interface SerializedMedia {
  type: string;
  src?: string;
  alt?: string;
  srcset?: string;
  sizes?: string;
  dataSrc?: string;
  dataLazy?: string;
  loading?: string;
  decoding?: string;
  fetchPriority?: string;
  pictureSources?: Array<{ srcset: string; media?: string; type?: string }>;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit?: string;
  objectPosition?: string;
  outerHTML?: string;
}

function deserializeElement(raw: SerializedElement): ElementSpec {
  return {
    tag: raw.tag,
    id: raw.id,
    classes: raw.classes,
    computedStyles: raw.computedStyles,
    textContent: raw.textContent,
    innerHTML: raw.innerHTML,
    attributes: raw.attributes,
    children: raw.children.map(deserializeElement),
    states: [], // Populated by state extractor later.
    animations: [], // Populated by animation extractor later.
    boundingRect: raw.boundingRect,
    isVisible: raw.isVisible,
    media: raw.media ? deserializeMedia(raw.media) : undefined,
    pseudoStyles: raw.pseudoStyles,
  };
}

function deserializeMedia(raw: SerializedMedia): MediaSpec {
  const base: MediaSpec = {
    type: raw.type as MediaSpec['type'],
  };

  if (raw.src !== undefined) base.src = raw.src;
  if (raw.alt !== undefined) base.alt = raw.alt;
  if (raw.srcset !== undefined) base.srcset = raw.srcset;
  if (raw.sizes !== undefined) base.sizes = raw.sizes;
  if (raw.dataSrc !== undefined) base.dataSrc = raw.dataSrc;
  if (raw.dataLazy !== undefined) base.dataLazy = raw.dataLazy;
  if (raw.loading !== undefined) base.loading = raw.loading as MediaSpec['loading'];
  if (raw.decoding !== undefined) base.decoding = raw.decoding as MediaSpec['decoding'];
  if (raw.fetchPriority !== undefined) base.fetchPriority = raw.fetchPriority as MediaSpec['fetchPriority'];
  if (raw.pictureSources !== undefined) base.pictureSources = raw.pictureSources;
  if (raw.poster !== undefined) base.poster = raw.poster;
  if (raw.autoplay !== undefined) base.autoplay = raw.autoplay;
  if (raw.loop !== undefined) base.loop = raw.loop;
  if (raw.muted !== undefined) base.muted = raw.muted;
  if (raw.naturalWidth !== undefined) base.naturalWidth = raw.naturalWidth;
  if (raw.naturalHeight !== undefined) base.naturalHeight = raw.naturalHeight;
  if (raw.objectFit !== undefined) base.objectFit = raw.objectFit;
  if (raw.objectPosition !== undefined) base.objectPosition = raw.objectPosition;

  return base;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function countElements(elements: ElementSpec[]): number {
  let count = elements.length;
  for (const el of elements) {
    count += countElements(el.children);
  }
  return count;
}
