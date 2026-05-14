import { refactorBody } from '../engine/refactor/walk';
import { buildNormalisedSwapIndex } from '../engine/refactor/load-maps';
import type {
  DomSwapMap,
  NormalisedSwapEntry,
  PrimitiveMap,
  ProtectionCounters,
} from '../engine/refactor/types';

interface ProtectionAssertion {
  protectedElements?: number;
  customElement?: number;
  dataAttr?: number;
  ancestor?: number;
  wouldHaveSwapped?: number;
}

interface Case {
  name: string;
  body: string;
  primitiveMap: PrimitiveMap;
  iconIndex: NormalisedSwapEntry[];
  mustInclude: string[];
  mustNotInclude: string[];
  protection?: ProtectionAssertion;
}

const baseSvg = '<svg class="logo" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"></path></svg>';

const arrowSwapMap: DomSwapMap = [
  {
    originalOuterHTML: baseSvg,
    hash: 'arrow-1',
    pascalName: 'ArrowIcon',
  },
];

const arrowIndex = buildNormalisedSwapIndex(arrowSwapMap);

const containerMap: PrimitiveMap = {
  byClass: {
    wrp: { primitive: 'Container', variant: null, size: null },
    button: { primitive: 'Button', variant: 'ghost', size: null },
    'heading-l': { primitive: 'Heading', variant: null, size: 'l' },
    grid: { primitive: 'Grid', variant: null, size: null },
  },
  byTag: {
    'a-link': { primitive: 'Link', variant: null, size: null },
  },
};

const cases: Case[] = [
  {
    name: 'container with link: custom element protects subtree',
    body: '<div class="wrp"><a-link href="/x">Click</a-link></div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Container', '</Container>', '<a-link', '</a-link>', '>Click<'],
    mustNotInclude: ['<Link', '</Link>'],
    protection: {
      protectedElements: 1,
      customElement: 1,
      wouldHaveSwapped: 1,
    },
  },
  {
    name: 'grid with heading preserves size prop and PascalCase',
    body: '<div class="grid"><h1 class="heading-l">Next-Gen Buildings</h1></div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Grid', '</Grid>', '<Heading', 'size="l"', '>Next-Gen Buildings<', '</Heading>'],
    mustNotInclude: ['<grid', '</grid>', '<heading', '</heading>'],
  },
  {
    name: 'matching svg is rewritten to self-closing PascalCase icon',
    body: `<div class="wrp">${baseSvg}</div>`,
    primitiveMap: containerMap,
    iconIndex: arrowIndex,
    mustInclude: ['<ArrowIcon', '/>', '<Container'],
    mustNotInclude: ['<arrowicon', '</arrowicon>', '<svg'],
  },
  {
    name: 'custom element with data-id is protected (not swapped)',
    body: '<a-link href="/about" data-id="42">About</a-link>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<a-link', 'href="/about"', 'data-id="42"', '>About<', '</a-link>'],
    mustNotInclude: ['<Link', '</Link>'],
    protection: {
      protectedElements: 1,
      customElement: 1,
      wouldHaveSwapped: 1,
    },
  },
  {
    name: 'variant prop is emitted on Button (unprotected)',
    body: '<button class="button" type="submit">Go</button>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Button', 'variant="ghost"', 'type="submit"', '>Go<', '</Button>'],
    mustNotInclude: ['<button', '</button>'],
  },
  {
    name: 'unmatched elements are left untouched',
    body: '<section><p>plain</p></section>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<section>', '<p>plain</p>', '</section>'],
    mustNotInclude: ['<Section', '<P>', '<dr-parity'],
  },
  {
    name: 'custom element with class-matched child: no swaps inside',
    body: '<a-link><button class="button">Hit</button></a-link>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<a-link', '<button class="button"', '>Hit<', '</button>', '</a-link>'],
    mustNotInclude: ['<Link', '<Button'],
    protection: {
      protectedElements: 2,
      customElement: 1,
      ancestor: 1,
      wouldHaveSwapped: 2,
    },
  },
  {
    name: 'plain wrp is swapped to Container',
    body: '<div class="wrp"><p>hi</p></div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Container', '<p>hi</p>', '</Container>'],
    mustNotInclude: ['<div class="wrp"'],
    protection: { protectedElements: 0, wouldHaveSwapped: 0 },
  },
  {
    name: 'data-controller div protects its button subtree',
    body: '<div data-controller="foo"><button class="button">A</button></div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['data-controller="foo"', '<button class="button"', '>A<', '</button>'],
    mustNotInclude: ['<Button', '<Container'],
    protection: {
      protectedElements: 2,
      dataAttr: 1,
      ancestor: 1,
      wouldHaveSwapped: 1,
    },
  },
  {
    name: 'outer div is swapped; nested a-link subtree stays untouched',
    body: '<div class="wrp"><a-link><div class="wrp">inner</div></a-link></div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Container', '<a-link', '<div class="wrp">inner</div>', '</a-link>', '</Container>'],
    mustNotInclude: ['<Link'],
    protection: {
      protectedElements: 2,
      customElement: 1,
      ancestor: 1,
      wouldHaveSwapped: 2,
    },
  },
  {
    name: 'svg inside custom element is not iconified',
    body: `<scroll-frames data-frames="3">${baseSvg}</scroll-frames>`,
    primitiveMap: containerMap,
    iconIndex: arrowIndex,
    mustInclude: ['<scroll-frames', 'data-frames="3"', '<svg', '</scroll-frames>'],
    mustNotInclude: ['<ArrowIcon'],
    protection: {
      protectedElements: 3,
      customElement: 1,
      ancestor: 2,
      wouldHaveSwapped: 1,
    },
  },
  {
    name: 'data-astro-cid alone does not protect (build artefact)',
    body: '<div class="wrp" data-astro-cid-abc123>hi</div>',
    primitiveMap: containerMap,
    iconIndex: [],
    mustInclude: ['<Container'],
    mustNotInclude: ['<div class="wrp"'],
    protection: { protectedElements: 0, wouldHaveSwapped: 0 },
  },
];

function checkProtection(
  actual: ProtectionCounters,
  expected: ProtectionAssertion,
): string[] {
  const errs: string[] = [];
  if (expected.protectedElements !== undefined && actual.protectedElements !== expected.protectedElements) {
    errs.push(`protectedElements expected ${expected.protectedElements} got ${actual.protectedElements}`);
  }
  if (expected.customElement !== undefined && actual.protectedByCause.customElement !== expected.customElement) {
    errs.push(`customElement expected ${expected.customElement} got ${actual.protectedByCause.customElement}`);
  }
  if (expected.dataAttr !== undefined && actual.protectedByCause.dataAttr !== expected.dataAttr) {
    errs.push(`dataAttr expected ${expected.dataAttr} got ${actual.protectedByCause.dataAttr}`);
  }
  if (expected.ancestor !== undefined && actual.protectedByCause.ancestor !== expected.ancestor) {
    errs.push(`ancestor expected ${expected.ancestor} got ${actual.protectedByCause.ancestor}`);
  }
  if (expected.wouldHaveSwapped !== undefined && actual.wouldHaveSwapped !== expected.wouldHaveSwapped) {
    errs.push(`wouldHaveSwapped expected ${expected.wouldHaveSwapped} got ${actual.wouldHaveSwapped}`);
  }
  return errs;
}

let failures = 0;
for (const c of cases) {
  const result = refactorBody(c.body, c.primitiveMap, c.iconIndex);
  const missing = c.mustInclude.filter((s) => !result.html.includes(s));
  const bad = c.mustNotInclude.filter((s) => result.html.includes(s));
  const protErrs = c.protection ? checkProtection(result.protection, c.protection) : [];
  if (missing.length === 0 && bad.length === 0 && protErrs.length === 0) {
    console.log(`OK   ${c.name}`);
    continue;
  }
  failures += 1;
  console.error(`FAIL ${c.name}`);
  if (missing.length > 0) console.error(`  missing: ${JSON.stringify(missing)}`);
  if (bad.length > 0) console.error(`  found-but-shouldnt: ${JSON.stringify(bad)}`);
  if (protErrs.length > 0) console.error(`  protection: ${protErrs.join('; ')}`);
  console.error(`  output: ${result.html}`);
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed`);
