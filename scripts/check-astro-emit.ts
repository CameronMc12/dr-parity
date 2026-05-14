/**
 * Smoke test for engine/astro/{extract-head,emit,paths,is-inline}.
 *
 * Verifies two invariants in the generated .astro output:
 *
 *   1. Every <script> and <style> tag carries `is:inline` so Astro emits it
 *      verbatim instead of trying to resolve its src through Vite.
 *
 *   2. No `./` (current-dir) prefixes remain on src/href/srcset attributes.
 *      Captured clones use `<base href="./"/>` so all assets are relative;
 *      the slicer must rewrite them to root-anchored absolute paths.
 *
 * Run via:
 *   npm run check:astro-emit
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

import { extractHead } from '../engine/astro/extract-head';
import { sliceBody } from '../engine/astro/slice-body';
import { writeComponent, writeLayout, writePage } from '../engine/astro/emit';

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <base href="./"/>
    <meta charset="utf-8">
    <title>Fixture</title>
    <meta name="description" content="fixture">
    <link rel="stylesheet" href="./styles/site.css">
    <script src="./_external/cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
    <script>console.log('inline');</script>
    <style>body { background: url("./imgs/bg.png"); }</style>
  </head>
  <body>
    <header>
      <img src="./imgs/logo.png" srcset="./imgs/logo.png 1x, ./imgs/logo@2x.png 2x">
    </header>
    <main>
      <section id="hero">
        <h1>Hi</h1>
        <script src="./_external/cdn.jsdelivr.net/npm/foo.js"></script>
      </section>
    </main>
    <footer>
      <script>window.x = 1;</script>
    </footer>
  </body>
</html>`;

interface Failure { msg: string; sample?: string }

function readAllAstroFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) readAllAstroFiles(full, files);
    else if (entry.endsWith('.astro')) files.push(full);
  }
  return files;
}

function checkIsInline(astroBody: string, file: string): Failure[] {
  const failures: Failure[] = [];
  const scriptOpenings = astroBody.match(/<script(\b[^>]*)>/gi) ?? [];
  for (const open of scriptOpenings) {
    if (!/\bis:inline\b/.test(open)) {
      failures.push({ msg: `${file}: <script> missing is:inline`, sample: open });
    }
  }
  const styleOpenings = astroBody.match(/<style(\b[^>]*)>/gi) ?? [];
  for (const open of styleOpenings) {
    if (!/\bis:inline\b/.test(open)) {
      failures.push({ msg: `${file}: <style> missing is:inline`, sample: open });
    }
  }
  return failures;
}

function checkPaths(astroBody: string, file: string): Failure[] {
  const failures: Failure[] = [];
  const dotSlashAttr = /(?:src|href|srcset|poster|data-src|data-srcset)\s*=\s*["']\.\//gi;
  const matches = astroBody.match(dotSlashAttr);
  if (matches && matches.length > 0) {
    for (const m of matches) failures.push({ msg: `${file}: residual "./" path`, sample: m });
  }
  const dotSlashUrlCss = /url\(\s*['"]?\.\//gi;
  const cssMatches = astroBody.match(dotSlashUrlCss);
  if (cssMatches && cssMatches.length > 0) {
    for (const m of cssMatches) failures.push({ msg: `${file}: residual "./" in url()`, sample: m });
  }
  return failures;
}

function stripFrontmatter(astro: string): string {
  if (!astro.startsWith('---')) return astro;
  const close = astro.indexOf('\n---', 3);
  if (close === -1) return astro;
  return astro.slice(close + '\n---'.length);
}

function checkMainShape(astroPath: string, raw: string): Failure[] {
  const failures: Failure[] = [];
  const rel = astroPath;
  // Trailing fence is illegal
  if (/\n---\s*\n*$/.test(raw)) {
    failures.push({ msg: `${rel}: trailing --- frontmatter fence at EOF` });
  }
  // No frontmatter unless first three chars are "---"
  const startsWithFence = raw.startsWith('---');
  const fenceCount = (raw.match(/^---\s*$/gm) ?? []).length;
  if (!startsWithFence && fenceCount > 0) {
    failures.push({ msg: `${rel}: stray --- fence with no opening fence at top` });
  }
  if (startsWithFence && fenceCount > 2) {
    failures.push({ msg: `${rel}: more than two --- fences` });
  }
  return failures;
}

function checkMainHasOnlyComposedJSX(astroPath: string, raw: string): Failure[] {
  const failures: Failure[] = [];
  if (!astroPath.endsWith('/Main.astro')) return failures;
  const close = raw.indexOf('\n---', 3);
  if (close === -1) {
    failures.push({ msg: `${astroPath}: Main.astro missing frontmatter` });
    return failures;
  }
  const body = raw.slice(close + '\n---'.length);
  // Body must be <main ...> ... </main> only, with child JSX of the form <SectionNN_X />
  const mainOpenIdx = body.search(/<main\b/);
  const mainCloseIdx = body.lastIndexOf('</main>');
  if (mainOpenIdx === -1 || mainCloseIdx === -1) {
    failures.push({ msg: `${astroPath}: Main.astro missing <main> wrapper` });
    return failures;
  }
  const inner = body.slice(body.indexOf('>', mainOpenIdx) + 1, mainCloseIdx);
  // Inner should be only whitespace + self-closing component tags
  const stripped = inner.replace(/<Section\d{2}_[A-Za-z0-9_]+\s*\/>/g, '').trim();
  if (stripped.length > 0) {
    failures.push({ msg: `${astroPath}: Main.astro body contains non-section JSX`, sample: stripped.slice(0, 80) });
  }
  return failures;
}

const FIXTURE_TWO_SECTIONS = `<!doctype html>
<html lang="en">
  <head><base href="./"/><title>Two</title></head>
  <body>
    <header><nav>Top</nav></header>
    <main id="page" class="mx-auto" data-foo="bar">
      <section id="hero"><h1>Hero</h1></section>
      <section id="cta"><p>CTA</p></section>
    </main>
    <footer>F</footer>
  </body>
</html>`;

const FIXTURE_BODY_SCRIPTS = `<!doctype html>
<html lang="en">
  <head><base href="./"/><title>Scripts</title></head>
  <body>
    <script src="./js/preamble.js" defer></script>
    <header><nav>Top</nav></header>
    <main>
      <section id="hero">
        <h1>Hi</h1>
        <script src="./js/section.js" defer></script>
      </section>
      <script src="./js/main-orphan.js" defer></script>
    </main>
    <footer>F</footer>
    <div class="preload"></div>
    <div class="transition__layer"></div>
    <script src="./js/transition.js" defer></script>
    <script type="module" src="./_astro/global.client.CNq1OO9p.js" defer></script>
    <script type="module" src="./lib/textsplitter.js" defer></script>
    <script defer src="./js/swiper-slider.js"></script>
    <style>.postamble{display:block}</style>
  </body>
</html>`;

function runFixtureBodyScripts(): Failure[] {
  const tmp = mkdtempSync(join(tmpdir(), 'dr-parity-astro-emit-bodyscripts-'));
  const failures: Failure[] = [];
  try {
    const $ = cheerio.load(FIXTURE_BODY_SCRIPTS, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);
    const layoutsDir = join(tmp, 'src', 'layouts');
    const componentsDir = join(tmp, 'src', 'components');
    const pagesDir = join(tmp, 'src', 'pages');
    writeLayout(layoutsDir, head);
    for (const c of components) writeComponent(componentsDir, c);
    writePage({ pagesDir, pageImports, title: head.title, description: head.description });

    const postamblePath = join(componentsDir, 'BodyPostamble.astro');
    const preamblePath = join(componentsDir, 'BodyPreamble.astro');

    let postamble = '';
    try {
      postamble = readFileSync(postamblePath, 'utf8');
    } catch {
      failures.push({ msg: 'body-scripts: BodyPostamble.astro not emitted' });
    }
    let preamble = '';
    try {
      preamble = readFileSync(preamblePath, 'utf8');
    } catch {
      failures.push({ msg: 'body-scripts: BodyPreamble.astro not emitted' });
    }

    const expectedPostambleSrcs = [
      '/js/transition.js',
      '/_astro/global.client.CNq1OO9p.js',
      '/lib/textsplitter.js',
      '/js/swiper-slider.js',
    ];
    for (const src of expectedPostambleSrcs) {
      if (!postamble.includes(`src="${src}"`)) {
        failures.push({ msg: `body-scripts: BodyPostamble missing script src="${src}"` });
      }
    }
    if (!/<div class="preload">/.test(postamble)) {
      failures.push({ msg: 'body-scripts: BodyPostamble missing preload div' });
    }
    if (!/<div class="transition__layer">/.test(postamble)) {
      failures.push({ msg: 'body-scripts: BodyPostamble missing transition layer div' });
    }
    if (!/<style\b[^>]*\bis:inline\b/.test(postamble)) {
      failures.push({ msg: 'body-scripts: BodyPostamble <style> missing is:inline' });
    }
    const postambleScriptOpenings = postamble.match(/<script\b[^>]*>/gi) ?? [];
    for (const open of postambleScriptOpenings) {
      if (!/\bis:inline\b/.test(open)) {
        failures.push({ msg: 'body-scripts: BodyPostamble script missing is:inline', sample: open });
      }
      if (!/\bdefer\b/.test(open)) {
        failures.push({ msg: 'body-scripts: BodyPostamble script missing defer', sample: open });
      }
    }
    const moduleScripts = postambleScriptOpenings.filter((s) => /type="module"/.test(s));
    if (moduleScripts.length < 2) {
      failures.push({ msg: `body-scripts: expected 2 type="module" scripts in BodyPostamble, found ${moduleScripts.length}` });
    }

    if (!preamble.includes('src="/js/preamble.js"')) {
      failures.push({ msg: 'body-scripts: BodyPreamble missing leading script' });
    }
    const preambleScriptOpenings = preamble.match(/<script\b[^>]*>/gi) ?? [];
    for (const open of preambleScriptOpenings) {
      if (!/\bis:inline\b/.test(open)) {
        failures.push({ msg: 'body-scripts: BodyPreamble script missing is:inline', sample: open });
      }
    }

    if (postamble.includes('./js/') || postamble.includes('./_astro/') || postamble.includes('./lib/')) {
      failures.push({ msg: 'body-scripts: BodyPostamble has residual ./ paths' });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return failures;
}

const FIXTURE_POST_MAIN = `<!doctype html>
<html lang="en">
  <head><base href="./"/><title>PostMain</title></head>
  <body>
    <header><nav>Top</nav></header>
    <main><section id="a">A</section></main>
    <section class="post-main">B</section>
    <footer>F</footer>
    <div>tail</div>
  </body>
</html>`;

const FIXTURE_INTERSTITIAL = `<!doctype html>
<html lang="en">
  <head><base href="./"/><title>Interstitial</title></head>
  <body>
    <header><nav>Top</nav></header>
    <div class="notification-bar">Banner</div>
    <main><section id="a">A</section></main>
    <footer>F</footer>
  </body>
</html>`;

function runFixturePostMain(): Failure[] {
  const tmp = mkdtempSync(join(tmpdir(), 'dr-parity-astro-emit-postmain-'));
  const failures: Failure[] = [];
  try {
    const $ = cheerio.load(FIXTURE_POST_MAIN, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);
    const layoutsDir = join(tmp, 'src', 'layouts');
    const componentsDir = join(tmp, 'src', 'components');
    const pagesDir = join(tmp, 'src', 'pages');
    writeLayout(layoutsDir, head);
    for (const c of components) writeComponent(componentsDir, c);
    writePage({ pagesDir, pageImports, title: head.title, description: head.description });

    const pageRaw = readFileSync(join(pagesDir, 'index.astro'), 'utf8');

    const expectedOrder = ['Header', 'Main', 'PostMain', 'Footer', 'BodyPostamble'];
    const positions = expectedOrder.map((name) => pageRaw.indexOf(`<${name} />`));
    for (let i = 0; i < expectedOrder.length; i++) {
      if (positions[i] === -1) {
        failures.push({ msg: `post-main: index.astro missing <${expectedOrder[i]} />` });
      }
    }
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] !== -1 && positions[i - 1] !== -1 && positions[i] < positions[i - 1]) {
        failures.push({
          msg: `post-main: <${expectedOrder[i]} /> appears before <${expectedOrder[i - 1]} />`,
        });
      }
    }

    let postMain = '';
    try {
      postMain = readFileSync(join(componentsDir, 'PostMain.astro'), 'utf8');
    } catch {
      failures.push({ msg: 'post-main: PostMain.astro not emitted' });
    }
    if (postMain && !/class="post-main"/.test(postMain)) {
      failures.push({ msg: 'post-main: PostMain.astro missing class="post-main"' });
    }

    let interstitialExists = true;
    try {
      readFileSync(join(componentsDir, 'MainInterstitial.astro'), 'utf8');
    } catch {
      interstitialExists = false;
    }
    if (interstitialExists) {
      failures.push({ msg: 'post-main: MainInterstitial.astro should not exist for this fixture' });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return failures;
}

function runFixtureInterstitial(): Failure[] {
  const tmp = mkdtempSync(join(tmpdir(), 'dr-parity-astro-emit-interstitial-'));
  const failures: Failure[] = [];
  try {
    const $ = cheerio.load(FIXTURE_INTERSTITIAL, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);
    const layoutsDir = join(tmp, 'src', 'layouts');
    const componentsDir = join(tmp, 'src', 'components');
    const pagesDir = join(tmp, 'src', 'pages');
    writeLayout(layoutsDir, head);
    for (const c of components) writeComponent(componentsDir, c);
    writePage({ pagesDir, pageImports, title: head.title, description: head.description });

    const pageRaw = readFileSync(join(pagesDir, 'index.astro'), 'utf8');

    let interstitial = '';
    try {
      interstitial = readFileSync(join(componentsDir, 'MainInterstitial.astro'), 'utf8');
    } catch {
      failures.push({ msg: 'interstitial: MainInterstitial.astro not emitted' });
    }
    if (interstitial && !/class="notification-bar"/.test(interstitial)) {
      failures.push({ msg: 'interstitial: MainInterstitial.astro missing notification-bar' });
    }

    const headerPos = pageRaw.indexOf('<Header />');
    const interstitialPos = pageRaw.indexOf('<MainInterstitial />');
    const mainPos = pageRaw.indexOf('<Main />');
    if (headerPos === -1 || interstitialPos === -1 || mainPos === -1) {
      failures.push({ msg: 'interstitial: page missing Header/MainInterstitial/Main composition' });
    } else if (!(headerPos < interstitialPos && interstitialPos < mainPos)) {
      failures.push({ msg: 'interstitial: order should be Header -> MainInterstitial -> Main' });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return failures;
}

function runFixtureTwoSections(): Failure[] {
  const tmp = mkdtempSync(join(tmpdir(), 'dr-parity-astro-emit-two-'));
  const failures: Failure[] = [];
  try {
    const $ = cheerio.load(FIXTURE_TWO_SECTIONS, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);
    const layoutsDir = join(tmp, 'src', 'layouts');
    const componentsDir = join(tmp, 'src', 'components');
    const pagesDir = join(tmp, 'src', 'pages');
    writeLayout(layoutsDir, head);
    for (const c of components) writeComponent(componentsDir, c);
    writePage({ pagesDir, pageImports, title: head.title, description: head.description });

    const mainPath = join(componentsDir, 'Main.astro');
    const mainRaw = readFileSync(mainPath, 'utf8');

    // 1. No trailing fence
    if (/\n---\s*\n*$/.test(mainRaw)) {
      failures.push({ msg: 'two-sections: Main.astro has trailing --- fence' });
    }
    // 2. No captured innerHTML — body between frontmatter end and </main> must
    //    contain ONLY composed <SectionNN_* /> tags (plus whitespace).
    failures.push(...checkMainHasOnlyComposedJSX('Main.astro', mainRaw));
    // 3. Imports for Section01 and Section02 must be present
    if (!/import Section01_\w+ from '\.\/Section01_\w+\.astro';/.test(mainRaw)) {
      failures.push({ msg: 'two-sections: Main.astro missing Section01 import' });
    }
    if (!/import Section02_\w+ from '\.\/Section02_\w+\.astro';/.test(mainRaw)) {
      failures.push({ msg: 'two-sections: Main.astro missing Section02 import' });
    }
    // 4. Main attributes preserved
    if (!/<main\b[^>]*\bid="page"/.test(mainRaw)) {
      failures.push({ msg: 'two-sections: Main.astro lost id attribute' });
    }
    if (!/<main\b[^>]*\bdata-foo="bar"/.test(mainRaw)) {
      failures.push({ msg: 'two-sections: Main.astro lost data-foo attribute' });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return failures;
}

function run(): void {
  const tmp = mkdtempSync(join(tmpdir(), 'dr-parity-astro-emit-'));
  let failures: Failure[] = [];
  try {
    writeFileSync(join(tmp, 'index.html'), FIXTURE_HTML, 'utf8');

    const $ = cheerio.load(FIXTURE_HTML, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);

    const layoutsDir = join(tmp, 'src', 'layouts');
    const componentsDir = join(tmp, 'src', 'components');
    const pagesDir = join(tmp, 'src', 'pages');

    writeLayout(layoutsDir, head);
    for (const c of components) writeComponent(componentsDir, c);
    writePage({ pagesDir, pageImports, title: head.title, description: head.description });

    const files = readAllAstroFiles(join(tmp, 'src'));
    if (files.length === 0) failures.push({ msg: 'no .astro files emitted' });

    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const body = stripFrontmatter(raw);
      const rel = file.replace(tmp, '');
      failures = failures.concat(checkIsInline(body, rel));
      failures = failures.concat(checkPaths(body, rel));
      failures = failures.concat(checkMainShape(rel, raw));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  failures = failures.concat(runFixtureTwoSections());
  failures = failures.concat(runFixtureBodyScripts());
  failures = failures.concat(runFixturePostMain());
  failures = failures.concat(runFixtureInterstitial());

  if (failures.length === 0) {
    console.log(`OK  ${FIXTURE_HTML.length} bytes of fixture HTML emitted with is:inline, absolute paths, and clean Main.astro`);
    return;
  }
  console.error(`FAIL ${failures.length} issue(s):`);
  for (const f of failures) {
    console.error(`  - ${f.msg}${f.sample ? `  [${f.sample}]` : ''}`);
  }
  process.exit(1);
}

run();
