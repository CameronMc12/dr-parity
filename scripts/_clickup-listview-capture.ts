import { chromium, type BrowserContext, type Page, type Locator } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUT = '/Users/cameronmcallister/Github/dr-parity/docs/research/crawl/app.clickup.com/2026-06-01-listview-interactions';
const STATES = path.join(OUT, 'states');
const CAPTURED_AT = '2026-06-01';
const WS = '90152566819';

// Candidate populated List views (from prior crawls). First with >=3 task rows wins.
const CANDIDATE_LISTS = [
  `https://app.clickup.com/${WS}/v/l/2kyr6013-855`,
  `https://app.clickup.com/${WS}/v/li/901523543265`,
  `https://app.clickup.com/${WS}/v/li/901523543266`,
  `https://app.clickup.com/${WS}/v/li/901523543268`,
  `https://app.clickup.com/${WS}/v/li/901523543272`,
  `https://app.clickup.com/${WS}/v/li/901523543273`,
  `https://app.clickup.com/${WS}/v/li/901523542894`,
  `https://app.clickup.com/${WS}/v/li/901523542898`,
  `https://app.clickup.com/${WS}/v/li/901523542899`,
  `https://app.clickup.com/${WS}/v/li/901523542902`,
  `https://app.clickup.com/${WS}/v/l/2kyr6013-1155`,
  `https://app.clickup.com/${WS}/v/l/2kyr6013-415`,
  `https://app.clickup.com/${WS}/v/l/2kyr6013-815`,
];

const log = (...a: unknown[]) => console.log('[capture]', ...a);
function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }); }

async function ariaDump(page: Page): Promise<string> {
  try { return JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2); }
  catch (e) { return `aria snapshot failed: ${String(e)}`; }
}

interface SaveOpts { slug: string; trigger: string; notes: string; region?: Locator | null; }

async function saveState(page: Page, opts: SaveOpts) {
  const dir = path.join(STATES, opts.slug);
  ensureDir(dir);
  await page.screenshot({ path: path.join(dir, 'screenshot.png') }).catch((e) => log('screenshot fail', opts.slug, String(e)));
  let regionHtml = ''; let regionOk = false;
  if (opts.region) {
    try {
      const cnt = await opts.region.count();
      if (cnt > 0) {
        const el = opts.region.first();
        await el.screenshot({ path: path.join(dir, 'region.png') }).catch((e) => log('region.png fail', opts.slug, String(e)));
        regionHtml = await el.evaluate((n) => (n as HTMLElement).outerHTML).catch(() => '');
        regionOk = regionHtml.length > 0;
      }
    } catch (e) { log('region fail', opts.slug, String(e)); }
  }
  if (regionHtml) fs.writeFileSync(path.join(dir, 'region.html'), regionHtml);
  fs.writeFileSync(path.join(dir, 'dom.html'), await page.content());
  fs.writeFileSync(path.join(dir, 'aria.txt'), await ariaDump(page));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    slug: opts.slug, trigger: opts.trigger, capturedAt: CAPTURED_AT,
    url: page.url(), regionCaptured: regionOk, notes: opts.notes,
  }, null, 2));
  log(`saved ${opts.slug} (region=${regionOk})`);
  return { regionOk, regionHtml };
}

const results: Array<{ slug: string; trigger: string; captured: boolean; contains: string }> = [];
function record(slug: string, trigger: string, captured: boolean, contains: string) {
  results.push({ slug, trigger, captured, contains });
}

async function overlayGone(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const o = document.querySelectorAll('.cdk-overlay-pane, .ReactModalPortal [class*="overlay"], [role="menu"], [role="listbox"]');
    for (const el of Array.from(o)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      const vis = (el as HTMLElement).offsetParent !== null || r.width > 0;
      if (vis && r.width > 40 && r.height > 20) return false;
    }
    return true;
  }).catch(() => true);
}

async function escape(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    if (await overlayGone(page)) break;
  }
  if (!(await overlayGone(page))) {
    // click an empty area of the task grid canvas (far left, mid height)
    await page.mouse.click(8, 500).catch(() => {});
    await page.waitForTimeout(300);
  }
  if (!(await overlayGone(page))) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

// Score every visible cdk-overlay-pane / react portal menu and return the richest.
// Returns a unique attribute we stamp on the winning element so the caller can re-locate it.
async function findOpenOverlay(page: Page): Promise<Locator | null> {
  const ok = await page.evaluate(() => {
    // NOTE: no nested named helper functions here (tsx/esbuild injects __name() which is
    // undefined in the page context). Keep everything inline.
    const STAMP = 'data-oracle-region';
    const prev = document.querySelectorAll('[' + STAMP + ']');
    for (let i = 0; i < prev.length; i++) prev[i].removeAttribute(STAMP);
    const VIEWPORT = window.innerWidth * window.innerHeight;
    const containers = Array.from(document.querySelectorAll(
      '.cdk-overlay-pane, .ReactModalPortal, body > div[class*="overlay"], ' +
      '[data-test*="manager__"], .cu-fields-manager, [class*="side-panel"], [class*="fields-panel"], ' +
      '[data-test="column-manager"], [class*="customize-panel"]'
    ));
    let bestEl: Element | null = null;
    let bestScore = -1;
    for (let ci = 0; ci < containers.length; ci++) {
      const all = Array.from(containers[ci].querySelectorAll('*'));
      for (let ei = 0; ei < all.length; ei++) {
        const el = all[ei] as HTMLElement;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
        const cls = (el.className || '').toString();
        if (/backdrop|focus-trap-anchor|visually-hidden/.test(cls)) continue;
        const r = el.getBoundingClientRect();
        const w = r.width, h = r.height, a = w * h;
        if (w < 100 || h < 30) continue;
        if (a > VIEWPORT * 0.85) continue;
        const dt = el.getAttribute('data-test') || '';
        const role = el.getAttribute('role') || '';
        const looksMenu = /dropdown__menu|dropdown-list|context-menu|group-by-menu|filters|manager|priorit|calendar|date-picker|assignee|combo-box|menu|picker/i.test(cls)
          || role === 'menu' || role === 'listbox' || role === 'dialog'
          || /menu|dropdown|picker|manager|combo-box/i.test(dt);
        const interactive = el.querySelectorAll('button, [role="menuitem"], [role="option"], li, [class*="dropdown-list-item"], [class*="__item"], input').length;
        const txt = (el.textContent || '').trim().length;
        if (!looksMenu && interactive < 2 && txt < 12) continue;
        let score = 0;
        if (looksMenu) score += 150;
        score += Math.min(interactive * 5, 150);
        score += Math.min(txt / 30, 50);
        score -= Math.min(a / VIEWPORT * 50, 50);
        if (score > bestScore) { bestScore = score; bestEl = el; }
      }
    }
    if (bestEl) { bestEl.setAttribute(STAMP, '1'); return true; }
    return false;
  }).catch(() => false);
  if (ok) return page.locator('[data-oracle-region="1"]').first();
  return null;
}

// Try clicking a trigger located by several strategies; returns true if click landed.
async function clickFirst(page: Page, locs: Locator[]): Promise<boolean> {
  for (const loc of locs) {
    try {
      const c = await loc.count();
      if (c > 0) {
        const el = loc.first();
        if (await el.isVisible().catch(() => false)) {
          await el.scrollIntoViewIfNeeded().catch(() => {});
          try { await el.click({ timeout: 3500 }); }
          catch { await el.click({ timeout: 3500, force: true }); }
          await page.waitForTimeout(1000);
          return true;
        }
      }
    } catch { /* next */ }
  }
  return false;
}

async function doMenu(page: Page, slug: string, trigger: string, locs: Locator[], notes: string, isCell = false, waitSel?: string) {
  log(`--- ${slug}`);
  // make sure nothing is lingering
  if (!(await overlayGone(page))) await escape(page);
  const clicked = await clickFirst(page, locs);
  if (!clicked) { record(slug, trigger, false, 'trigger not found/clickable'); log(`MISS ${slug}: no trigger`); await escape(page); return; }
  await page.waitForTimeout(900);
  let overlay = await findOpenOverlay(page);
  // retry: for cell pickers a single click may only focus the cell; click again then wait for the dropdown
  if (!overlay && isCell) {
    for (let attempt = 0; attempt < 2 && !overlay; attempt++) {
      await clickFirst(page, locs);
      if (waitSel) {
        await page.locator(waitSel).first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      }
      await page.waitForTimeout(800);
      overlay = await findOpenOverlay(page);
    }
  }
  const r = await saveState(page, { slug, trigger, notes, region: overlay });
  const items = extractMenuItems(r.regionHtml);
  record(slug, trigger, !!overlay || slug === 'task-panel', items || (overlay ? 'overlay captured (no parsed items)' : 'NO MENU OPENED (tooltip only?) — full page only'));
  await escape(page);
}

function extractMenuItems(html: string): string {
  if (!html) return '';
  // crude text extraction of dropdown list items
  const texts: string[] = [];
  const re = />([^<>]{1,40})</g; let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html))) {
    const t = m[1].trim();
    if (t && !/^\s*$/.test(t) && t.length > 1 && !seen.has(t) && !/^[{}\[\];:.,]+$/.test(t)) {
      seen.add(t); texts.push(t);
    }
  }
  return texts.slice(0, 40).join(' | ');
}

async function countTaskRows(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const sels = ['.cu-task-row-main', '.cu-task-row', '[data-test^="task-row"]', '.cu-list-row'];
    let max = 0;
    for (const s of sels) { const n = document.querySelectorAll(s).length; if (n > max) max = n; }
    return max;
  }).catch(() => 0);
}

async function main() {
  ensureDir(STATES);
  log('launching persistent context');
  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
      channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  } catch (e) { console.error('PROFILE_LOCK_OR_LAUNCH_FAIL: ' + String(e)); process.exit(2); }

  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Find a populated list
  let listUrl = ''; let rows = 0;
  for (const u of CANDIDATE_LISTS) {
    log('trying list', u);
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) { log('nav fail', u, String(e)); continue; }
    await page.waitForTimeout(7000);
    const cur = page.url();
    if (/login|signin|\/clickup-login/i.test(cur)) {
      console.error('AUTH_EXPIRED at ' + cur); fs.writeFileSync(path.join(OUT, 'AUTH_FAIL.txt'), cur);
      await ctx.close(); process.exit(3);
    }
    // ensure List layout (not board). Try waiting for rows.
    await page.waitForTimeout(2000);
    rows = await countTaskRows(page);
    log('  rows=', rows, 'url=', cur);
    if (rows >= 3) { listUrl = cur; break; }
  }

  if (!listUrl) {
    log('No populated list found; using last candidate anyway for best-effort');
    listUrl = page.url();
  }
  log('USING LIST', listUrl, 'rows', rows);
  ensureDir(path.join(OUT, '_debug'));
  await page.screenshot({ path: path.join(OUT, '_debug', 'list-base.png') }).catch(() => {});
  fs.writeFileSync(path.join(OUT, '_debug', 'list-base.html'), await page.content());

  const L = (sel: string) => page.locator(sel);
  const byText = (re: RegExp) => page.getByText(re);
  const byLabel = (name: string | RegExp) => page.getByLabel(name, { exact: true });
  const byRole = (role: any, name: string | RegExp) => page.getByRole(role, { name });

  // ===== TOOLBAR MENUS =====
  await doMenu(page, 'toolbar-groupby', 'Group toolbar control',
    [byLabel('Group'), L('[data-test="view-grouping-toggle"]'), L('[data-test="view-grouping-settings__toggle"]'),
     byRole('button', /^Group/i)],
    'Toolbar grouping options menu');

  await doMenu(page, 'toolbar-columns', 'Columns toolbar control',
    [byLabel('Columns'), byRole('button', /^Columns$/)],
    'Column visibility / custom field column menu');

  await doMenu(page, 'toolbar-filter', 'Filter toolbar control',
    [byLabel('Filter'), byRole('button', /^Filter$/)],
    'Filter builder');

  await doMenu(page, 'toolbar-customize', 'Customize',
    [L('[data-test="cu2-views-bar__controller-button__Customize"]'), byRole('button', /Customize/i)],
    'Customize view menu');

  await doMenu(page, 'toolbar-addtask-caret', 'Add Task split caret',
    [L('[data-test="create-task-menu__add-dropdown"]'), L('[data-test="create-task-menu__new-task-button"] + *'),
     L('[data-test*="add-dropdown"]')],
    'Add Task dropdown (task type options)');

  await doMenu(page, 'toolbar-subtasks', 'Subtasks toolbar control',
    [byLabel('Subtasks'), byRole('button', /^Subtasks$/)],
    'Subtasks display options');

  await doMenu(page, 'toolbar-assignee', 'Assignee toolbar control',
    [byLabel('Assignee'), L('[data-test="view-assignee-filter-toggle"]'), byRole('button', /^Assignee$/)],
    'Assignee filter / me-mode toolbar control');

  // ===== CELL PICKERS =====
  await doMenu(page, 'cell-status', 'Row status pill',
    [L('[data-test="task-row-status__dropdown-toggle"]').first(),
     L('[data-test^="task-row-status__badge"]').first(),
     L('[data-test^="task-row-status__"]').first()],
    'Status options dropdown with colors', true);

  await doMenu(page, 'cell-priority', 'Row priority cell',
    [L('[data-test="task-row__priority-placeholder"]').first(),
     L('[data-test*="priority"]').first()],
    'Priority menu Urgent/High/Normal/Low/Clear', true,
    '[data-test="priorities-list__dropdown"], .cu-priority-list-dropdown-customizations, .cu-priorities-view__item');

  await doMenu(page, 'cell-assignee', 'Row assignee cell',
    [L('[data-test="task-row__assignee-placeholder"]').first(),
     L('[data-test*="assignee"]').filter({ hasNot: page.locator('[data-test*="header"]') }).first()],
    'Member picker', true,
    '[data-test*="assignee-picker"], .cu-assignees-dropdown, [data-test*="combo-box__search-input"]');

  await doMenu(page, 'cell-duedate', 'Row due date cell',
    [L('[data-test="task-row__recurring-date-picker-placeholder"]').first(),
     L('[data-test*="recurring-date-picker"]').first()],
    'Date picker / calendar', true,
    '[data-test="recurring-date-dropdown__dropdown"], .cu-calendar, .cu-date-picker');

  // ===== HEADER / ROW =====
  await doMenu(page, 'col-addcolumn', 'Add column +',
    [L('[data-test="task-list-header-settings__add-column-in-list"]'),
     L('[data-test*="add-column"]'), byLabel('Add Column')],
    'Add column / custom field menu');

  // row kebab: hover a row, then click its ... menu
  log('--- row-kebab');
  try {
    const row = page.locator('[data-test="task-row-main"]').first();
    if (await row.count() > 0) { await row.hover().catch(() => {}); await page.waitForTimeout(700); }
  } catch { /* */ }
  await doMenu(page, 'row-kebab', 'Row ... context menu',
    [L('[data-test*="task-row__ellipsis"]').first(), L('[data-test*="row-context"]').first(),
     L('[data-test="task-row-main"]').first().locator('[class*="ellipsis"], button[aria-label*="ettings"], [data-test*="more"]').first()],
    'Row context menu (full item list)');
  // fallback: right-click the row for the native context menu
  if (!results.find((r) => r.slug === 'row-kebab')?.captured) {
    try {
      await page.locator('[data-test="task-row-main"]').first().click({ button: 'right' });
      await page.waitForTimeout(900);
      const ov = await findOpenOverlay(page);
      if (ov) {
        const rr = await saveState(page, { slug: 'row-kebab', trigger: 'Row right-click', notes: 'Row context menu (right-click)', region: ov });
        const idx = results.findIndex((r) => r.slug === 'row-kebab');
        const c = extractMenuItems(rr.regionHtml);
        if (idx >= 0) results[idx] = { slug: 'row-kebab', trigger: 'Row right-click', captured: true, contains: c };
        await escape(page);
      }
    } catch (e) { log('row right-click fail', String(e)); }
  }

  // group menu (hover the group header first so the options button appears)
  log('--- group-menu (pre-hover)');
  try {
    const gh = page.locator('[data-test="task-list-header__task-group-and-count"], [data-test^="task-list-header"]').first();
    if (await gh.count() > 0) { await gh.hover().catch(() => {}); await page.waitForTimeout(600); }
  } catch { /* */ }
  await doMenu(page, 'group-menu', 'Group header ... menu',
    [L('[data-test="task-list-header__group-options-button"]').first(),
     L('[data-test*="group-options"]').first()],
    'Group context menu');

  // ===== TASK DETAIL PANEL =====
  log('--- task-panel');
  // ensure a clean list state (dismiss any sticky overlay)
  await escape(page);
  if (!(await overlayGone(page))) {
    log('overlay still up before panel; reloading list');
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }
  let panelClicked = false;
  try {
    const nameLocs = [
      page.locator('[data-test="task-row-main__link"]').first(),
      page.locator('[data-test^="task-row-main__link-text__"]').first(),
      page.locator('[data-test="task-row-main"]').first(),
    ];
    for (const nl of nameLocs) {
      if (await nl.count() > 0 && await nl.isVisible().catch(() => false)) {
        try { await nl.click({ timeout: 5000 }); } catch { await nl.click({ timeout: 5000, force: true }); }
        panelClicked = true; break;
      }
    }
  } catch (e) { log('panel click fail', String(e)); }
  if (panelClicked) {
    await page.waitForTimeout(3500);
    const panel = await (async () => {
      const sels = ['[data-test*="task-view"]', '.cu-task-view-content', '.cu-task-view', '[class*="task-view"]', '[role="dialog"]', '.cdk-overlay-pane'];
      for (const s of sels) {
        const loc = page.locator(s);
        if (await loc.count() > 0 && await loc.first().isVisible().catch(() => false)) {
          const box = await loc.first().boundingBox().catch(() => null);
          if (box && box.width > 300) return loc.first();
        }
      }
      return null;
    })();
    const r = await saveState(page, { slug: 'task-panel', trigger: 'Click task name', notes: 'Full task detail panel', region: panel });
    record('task-panel', 'Click task name', true, `url=${page.url()} ; ${extractMenuItems(r.regionHtml).slice(0, 600)}`);
    await escape(page);
  } else {
    record('task-panel', 'Click task name', false, 'could not click a task name');
  }

  // ===== SUMMARY =====
  let md = '# ClickUp List-view Interaction Oracles — 2026-06-01\n\n';
  md += `List used: ${listUrl} (rows detected: ${rows})\n\n`;
  md += '| slug | trigger | captured | contains |\n|---|---|---|---|\n';
  for (const r of results) {
    md += `| ${r.slug} | ${r.trigger} | ${r.captured ? 'Y' : 'N'} | ${(r.contains || '').replace(/\|/g, '/').slice(0, 400)} |\n`;
  }
  fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), md);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ listUrl, rows, results }, null, 2));
  log('SUMMARY written');

  await ctx.close();
  log('done');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
