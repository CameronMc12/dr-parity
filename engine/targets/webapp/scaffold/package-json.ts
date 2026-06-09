import { join } from 'node:path';

import { writeText } from './fs-utils';

export function writePackageJson(outDir: string, name: string): void {
  const pkg = {
    name,
    private: true,
    type: 'module',
    version: '0.0.1',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      preview: 'vite preview',
      typecheck: 'tsc --noEmit',
      'msw:init': 'msw init public --save',
      // Provision the version-matched mockServiceWorker.js into public/ on
      // install so the dev worker registers (a missing file boots the real app
      // bundle's network instead of our mocks). Guarded so install never fails
      // if the worker already exists or msw is unavailable.
      postinstall: 'msw init public --save || true',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      'react-router-dom': '^6.26.2',
      msw: '^2.4.9',
      'mock-socket': '^9.3.1',
    },
    devDependencies: {
      '@types/react': '^18.3.5',
      '@types/react-dom': '^18.3.0',
      '@vitejs/plugin-react': '^4.3.1',
      typescript: '^5.5.4',
      vite: '^5.4.6',
    },
  };
  writeText(join(outDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}
