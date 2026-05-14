import type { IconGroup, NormalisedSvg } from './types';

const PARENT_HINT_KEYWORDS = ['icon', 'logo', 'arrow', 'chevron', 'check'];

const PRIMITIVE_NAMES: ReadonlySet<string> = new Set([
  'Button',
  'Container',
  'Heading',
  'Text',
  'Link',
  'Icon',
  'Section',
  'Grid',
]);

function disambiguateAgainstPrimitives(pascal: string): string {
  if (!pascal) return pascal;
  return PRIMITIVE_NAMES.has(pascal) ? `${pascal}Icon` : pascal;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function toPascalCase(value: string): string {
  if (!value) return '';
  return value
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function parentClassHasHint(parentClass: string | null): string | null {
  if (!parentClass) return null;
  const classes = parentClass.split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    const lower = cls.toLowerCase();
    if (PARENT_HINT_KEYWORDS.some((kw) => lower.includes(kw))) {
      return cls;
    }
  }
  return null;
}

export function deriveKebabName(svg: NormalisedSvg): string {
  if (svg.ariaLabel) {
    const s = slugify(svg.ariaLabel);
    if (s) return s;
  }
  if (svg.dataIcon) {
    const s = slugify(svg.dataIcon);
    if (s) return s;
  }
  if (svg.dataName) {
    const s = slugify(svg.dataName);
    if (s) return s;
  }
  if (svg.firstClass) {
    const s = slugify(svg.firstClass);
    if (s) return s;
  }
  const hint = parentClassHasHint(svg.parentClass);
  if (hint) {
    const s = slugify(hint);
    if (s) return s;
  }
  return `${svg.hash}-icon`;
}

export function groupAndName(svgs: NormalisedSvg[]): IconGroup[] {
  const buckets = new Map<string, NormalisedSvg[]>();
  for (const svg of svgs) {
    const list = buckets.get(svg.hash);
    if (list) list.push(svg);
    else buckets.set(svg.hash, [svg]);
  }

  const used = new Set<string>();
  const groups: IconGroup[] = [];

  for (const [hash, items] of buckets) {
    const representative = items[0];
    const base = deriveKebabName(representative);
    let kebab = base;
    let n = 2;
    while (used.has(kebab)) {
      kebab = `${base}-${n}`;
      n++;
    }
    used.add(kebab);

    const pascalName = disambiguateAgainstPrimitives(toPascalCase(kebab));

    groups.push({
      hash,
      kebabName: kebab,
      pascalName,
      representative,
      occurrences: items,
    });
  }

  groups.sort((a, b) =>
    a.pascalName < b.pascalName ? -1 : a.pascalName > b.pascalName ? 1 : 0,
  );
  return groups;
}
