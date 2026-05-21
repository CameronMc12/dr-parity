import type { Page } from 'playwright';

const SIGNATURE_RULES: ReadonlyArray<{ name: string; test: RegExp }> = [
  { name: 'react-beautiful-dnd', test: /data-rbd-droppable-id|data-rbd-draggable-id/i },
  { name: 'dnd-kit', test: /data-dnd-kit-id|data-droppable-id/i },
  { name: 'react-select', test: /react-select__control|react-select__menu/ },
  { name: '@headlessui/react', test: /data-headlessui-state/i },
  { name: '@radix-ui/*', test: /data-radix-[a-z-]+/i },
  { name: '@floating-ui/react', test: /data-floating-ui-portal/i },
  { name: 'react-multi-select-component', test: /data-rmsc/i },
  { name: 'swiper', test: /swiper-container|swiper-wrapper/i },
  { name: 'slick-carousel', test: /slick-track|slick-slider/i },
];

const TRANSFORM_3D_RE = /transform:\s*translate3d/gi;

export type SignatureScan = {
  add(html: string): void;
  list(): string[];
};

export function createSignatureScan(): SignatureScan {
  const found = new Set<string>();
  return {
    add(html: string): void {
      for (const rule of SIGNATURE_RULES) {
        if (rule.test.test(html)) found.add(rule.name);
      }
      const matches = html.match(TRANSFORM_3D_RE);
      if (matches && matches.length >= 5) found.add('framer-motion');
    },
    list(): string[] {
      return Array.from(found).sort();
    },
  };
}

export async function scanPage(page: Page, scan: SignatureScan): Promise<void> {
  const html = (await page.evaluate('document.documentElement.outerHTML')) as string;
  scan.add(html);
}
