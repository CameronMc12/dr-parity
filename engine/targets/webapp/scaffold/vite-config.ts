/**
 * Vite config for the generated webapp. Single HTML entry by design — the
 * SPA is driven by React Router, so all routes share `index.html`. Future
 * phases can extend `build.rollupOptions.input` if a route needs its own
 * HTML shell (e.g. pre-render of a public landing).
 *
 * The `stripStaleEncoding` plugin fixes captured assets whose filename ends in
 * a compression extension (`.gz` / `.br`) but whose bytes are already DECODED
 * (Playwright's `response.body()` returns decoded bytes). Vite's static server
 * sets `Content-Encoding` from the extension, so the browser tries to inflate
 * plain content and fails with ERR_CONTENT_DECODING_FAILED. We delete the
 * stale `Content-Encoding` header for these so they serve as-is.
 */

import { join } from 'node:path';

import { writeText } from './fs-utils';

export function writeViteConfig(outDir: string): void {
  const content = [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    "import type { Plugin } from 'vite';",
    '',
    'function stripStaleEncoding(): Plugin {',
    '  const handle = (req: any, res: any, next: () => void): void => {',
    '    const url: string = (req.url ?? "").split("?")[0];',
    '    if (url.endsWith(".gz") || url.endsWith(".br")) {',
    '      const original = res.setHeader.bind(res);',
    '      res.setHeader = (name: string, value: unknown) => {',
    '        if (String(name).toLowerCase() === "content-encoding") return res;',
    '        return original(name, value);',
    '      };',
    '      res.removeHeader("Content-Encoding");',
    '    }',
    '    next();',
    '  };',
    '  return {',
    "    name: 'dr-parity-strip-stale-encoding',",
    '    configureServer(server) {',
    '      server.middlewares.use(handle);',
    '    },',
    '    configurePreviewServer(server) {',
    '      server.middlewares.use(handle);',
    '    },',
    '  };',
    '}',
    '',
    'export default defineConfig({',
    '  plugins: [react(), stripStaleEncoding()],',
    '  server: {',
    '    port: 5173,',
    '    strictPort: false,',
    '  },',
    '});',
    '',
  ].join('\n');
  writeText(join(outDir, 'vite.config.ts'), content);
}
