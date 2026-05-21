/**
 * Vite config for the generated webapp. Single HTML entry by design — the
 * SPA is driven by React Router, so all routes share `index.html`. Future
 * phases can extend `build.rollupOptions.input` if a route needs its own
 * HTML shell (e.g. pre-render of a public landing).
 */

import { join } from 'node:path';

import { writeText } from './fs-utils';

export function writeViteConfig(outDir: string): void {
  const content = [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    '',
    'export default defineConfig({',
    '  plugins: [react()],',
    '  server: {',
    '    port: 5173,',
    '    strictPort: false,',
    '  },',
    '});',
    '',
  ].join('\n');
  writeText(join(outDir, 'vite.config.ts'), content);
}
