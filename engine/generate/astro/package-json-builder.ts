/**
 * Emits the package.json for the generated Astro project.
 *
 * Astro + GSAP are always included. React + @astrojs/react are added only when
 * any section in the ComponentTree is flagged isClient (i.e. an interactive
 * island is needed).
 */

export interface PackageJsonOptions {
  name: string;
  hasIslands: boolean;
}

const ASTRO_VERSION = '^5.0.0';
const GSAP_VERSION = '^3.13.0';
const ASTRO_REACT_VERSION = '^4.0.0';
const ASTRO_CLOUDFLARE_VERSION = '^12.0.0';
const REACT_VERSION = '^18.3.1';
const TYPES_REACT_VERSION = '^18.3.0';
const WRANGLER_VERSION = '^3.90.0';

export function buildPackageJson(options: PackageJsonOptions): string {
  const { name, hasIslands } = options;

  const dependencies: Record<string, string> = {
    astro: ASTRO_VERSION,
    gsap: GSAP_VERSION,
    '@astrojs/cloudflare': ASTRO_CLOUDFLARE_VERSION,
  };
  const devDependencies: Record<string, string> = {
    wrangler: WRANGLER_VERSION,
  };

  if (hasIslands) {
    dependencies['@astrojs/react'] = ASTRO_REACT_VERSION;
    dependencies.react = REACT_VERSION;
    dependencies['react-dom'] = REACT_VERSION;
    devDependencies['@types/react'] = TYPES_REACT_VERSION;
    devDependencies['@types/react-dom'] = TYPES_REACT_VERSION;
  }

  const pkg = {
    name,
    type: 'module',
    version: '0.0.1',
    private: true,
    scripts: {
      dev: 'astro dev',
      start: 'astro dev',
      build: 'astro build',
      preview: 'astro preview',
      astro: 'astro',
      deploy: 'astro build && wrangler pages deploy dist',
      'preview:cf': 'wrangler pages dev dist',
    },
    dependencies,
    devDependencies,
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}
