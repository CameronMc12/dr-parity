import { chromium, type BrowserContext, type Page, type Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUT = '/Users/cameronmcallister/Github/dr-parity/docs/research/crawl/app.clickup.com/2026-06-01-home-deep';
const STATES = path.join(OUT, 'states');
const BASE = 'https://app.clickup.com/90152566819/home';
const CAPTURED_AT = '2026-06-01';

function ensure(dir: string) { fs.mkdirSync(dir, { recursive: true }); }

async function settle(page: Page, ms = 1500) {
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(ms);
}

interface Meta {
  slug: string;
  kind: 'page' | 'menu' | 'dropdown' | 'hover';
  trigger: string;
  finalUrl?: string;
  capturedAt?: string;
  notes: string;
}

async function captureState(page: Page, meta: Meta) {
  const dir = path.join(STATES, meta.slug);
  ensure(dir);
  try { await page.screenshot({ path: path.join(dir, 'screenshot.png') }); }
  catch (e) { fs.writeFileSync(path.join(dir, 'screenshot.error.txt'), String(e)); }
  try { fs.writeFileSync(path.join(dir, 'dom.html'), await page.content()); }
  catch (e) { fs.writeFileSync(path.join(dir, 'dom.error.txt'), String(e)); }
  try { fs.writeFileSync(path.join(dir, 'aria.txt'), await page.locator('body').ariaSnapshot()); }
  catch (e) { fs.writeFileSync(path.join(dir, 'aria.error.txt'), String(e)); }
  meta.finalUrl = page.url();
  meta.capturedAt = CAPTURED_AT;
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`[page] ${meta.slug} -> ${meta.finalUrl}`);
}

async function findMenuRegion(page: Page): Promise<Locator | null> {
  const selectors = [
    '.cdk-overlay-pane',
    '[role="menu"]',
    '[role="listbox"]',
    '.cu-dropdown',
    '.cu-context-menu',
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).last();
      if ((await loc.count()) && (await loc.isVisible())) return loc;
    } catch {}
  }
  return null;
}

async function captureMenu(page: Page, slug: string, trigger: string, notes: string) {
  const dir = path.join(STATES, slug);
  ensure(dir);
  try { await page.screenshot({ path: path.join(dir, 'screenshot.png') }); } catch {}
  const region = await findMenuRegion(page);
  try {
    if (region) {
      try { await region.screenshot({ path: path.join(dir, 'region.png') }); } catch {}
      const outer = await region.evaluate((el) => (el as HTMLElement).outerHTML);
      fs.writeFileSync(path.join(dir, 'region.html'), outer);
      fs.writeFileSync(path.join(dir, 'aria.txt'), await region.ariaSnapshot());
    } else {
      fs.writeFileSync(path.join(dir, 'region.missing.txt'), 'no floating overlay matched');
      fs.writeFileSync(path.join(dir, 'aria.txt'), await page.locator('body').ariaSnapshot());
    }
  } catch (e) { fs.writeFileSync(path.join(dir, 'region.error.txt'), String(e)); }
  try { fs.writeFileSync(path.join(dir, 'dom.html'), await page.content()); } catch {}
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    slug, kind: 'menu', trigger, finalUrl: page.url(), capturedAt: CAPTURED_AT,
    notes: notes + (region ? '' : ' [WARN: no overlay captured]'),
  }, null, 2));
  console.log(`[menu] ${slug} region=${region ? 'yes' : 'NO'}`);
}

async function escape(page: Page) {
  try { await page.keyboard.press('Escape'); } catch {}
  await page.waitForTimeout(400);
  try { await page.keyboard.press('Escape'); } catch {}
  await page.waitForTimeout(300);
}

async function goHome(page: Page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
}

// Sidebar tree root within main content
function tree(page: Page) { return page.locator('main [role="tree"]').first(); }

async function clickTreeItem(page: Page, name: string): Promise<boolean> {
  const item = page.locator(`main [role="treeitem"]`, { hasText: name }).first();
  if (!(await item.count())) { console.log(`  ! treeitem not found: ${name}`); return false; }
  const link = item.locator('a').first();
  try {
    if (await link.count()) await link.click({ timeout: 8000 });
    else await item.click({ timeout: 8000 });
    return true;
  } catch (e) { console.log(`  ! click failed ${name}: ${String(e).slice(0,80)}`); return false; }
}

async function main() {
  const phase = process.argv[2] || 'all';
  ensure(STATES);
  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
      channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  } catch (e) { console.error('PROFILE_LOCK_OR_LAUNCH_FAIL:', String(e)); process.exit(2); }

  const page = ctx.pages()[0] || await ctx.newPage();
  await goHome(page);

  const run = (p: string) => phase === 'all' || phase === p;

  // ====== A. HOME MAIN ======
  if (run('a')) {
    await captureState(page, { slug: 'home-main', kind: 'page', trigger: 'goto /home', notes: 'Home/My Work main dashboard, redirects to /my-work' });

    // Home header in secondary sidebar: the "Create" button (+) and a caret/dropdown
    // From aria: main has button "Create" and a "Dropdown menu" near My Tasks/Manage cards.
    // The Home header row = first row of tree. Plus button:
    const createBtn = page.locator('main button', { hasText: /^Create$/ }).first();
    if (await createBtn.count()) {
      try { await createBtn.click({ timeout: 5000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'home-header-plus', 'click main "Create" (+) button', 'Home header + create menu'); }
      catch (e) { console.log('home-header-plus fail', String(e).slice(0,80)); }
      await escape(page);
    }
    // Manage cards dropdown (the ▾ on My Work header)
    const manage = page.locator('main button', { hasText: /Manage cards/ }).first();
    if (await manage.count()) {
      try { await manage.click({ timeout: 5000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'home-header-caret', 'click "Manage cards" dropdown on My Work header', 'Home/My Work header ▾ menu'); }
      catch (e) { console.log('home-header-caret fail', String(e).slice(0,80)); }
      await escape(page);
    }
  }

  // ====== B. SIDEBAR ITEMS -> PAGES ======
  if (run('b')) {
    const items: Array<[string, string]> = [
      ['Inbox', 'page-inbox'],
      ['Replies', 'page-replies'],
      ['Assigned Comments', 'page-assigned-comments'],
      ['My Tasks', 'page-my-tasks'],
    ];
    for (const [name, slug] of items) {
      await goHome(page);
      if (await clickTreeItem(page, name)) {
        await settle(page, 2000);
        await captureState(page, { slug, kind: 'page', trigger: `click sidebar "${name}"`, notes: `Home sidebar item ${name}` });
      }
    }

    // "More" opens a menu
    await goHome(page);
    const moreBtn = page.locator('main [role="treeitem"] button', { hasText: /^More$/ }).first();
    if (await moreBtn.count()) {
      try { await moreBtn.click({ timeout: 5000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'menu-sidebar-more', 'click "More" in Home sidebar', 'Hidden sidebar items menu'); }
      catch (e) { console.log('more fail', String(e).slice(0,80)); }
      await escape(page);
    }

    // A Channel -> channel page (first channel under Channels). Expand Channels first.
    await goHome(page);
    const channelsHdr = page.locator('main [role="treeitem"]', { hasText: 'Channels' }).first();
    if (await channelsHdr.count()) {
      try { await channelsHdr.locator('button', { hasText: 'Channels' }).first().click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(900);
      // pick a channel link (a chat link not the header)
      const chLink = page.locator('main [role="treeitem"] a[href*="/chat/"]').filter({ hasNotText: 'Replies' }).first();
      if (await chLink.count()) {
        const nm = (await chLink.innerText().catch(() => '')) || 'channel';
        try { await chLink.click({ timeout: 6000 }); await settle(page, 2000);
          await captureState(page, { slug: 'page-channel-ab', kind: 'page', trigger: 'click a Channel row', notes: `Chat channel page (${nm})` }); }
        catch (e) { console.log('channel fail', String(e).slice(0,80)); }
      } else console.log('  ! no channel link found');
    }

    // Add Channel (+ on Channels) -> create menu, ESCAPE
    await goHome(page);
    const chHdr2 = page.locator('main [role="treeitem"]', { hasText: 'Channels' }).first();
    if (await chHdr2.count()) {
      const plus = chHdr2.locator('button').nth(1); // header has [label button, +, ...]
      try { await plus.click({ timeout: 4000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'menu-add-channel', 'click + on Channels section', 'Create/add channel menu — DO NOT create'); }
      catch (e) { console.log('add-channel fail', String(e).slice(0,80)); }
      await escape(page);
    }

    // A Direct Message conversation
    await goHome(page);
    const dmHdr = page.locator('main [role="treeitem"]', { hasText: 'Direct Messages' }).first();
    if (await dmHdr.count()) {
      try { await dmHdr.locator('button', { hasText: 'Direct Messages' }).first().click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(900);
      const dmLink = page.locator('main [role="treeitem"] a[href*="/chat/"]').last();
      if (await dmLink.count()) {
        try { await dmLink.click({ timeout: 6000 }); await settle(page, 2000);
          await captureState(page, { slug: 'page-dm', kind: 'page', trigger: 'click a Direct Message row', notes: 'DM conversation page' }); }
        catch (e) { console.log('dm fail', String(e).slice(0,80)); }
      } else console.log('  ! no DM link found');
    }

    // Spaces rows -> landing pages
    const spaces: Array<[string, string]> = [
      ['All Tasks', 'page-space-all-tasks'],
      ['Team Space', 'page-space-team-space'],
      ['Software Development', 'page-space-software-development'],
      ['New Space', 'page-space-new-space'],
    ];
    for (const [name, slug] of spaces) {
      await goHome(page);
      const sp = page.locator('main [role="treeitem"]', { hasText: name }).first();
      if (!(await sp.count())) { console.log(`  ! space row not found ${name}`); continue; }
      const link = sp.locator('a').first();
      try {
        if (await link.count()) await link.click({ timeout: 6000 });
        else await sp.click({ timeout: 6000 });
        await settle(page, 2000);
        await captureState(page, { slug, kind: 'page', trigger: `click Space "${name}"`, notes: `Space landing page ${name}` });
      } catch (e) { console.log(`  ! space ${name} fail`, String(e).slice(0,80)); }
    }
  }

  // ====== C. PLUS BUTTONS / SECTION MENUS / ROW CONTEXT MENUS ======
  if (run('c')) {
    // Section + buttons: Favorites, Channels, Direct Messages, Spaces
    const sections: Array<[string, string]> = [
      ['Favorites', 'menu-favorites-plus'],
      ['Channels', 'menu-channels-plus'],
      ['Direct Messages', 'menu-direct-messages-plus'],
      ['Spaces', 'menu-spaces-plus'],
    ];
    for (const [name, slug] of sections) {
      await goHome(page);
      const row = page.locator('main [role="treeitem"]', { hasText: name }).first();
      if (!(await row.count())) { console.log(`  ! section ${name} not found`); continue; }
      await row.hover().catch(() => {});
      await page.waitForTimeout(300);
      // The + button: try aria-label add/create, else a button after the label
      let plus = row.locator('button[aria-label*="dd" i], button[aria-label*="reate" i], button[aria-label*="ew" i]').first();
      if (!(await plus.count())) plus = row.locator('button').nth(1);
      try { await plus.click({ timeout: 4000 }); await page.waitForTimeout(900);
        await captureMenu(page, slug, `click + on ${name} section`, `${name} section create/add menu`); }
      catch (e) { console.log(`  ! ${slug} fail`, String(e).slice(0,80)); }
      await escape(page);
    }

    // Section header ▾ / settings (Spaces settings, Favorites Dropdown menu)
    await goHome(page);
    const favCaret = page.locator('main [role="treeitem"]', { hasText: 'Favorites' }).first()
      .locator('button[aria-label="Dropdown menu"], button').last();
    if (await favCaret.count()) {
      try { await favCaret.click({ timeout: 4000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'menu-favorites-caret', 'click ▾ on Favorites section', 'Favorites section options menu'); }
      catch (e) { console.log('fav caret fail', String(e).slice(0,80)); }
      await escape(page);
    }
    await goHome(page);
    const spSettings = page.locator('main button[aria-label="Spaces settings"]').first();
    if (await spSettings.count()) {
      try { await spSettings.click({ timeout: 4000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'menu-spaces-settings', 'click Spaces settings ▾', 'Spaces section settings menu'); }
      catch (e) { console.log('spaces settings fail', String(e).slice(0,80)); }
      await escape(page);
    }

    // Row-level kebab context menus: My Tasks row, a Space row, a List row, a Channel row
    // My Tasks row
    await goHome(page);
    await captureRowKebab(page, page.locator('main [role="treeitem"]', { hasText: 'My Tasks' }).first(),
      'menu-row-my-tasks', 'My Tasks row');
    // Space row (Team Space)
    await goHome(page);
    await captureRowKebab(page, page.locator('main [role="treeitem"]', { hasText: 'Team Space' }).first(),
      'menu-row-space', 'Team Space row');
    // Channel row
    await goHome(page);
    {
      const chHdr = page.locator('main [role="treeitem"]', { hasText: 'Channels' }).first();
      try { await chHdr.locator('button', { hasText: 'Channels' }).first().click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(800);
      const chRow = page.locator('main [role="treeitem"] a[href*="/chat/"]').first()
        .locator('xpath=ancestor::*[@role="treeitem"][1]');
      await captureRowKebab(page, chRow, 'menu-row-channel', 'Channel row');
    }
    // List row: open a Space that has lists. Software Development space, expand it.
    await goHome(page);
    {
      const sp = page.locator('main [role="treeitem"]', { hasText: 'Software Development' }).first();
      // click expand arrow (first button in the row) to reveal nested lists
      try {
        const arrow = sp.locator('button').first();
        await arrow.click({ timeout: 4000 });
      } catch {}
      await page.waitForTimeout(1200);
      // a List row = treeitem level 3+ with an a[href*="/v/li/"] or /v/l/
      const listRow = page.locator('main [role="treeitem"] a[href*="/v/li/"], main [role="treeitem"] a[href*="/v/l/"]').first()
        .locator('xpath=ancestor::*[@role="treeitem"][1]');
      if (await listRow.count()) {
        await captureRowKebab(page, listRow, 'menu-row-list', 'List row inside Software Development space');
      } else {
        console.log('  ! no list row found to kebab');
      }
    }

    // Top-bar + create / quick-create
    await goHome(page);
    const topCreate = page.locator('button[aria-label="Create task"], button:has-text("Create task")').first();
    if (await topCreate.count()) {
      try { await topCreate.click({ timeout: 4000 }); await page.waitForTimeout(900);
        await captureMenu(page, 'menu-topbar-create', 'click top-bar Create task / quick-create', 'Top bar quick create menu — DO NOT submit'); }
      catch (e) { console.log('topbar create fail', String(e).slice(0,80)); }
      await escape(page);
    }
  }

  await page.waitForTimeout(500);
  await ctx.close();
  console.log('DONE phase=' + phase);
}

async function captureRowKebab(page: Page, row: Locator, slug: string, label: string) {
  if (!(await row.count())) { console.log(`  ! ${slug}: row not found`); return; }
  try { await row.scrollIntoViewIfNeeded({ timeout: 4000 }); } catch {}
  await row.hover().catch(() => {});
  await page.waitForTimeout(500);
  // kebab: aria-label containing "ellipsis"/"more"/"settings"/"Dropdown menu" or a button at the end
  const candidates = [
    'button[aria-label*="llipsis" i]',
    'button[aria-label*="ettings" i]',
    'button[aria-label*="ore options" i]',
    'button[aria-label="Dropdown menu"]',
    'button[aria-label*="ore" i]',
  ];
  let kebab: Locator | null = null;
  for (const sel of candidates) {
    const l = row.locator(sel).first();
    if ((await l.count()) && (await l.isVisible().catch(() => false))) { kebab = l; break; }
  }
  if (!kebab) {
    // fall back to last visible button in row
    const btns = row.locator('button');
    const n = await btns.count();
    for (let i = n - 1; i >= 0; i--) {
      const b = btns.nth(i);
      if (await b.isVisible().catch(() => false)) { kebab = b; break; }
    }
  }
  if (!kebab) { console.log(`  ! ${slug}: no kebab button`); return; }
  try {
    await kebab.click({ timeout: 4000 });
    await page.waitForTimeout(900);
    await captureMenu(page, slug, `hover ${label} -> click kebab ⋯`, `Row context menu for ${label}`);
  } catch (e) { console.log(`  ! ${slug} kebab click fail`, String(e).slice(0,80)); }
  await escape(page);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
