/**
 * Topology mapper — converts raw PageData into a structured TopologyMap
 * describing the vertical layout, overlay layers, and scroll behavior.
 */

import type { PageData, SectionSpec, GlobalBehavior } from '../types/extraction';
import type {
  TopologyMap,
  TopologySection,
  TopologySectionBackground,
  TopologyOverlay,
  TopologyOverlayType,
} from '../types/component';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildTopology(data: PageData): TopologyMap {
  const sorted = sortSectionsByTop(data.sections);
  const flowSections = sorted.filter((s) => s.position === 'flow' || s.position === 'absolute');
  const overlaySections = sorted.filter((s) => s.position === 'fixed' || s.position === 'sticky');

  const topologySections = buildTopologySections(flowSections);
  const overlays = buildOverlays(overlaySections);
  const totalHeight = computeTotalHeight(sorted);
  const scrollContainer = detectScrollContainer(data);
  const hasScrollSnap = detectScrollSnap(data);
  const hasSmoothScroll = detectSmoothScroll(data);
  const smoothScrollLibrary = detectSmoothScrollLibrary(data);

  return {
    sections: topologySections,
    overlays,
    scrollContainer,
    totalHeight,
    hasScrollSnap,
    hasSmoothScroll,
    ...(smoothScrollLibrary ? { smoothScrollLibrary } : {}),
  };
}

// ---------------------------------------------------------------------------
// Section ordering
// ---------------------------------------------------------------------------

function sortSectionsByTop(sections: readonly SectionSpec[]): SectionSpec[] {
  return [...sections].sort((a, b) => a.boundingRect.top - b.boundingRect.top);
}

// ---------------------------------------------------------------------------
// Background classification
// ---------------------------------------------------------------------------

function classifyBackground(section: SectionSpec): TopologySectionBackground {
  if (hasMediaOfType(section, 'video')) return 'video';
  if (hasMediaOfType(section, 'image') && isCoveringMedia(section)) return 'image';
  if (isGradient(section.backgroundColor)) return 'gradient';
  if (isDarkColor(section.backgroundColor)) return 'dark';
  return 'light';
}

function hasMediaOfType(section: SectionSpec, type: string): boolean {
  return section.elements.some(
    (el) => el.media?.type === type && el.isVisible,
  );
}

function isCoveringMedia(section: SectionSpec): boolean {
  return section.elements.some((el) => {
    if (!el.media || el.media.type !== 'image') return false;
    const elArea = el.boundingRect.width * el.boundingRect.height;
    const sectionArea = section.boundingRect.width * section.boundingRect.height;
    return sectionArea > 0 && elArea / sectionArea > 0.5;
  });
}

function isGradient(bg: string): boolean {
  const lower = bg.toLowerCase();
  return lower.includes('gradient');
}

/** Heuristic: parse rgb/rgba/hex and check perceived brightness. */
function isDarkColor(color: string): boolean {
  const rgb = parseColorToRgb(color);
  if (!rgb) return false;
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance < 128;
}

// ---------------------------------------------------------------------------
// Topology section builder
// ---------------------------------------------------------------------------

function buildTopologySections(sections: SectionSpec[]): TopologySection[] {
  return sections.map((section, idx) => {
    const bg = classifyBackground(section);
    const prev = idx > 0 ? classifyBackground(sections[idx - 1]) : null;

    const transition = prev !== null && prev !== bg
      ? { type: 'none' as const, direction: 'in' as const }
      : undefined;

    return {
      id: section.id,
      name: section.name,
      order: idx,
      top: section.boundingRect.top,
      height: section.boundingRect.height,
      background: bg,
      ...(transition ? { transition } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Overlay detection
// ---------------------------------------------------------------------------

function buildOverlays(sections: SectionSpec[]): TopologyOverlay[] {
  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    type: inferOverlayType(section),
    position: section.position as 'fixed' | 'sticky',
    zIndex: section.zIndex,
  }));
}

function inferOverlayType(section: SectionSpec): TopologyOverlayType {
  const name = section.name.toLowerCase();
  if (name.includes('header') || name.includes('nav')) return 'header';
  if (name.includes('footer')) return 'footer';
  if (name.includes('sidebar') || name.includes('drawer')) return 'sidebar';
  if (name.includes('modal') || name.includes('dialog')) return 'modal';
  if (name.includes('toast') || name.includes('snackbar')) return 'toast';
  if (name.includes('fab') || name.includes('float')) return 'fab';

  // Positional heuristic: top of page = header, bottom = footer
  if (section.boundingRect.top < 100) return 'header';
  return 'fab';
}

// ---------------------------------------------------------------------------
// Scroll & height detection
// ---------------------------------------------------------------------------

function computeTotalHeight(sorted: SectionSpec[]): number {
  if (sorted.length === 0) return 0;
  const last = sorted[sorted.length - 1];
  return last.boundingRect.top + last.boundingRect.height;
}

function detectScrollContainer(data: PageData): 'window' | string {
  const hijack = data.globalBehaviors.find((b) => b.type === 'scroll-hijack');
  if (hijack?.config?.['container']) {
    return String(hijack.config['container']);
  }
  return 'window';
}

function detectScrollSnap(data: PageData): boolean {
  return data.globalBehaviors.some((b) => b.type === 'scroll-snap');
}

function detectSmoothScroll(data: PageData): boolean {
  return data.globalBehaviors.some((b) => b.type === 'smooth-scroll');
}

function detectSmoothScrollLibrary(data: PageData): string | undefined {
  const smooth = data.globalBehaviors.find((b) => b.type === 'smooth-scroll');
  return smooth?.library?.name;
}

// ---------------------------------------------------------------------------
// Color parsing utility
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColorToRgb(color: string): Rgb | null {
  const trimmed = color.trim().toLowerCase();

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/,
  );
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  // #rrggbb or #rgb
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  return null;
}
