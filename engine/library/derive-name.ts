/**
 * Derive a semantic name + tag list for a section from its JSX source.
 *
 * Canonical algorithm spec: see ./naming-rules.md
 */

export type SectionRole = "header" | "footer" | "main" | "shared";

export interface NameDerivation {
  name: string;
  tags: string[];
}

const FILLER_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "with",
  "for",
  "by",
]);

export function deriveName(jsxSource: string, role: SectionRole): string {
  if (role === "header") return "Header";
  if (role === "footer") return "Footer";

  const headingText = extractFirstHeading(jsxSource);
  if (headingText) return titleCase(headingText);

  const patterns = detectPatterns(jsxSource);

  if (patterns.video && patterns.hero) return "Hero Video";
  if (patterns.hero) return "Hero";
  if (patterns.video) return "Video Section";
  if (patterns.marquee) return "Marquee Strip";
  if (patterns.form) return "Form Section";
  if (patterns.swiper) return "Carousel";
  if (patterns.testimonial) return "Testimonial";
  if (patterns.cta) return "Call to Action";
  if (patterns.grid) return "Grid Section";

  return "Section";
}

export function deriveTags(jsxSource: string, role: SectionRole): string[] {
  const tags = new Set<string>();
  const p = detectPatterns(jsxSource);

  if (role === "header") tags.add("header");
  if (role === "footer") tags.add("footer");

  if (p.video) tags.add("video");
  if (p.image) tags.add("image");
  if (p.form) tags.add("form");
  if (p.swiper) tags.add("carousel");
  if (p.marquee) tags.add("marquee");
  if (p.hero) tags.add("hero");
  if (p.testimonial) tags.add("testimonial");
  if (p.cta) tags.add("cta");
  if (p.grid) tags.add("grid");
  if (p.nav) tags.add("nav");

  return Array.from(tags).sort();
}

/**
 * Disambiguate a list of derived names by appending (N) to duplicates.
 * Mutates and returns a new array; input list is not changed in-place.
 */
export function disambiguateNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  const seenOnce = new Map<string, boolean>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);

  const running = new Map<string, number>();
  return names.map((n) => {
    if ((counts.get(n) ?? 0) <= 1) return n;
    const next = (running.get(n) ?? 0) + 1;
    running.set(n, next);
    // First occurrence stays as the bare name; subsequent ones get (2), (3), ...
    if (next === 1) {
      seenOnce.set(n, true);
      return n;
    }
    return `${n} (${next})`;
  });
}

interface Patterns {
  video: boolean;
  image: boolean;
  form: boolean;
  swiper: boolean;
  marquee: boolean;
  hero: boolean;
  testimonial: boolean;
  cta: boolean;
  grid: boolean;
  nav: boolean;
}

function detectPatterns(src: string): Patterns {
  return {
    video: /<video[\s>]/i.test(src),
    image: /<img[\s>]/i.test(src),
    form: /<form[\s>]/i.test(src),
    swiper: /swiper|\bslider\b/i.test(src),
    marquee: /marquee|scroll[-_]?text/i.test(src),
    hero: /\bhero[-_ ]?(section|heading|content|video|wrapper|inner|title)\b/i.test(src),
    testimonial: /testimonial|\breview\b|<blockquote/i.test(src),
    cta: /\bcta\b|call[-_ ]?to[-_ ]?action|book[-_ ]?now|get[-_ ]?started|sign[-_ ]?up/i.test(src),
    grid: /\bgrid(Item|-item|_item)?\b|columnsItem/i.test(src),
    nav: /<nav[\s>]/i.test(src),
  };
}

function extractFirstHeading(src: string): string | null {
  const m = src.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/);
  if (!m) return null;
  let txt = m[1]
    .replace(/<[^>]+>/g, " ") // strip nested tags
    .replace(/\{[^}]*\}/g, " ") // strip JSX expressions
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (txt.length === 0) return null;
  if (txt.length > 50) txt = txt.slice(0, 50).trim() + "...";
  return txt;
}

function titleCase(input: string): string {
  // Preserve content already in mixed case (likely intentional brand naming).
  // Only re-case fully lower or fully upper strings.
  const isAllLower = input === input.toLowerCase();
  const isAllUpper = input === input.toUpperCase();
  if (!isAllLower && !isAllUpper) return input;

  const words = input.toLowerCase().split(/\s+/);
  return words
    .map((w, i) => {
      if (i > 0 && FILLER_WORDS.has(w)) return w;
      if (w.length === 0) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}
