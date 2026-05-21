/**
 * MSW (Mock Service Worker) scaffolding. Phase 1 ships an empty handler
 * array; Phase 4 fills it in from captured XHR/fetch traffic in the
 * clone manifest.
 *
 * Consumers must run `npm run msw:init` once after install to copy
 * `mockServiceWorker.js` into `public/`. We can't ship that file from
 * dr-parity because it must match the installed `msw` version exactly.
 */

import { join } from 'node:path';

import { writeText } from './fs-utils';

export function writeMswSetup(outDir: string): void {
  const browserSrc = [
    "import { setupWorker } from 'msw/browser';",
    "import { handlers } from './handlers';",
    '',
    'export const worker = setupWorker(...handlers);',
    '',
  ].join('\n');

  const handlersSrc = [
    "import type { HttpHandler } from 'msw';",
    '',
    '/**',
    ' * Captured network traffic is replayed here as MSW handlers. Phase 4',
    ' * of dr-parity populates this list from the clone manifest. Until then',
    ' * the worker passes every request through to the network.',
    ' */',
    'export const handlers: HttpHandler[] = [];',
    '',
  ].join('\n');

  writeText(join(outDir, 'src', 'mocks', 'browser.ts'), browserSrc);
  writeText(join(outDir, 'src', 'mocks', 'handlers.ts'), handlersSrc);
}
