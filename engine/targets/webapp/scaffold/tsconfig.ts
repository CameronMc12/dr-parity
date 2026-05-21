import { join } from 'node:path';

import { writeText } from './fs-utils';

export function writeTsConfig(outDir: string): void {
  const root = {
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true,
      types: ['vite/client'],
    },
    include: ['src'],
  };
  writeText(join(outDir, 'tsconfig.json'), JSON.stringify(root, null, 2) + '\n');
}
