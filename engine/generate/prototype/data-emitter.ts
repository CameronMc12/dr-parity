/**
 * Walks each section's elements to extract structured mock data (text content,
 * image sources, numeric values) and emits `data.jsx` exposing one
 * `<section>Data` object per section on `window`.
 */

import type { ElementSpec, SectionSpec } from '../../types/extraction';

export function buildDataJsx(sections: SectionSpec[]): string {
  const exports: string[] = [];
  const lines: string[] = [
    '/* data.jsx — mock data extracted from the source DOM */',
    '',
  ];

  for (const section of sections) {
    const varName = `${camelCase(section.name)}Data`;
    const payload = extractSectionData(section);
    lines.push(`const ${varName} = ${JSON.stringify(payload, null, 2)};`);
    lines.push('');
    exports.push(varName);
  }

  lines.push(`Object.assign(window, { ${exports.join(', ')} });`);
  lines.push('');
  return lines.join('\n');
}

interface SectionData {
  title?: string;
  subtitle?: string;
  body: string[];
  numerics: string[];
  images: { src: string; alt: string }[];
  links: { href: string; text: string }[];
}

function extractSectionData(section: SectionSpec): SectionData {
  const data: SectionData = {
    body: [],
    numerics: [],
    images: [],
    links: [],
  };

  walk(section.elements, data);

  // Promote first heading-like text to title.
  if (!data.title && data.body.length > 0) {
    data.title = data.body.shift();
  }
  if (!data.subtitle && data.body.length > 0) {
    data.subtitle = data.body.shift();
  }

  return data;
}

function walk(elements: ElementSpec[], data: SectionData): void {
  for (const el of elements) {
    const text = (el.textContent ?? '').trim();
    const tag = el.tag.toLowerCase();

    if (tag === 'img' && (el.media?.src || el.attributes.src)) {
      data.images.push({
        src: el.media?.localPath ?? el.media?.src ?? el.attributes.src ?? '',
        alt: el.media?.alt ?? el.attributes.alt ?? '',
      });
    }

    if (tag === 'a' && el.attributes.href && text) {
      data.links.push({ href: el.attributes.href, text });
    }

    if (text && el.children.length === 0) {
      if (/^[$#]?\d[\d.,:\-/%]*[a-z]{0,3}$/i.test(text)) {
        data.numerics.push(text);
      } else {
        data.body.push(text);
      }
    }

    if (el.children.length > 0) walk(el.children, data);
  }
}

function camelCase(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
  return cleaned || 'section';
}
