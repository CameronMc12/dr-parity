import { chromium, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';

const ROOT = '/Users/cameronmcallister/Github/dr-parity/docs/research/crawl/app.clickup.com/2026-06-01-home-deep';
const STATES = ROOT + '/states';
const BASE = 'https://app.clickup.com/90152566819/home';
const WS = 'https://app.clickup.com/90152566819';
const captured: any[] = [];

function dir(slug: string) { const d = STATES + '/' + slug; fs.mkdirSync(d, { recursive: true }); return d; }

async function settle(page: Page, ms = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function aria(page: Page, sel?: string): Promise<string> {
  try {
    if (sel) {
      const loc = page.locator(sel).first();
      if (await loc.count()) return await loc.ariaSnapshot();
    }
    return await page.locator('body').ariaSnapshot();
  } catch { return ''; }
}

// Capture a full PAGE state
async function capPage(page: Page, slug: string, trigger: string, notes = '') {
  const d = dir(slug);
  await page.screenshot({ path: d + '/screenshot.png' }).catch(() => {});
  const html = await page.content().catch(() => '');
  fs.writeFileSync(d + '/dom.html', html);
  fs.writeFileSync(d + '/aria.txt', await aria(page));
  const meta = { slug, kind: 'page', trigger, finalUrl: page.url(), capturedAt: '2026-06-01', notes };
  fs.writeFileSync(d + '/meta.json', JSON.stringify(meta, null, 2));
  captured.push({ slug, kind: 'page', url: page.url(), notes });
  console.log(`[page] ${slug} -> ${page.url()}`);
}

// Find the currently-open floating menu/overlay element and capture region + items
async function captureOpenMenu(page: Page, slug: string, kind: string, trigger: string, notes = '') {
  const d = dir(slug);
  await page.screenshot({ path: d + '/screenshot.png' }).catch(() => {});
  fs.writeFileSync(d + '/dom.html', await page.content().catch(() => ''));

  // Identify the overlay: CDK overlay panes or visible role=menu/listbox/dialog
  const info = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll(
      '.cdk-overlay-pane, [role="menu"], [role="listbox"], [role="dialog"], .cu-dropdown, .cu2-context-menu, .cu-context-menu, [data-test*="menu"]'
    )) as HTMLElement[];
    let best: HTMLElement | null = null; let bestArea = 0;
    for (const c of cands) {
      const r = c.getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      const style = getComputedStyle(c);
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
      const area = r.width * r.height;
      // prefer smaller floating menus over giant overlays, but skip backdrops
      if (area > bestArea && area < 1440 * 900 * 0.9) { bestArea = area; best = c; }
    }
    if (!best) return { found: false, items: [] as string[], rect: null, html: '' };
    const r = best.getBoundingClientRect();
    const itemEls = Array.from(best.querySelectorAll('[role="menuitem"], [role="option"], a, button, .cu-dropdown-item, li'));
    const items: string[] = [];
    for (const it of itemEls) {
      const t = (it.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 80 && !items.includes(t)) items.push(t);
    }
    return {
      found: true,
      items,
      rect: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, 1440), height: Math.min(r.height, 900) },
      html: best.outerHTML,
    };
  });

  if (info.found && info.rect) {
    fs.writeFileSync(d + '/region.html', info.html);
    await page.screenshot({ path: d + '/region.png', clip: info.rect }).catch(() => {});
    fs.writeFileSync(d + '/aria.txt', await aria(page));
  } else {
    fs.writeFileSync(d + '/aria.txt', await aria(page));
  }
  const meta = { slug, kind, trigger, finalUrl: page.url(), capturedAt: '2026-06-01', notes, items: info.items, menuFound: info.found };
  fs.writeFileSync(d + '/meta.json', JSON.stringify(meta, null, 2));
  captured.push({ slug, kind, url: page.url(), items: info.items, found: info.found, notes });
  console.log(`[${kind}] ${slug} found=${info.found} items=${info.items.length} :: ${info.items.slice(0, 8).join(' | ')}`);
}

async function esc(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  // click neutral area to be safe
  await page.mouse.click(720, 12).catch(() => {});
  await page.waitForTimeout(200);
}

async function goHome(page: Page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
}

// click a sidebar item by its exact text + optional href filter, capture resulting page
async function clickRowByText(page: Page, text: string, hrefIncludes?: string): Promise<boolean> {
  const handle = await page.evaluateHandle(({ text, hrefIncludes }) => {
    const els = Array.from(document.querySelectorAll('a, button, [role="treeitem"], cdk-tree-node')) as HTMLElement[];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.x > 380 || r.width < 4) continue;
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t === text || t.startsWith(text)) {
        if (hrefIncludes) {
          const a = el.tagName === 'A' ? el : el.querySelector('a');
          if (a && (a as HTMLAnchorElement).href.includes(hrefIncludes)) return el;
        } else return el;
      }
    }
    return null;
  }, { text, hrefIncludes });
  const el = handle.asElement();
  if (!el) return false;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ timeout: 5000 }).catch(() => {});
  return true;
}

async function main() {
  const ctx: BrowserContext = await chromium.launchPersistentContext('/Users/cameronmcallister/.config/playwright-clickup', {
    channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // ===== A. HOME MAIN =====
  await goHome(page);
  await capPage(page, 'home-main', 'nav /home (redirects /my-work)', 'Main My Work dashboard');

  // Home header + button (sidebar-header__create-icon) and create menu button
  // The "Create" button(s) at top of sidebar
  for (const [slug, sel, kind] of [
    ['home-header-plus', '[data-test*="sidebar-header__create"]', 'menu'],
    ['home-header-caret', '[data-test*="collapsed-sidebar__toggle"]', 'menu'],
  ] as const) {
    await goHome(page);
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      await loc.click().catch(() => {});
      await page.waitForTimeout(900);
      await captureOpenMenu(page, slug, kind, `click ${sel}`);
      await esc(page);
    } else {
      console.log(`SKIP ${slug}: selector ${sel} not found`);
      captured.push({ slug, kind, found: false, notes: 'trigger not found' });
    }
  }

  // ===== B. SIDEBAR ITEMS -> PAGES =====
  const navItems: Array<[string, string, string]> = [
    // slug, text, hrefIncludes
    ['page-inbox', 'Inbox', '/inbox'],
    ['page-replies', 'Replies', '/chat/r/threads'],
    ['page-assigned-comments', 'Assigned Comments', '/chat/r/assigned'],
    ['page-my-tasks', 'My Tasks', '/my-work'],
    ['page-assigned-to-me', 'Assigned to me', '/my-work/tasks'],
    ['page-today-overdue', 'Today & Overdue', '/my-work/today'],
    ['page-personal-list', 'Personal List', '/v/li/'],
    ['page-channel-ab', 'AB Content Management', '/v/cn/'],
    ['page-dm', 'Onboarding Assistant', '/chat/r/2kyr6013-495'],
    ['page-space-all-tasks', "All Tasks - Cameron Mc's Workspace", '/v/l/t/'],
    ['page-space-team-space', 'Team Space', '/v/s/901511060743'],
    ['page-space-software-development', 'Software Development', '/v/s/901511060890'],
    ['page-space-new-space', 'New Space', ''],
  ];
  for (const [slug, text, href] of navItems) {
    await goHome(page);
    const ok = await clickRowByText(page, text, href || undefined);
    if (!ok) { console.log(`SKIP ${slug}: row "${text}" not found`); captured.push({ slug, kind: 'page', found: false, notes: 'row not found' }); continue; }
    await settle(page, 2200);
    await capPage(page, slug, `click sidebar "${text}"`);
  }

  // "More" under My Tasks -> opens a menu
  await goHome(page);
  {
    const ok = await clickRowByText(page, 'More');
    if (ok) { await page.waitForTimeout(900); await captureOpenMenu(page, 'menu-my-tasks-more', 'menu', 'click My Tasks "More"'); await esc(page); }
    else captured.push({ slug: 'menu-my-tasks-more', kind: 'menu', found: false });
  }

  // ===== C. SECTION + BUTTONS / CREATE MENUS =====
  const plusButtons: Array<[string, string]> = [
    ['menu-favorites-plus', 'Favorites'],          // dropdown menu next to Favorites
    ['menu-channels-plus', 'Channels'],
    ['menu-direct-messages-plus', 'Direct Messages'],
    ['menu-spaces-plus', 'Spaces'],
  ];
  // The add buttons are 20px-wide buttons right after the section header text.
  for (const [slug, section] of plusButtons) {
    await goHome(page);
    // hover the section header row to reveal add button, then click the small add button on that row
    const clicked = await page.evaluate((section) => {
      const nodes = Array.from(document.querySelectorAll('cdk-tree-node, [role="treeitem"]')) as HTMLElement[];
      for (const n of nodes) {
        const t = (n.textContent || '').trim();
        if (t.startsWith(section)) {
          // find small add/create button inside
          const btns = Array.from(n.querySelectorAll('button')) as HTMLElement[];
          const add = btns.find(b => {
            const dt = b.getAttribute('data-test') || '';
            const al = b.getAttribute('aria-label') || '';
            return /create|add/.test(dt) || /add|create/i.test(al);
          }) || btns[btns.length - 1];
          if (add) { (add as HTMLElement).scrollIntoView(); add.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); (add as HTMLButtonElement).click(); return true; }
        }
      }
      return false;
    }, section);
    if (clicked) { await page.waitForTimeout(1000); await captureOpenMenu(page, slug, 'menu', `click ${section} section + button`); await esc(page); }
    else { console.log(`SKIP ${slug}`); captured.push({ slug, kind: 'menu', found: false }); }
  }

  // Favorites dropdown / Spaces settings ellipsis (▾ / ⋯)
  const sectionMenus: Array<[string, string, RegExp]> = [
    ['menu-favorites-caret', 'Favorites', /dropdown|menu/i],
    ['menu-spaces-settings', 'Spaces', /spaces-menu__ellipsis|settings/i],
  ];
  for (const [slug, section, rx] of sectionMenus) {
    await goHome(page);
    const clicked = await page.evaluate(({ section, rxs }) => {
      const rx = new RegExp(rxs, 'i');
      const nodes = Array.from(document.querySelectorAll('cdk-tree-node, [role="treeitem"]')) as HTMLElement[];
      for (const n of nodes) {
        const t = (n.textContent || '').trim();
        if (t.startsWith(section)) {
          const btns = Array.from(n.querySelectorAll('button')) as HTMLElement[];
          const b = btns.find(x => rx.test((x.getAttribute('data-test') || '') + ' ' + (x.getAttribute('aria-label') || '')));
          if (b) { b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); b.click(); return true; }
        }
      }
      return false;
    }, { section, rxs: rx.source });
    if (clicked) { await page.waitForTimeout(900); await captureOpenMenu(page, slug, 'menu', `${section} section menu`); await esc(page); }
    else captured.push({ slug, kind: 'menu', found: false });
  }

  // ===== Add Channel (special item) =====
  await goHome(page);
  {
    const ok = await clickRowByText(page, 'Add Channel');
    if (ok) { await page.waitForTimeout(1200); await captureOpenMenu(page, 'menu-add-channel', 'menu', 'click Add Channel', 'Did NOT create — escaped'); await esc(page); await goHome(page); }
    else captured.push({ slug: 'menu-add-channel', kind: 'menu', found: false });
  }

  // ===== Row-level kebab context menus (hover row -> click kebab) =====
  const rowKebabs: Array<[string, string]> = [
    ['menu-row-mytask', 'Assigned to me'],     // a My Tasks nav row
    ['menu-row-space', 'Software Development'], // a Space row
    ['menu-row-list', 'Personal List'],        // a List row
    ['menu-row-channel', 'AB Content Management'], // a Channel row
  ];
  for (const [slug, rowText] of rowKebabs) {
    await goHome(page);
    const clicked = await page.evaluate((rowText) => {
      const nodes = Array.from(document.querySelectorAll('cdk-tree-node, [role="treeitem"]')) as HTMLElement[];
      for (const n of nodes) {
        const t = (n.textContent || '').trim();
        if (t.startsWith(rowText)) {
          n.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          n.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          // kebab: a small button revealed on hover — pick the last small button
          const btns = (Array.from(n.querySelectorAll('button')) as HTMLElement[]).filter(b => {
            const r = b.getBoundingClientRect(); return r.width > 0 && r.width < 36;
          });
          const kebab = btns.find(b => /ellipsis|more|settings|menu|dropdown/i.test((b.getAttribute('data-test') || '') + (b.getAttribute('aria-label') || ''))) || btns[btns.length - 1];
          if (kebab) { kebab.click(); return true; }
          return false;
        }
      }
      return false;
    }, rowText);
    if (clicked) { await page.waitForTimeout(900); await captureOpenMenu(page, slug, 'menu', `hover+kebab on "${rowText}"`); await esc(page); }
    else { console.log(`SKIP ${slug}`); captured.push({ slug, kind: 'menu', found: false }); }
  }

  // ===== Top-bar create (global +) =====
  await goHome(page);
  {
    const loc = page.locator('cu-sidebar-creation-menu-button, [data-test*="creation-menu"], [data-test*="sidebar-header__create"]').first();
    if (await loc.count()) { await loc.click().catch(() => {}); await page.waitForTimeout(1000); await captureOpenMenu(page, 'menu-topbar-create', 'menu', 'click global create (+)'); await esc(page); }
    else captured.push({ slug: 'menu-topbar-create', kind: 'menu', found: false });
  }

  fs.writeFileSync(ROOT + '/_crawl-results.json', JSON.stringify(captured, null, 2));
  await ctx.close();
  console.log('CRAWL DONE. states:', captured.length);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
