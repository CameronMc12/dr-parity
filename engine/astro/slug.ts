/**
 * Derive a deterministic component slug from a DOM node.
 *
 * Order of precedence: id, aria-label, data-section, role, first heading,
 * first distinctive class, finally the tag name.
 */

import type { Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';

const GENERIC_CLASS_PATTERNS = [
  /^astro-/,
  /^container$/i,
  /^wrapper$/i,
  /^row$/i,
  /^col(-|$)/i,
  /^section$/i,
  /^block$/i,
  /^content$/i,
  /^inner$/i,
  /^outer$/i,
  /^flex$/i,
  /^grid$/i,
  /^hidden$/i,
];

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function firstDistinctiveClass(el: Element): string | null {
  const cls = (el.attribs.class ?? '').trim();
  if (cls.length === 0) return null;
  for (const candidate of cls.split(/\s+/)) {
    if (candidate.length === 0) continue;
    if (GENERIC_CLASS_PATTERNS.some((p) => p.test(candidate))) continue;
    return candidate;
  }
  return null;
}

export function deriveSlug($: CheerioAPI, el: Element): string {
  const $el = $(el);

  const idAttr = el.attribs.id;
  if (idAttr && idAttr.length > 0) {
    const slug = slugify(idAttr);
    if (slug.length > 0) return slug;
  }

  const ariaLabel = el.attribs['aria-label'];
  if (ariaLabel && ariaLabel.length > 0) {
    const slug = slugify(ariaLabel);
    if (slug.length > 0) return slug;
  }

  const dataSection = el.attribs['data-section'] ?? el.attribs['data-name'];
  if (dataSection && dataSection.length > 0) {
    const slug = slugify(dataSection);
    if (slug.length > 0) return slug;
  }

  const role = el.attribs.role;
  if (role && role.length > 0 && role !== 'region') {
    const slug = slugify(role);
    if (slug.length > 0) return slug;
  }

  const heading = $el.find('h1, h2, h3').first().text().trim();
  if (heading.length > 0) {
    const slug = slugify(heading);
    if (slug.length > 0) return slug;
  }

  const cls = firstDistinctiveClass(el);
  if (cls) {
    const slug = slugify(cls);
    if (slug.length > 0) return slug;
  }

  return el.tagName.toLowerCase();
}

export function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}
