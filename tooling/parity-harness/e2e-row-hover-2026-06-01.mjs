import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./output/row-hover-2026-06-01', import.meta.url).pathname;
const LIST = 'http://localhost:4280/90152566819/v/l/901523542898';
mkdirSync(OUT, { recursive: true });

const results = [];
function log(name, ok, note = '') {
  results.push({ name, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${note}`);
}

const fatalPatterns = [/getServerSnapshot/i, /should be cached/i, /Maximum update depth/i, /infinite/i];
let fatalHit = false;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' && fatalPatterns.some((p) => p.test(m.text()))) fatalHit = true; });
page.on('pageerror', (e) => { if (fatalPatterns.some((p) => p.test(e.message || ''))) fatalHit = true; });

const firstRow = () => page.locator('[data-testid="list-task-row"]').first();
const sel = (t) => page.locator(`[data-testid="${t}"]`);

try {
  await page.goto(LIST, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="list-task-row"]', { timeout: 15000 });
  await page.waitForTimeout(400);

  // ── 1. Hover reveals all affordances ───────────────────────────────────────
  const row = firstRow();
  await row.hover();
  await page.waitForTimeout(150);

  const affordances = {
    'drag-handle': '[data-testid="row-drag-handle"]',
    checkbox: '[data-testid="row-select-checkbox"]',
    'subtask-chevron': '[data-testid="row-subtask-toggle"]',
    'quick-actions': '[data-testid="row-quick-actions"]',
    'add-subtask-btn': '[data-testid="row-action-add-subtask"]',
    'add-tag-btn': '[data-testid="row-action-add-tag"]',
    'rename-btn': '[data-testid="row-action-rename"]',
    kebab: '[data-testid="list-task-kebab"]',
  };
  for (const [name, q] of Object.entries(affordances)) {
    const el = row.locator(q).first();
    const visible = await el.isVisible().catch(() => false);
    const opacity = await el.evaluate((n) => getComputedStyle(n).opacity).catch(() => '0');
    log(`hover reveals ${name}`, visible && Number(opacity) > 0.5, `opacity=${opacity}`);
  }
  // header add-column
  log('header add-column visible', await sel('list-add-column').first().isVisible());

  await page.screenshot({ path: `${OUT}/01-row-hovered.png`, clip: { x: 0, y: 0, width: 1440, height: 260 } });
  await row.screenshot({ path: `${OUT}/02-row-only.png` });

  // ── 2. Add subtask ─────────────────────────────────────────────────────────
  const rowsBefore = await page.locator('[data-testid="list-task-row"]').count();
  const parentId = await row.getAttribute('data-task-id');
  await row.hover();
  await row.locator('[data-testid="row-action-add-subtask"]').click();
  await page.waitForTimeout(300);
  const rowsAfter = await page.locator('[data-testid="list-task-row"]').count();
  const subRow = page.locator(`[data-task-id="${parentId}"]`);
  log('add subtask adds a nested row', rowsAfter > rowsBefore, `${rowsBefore} -> ${rowsAfter}`);
  // nested subtask should have greater left padding than parent
  const padParent = await subRow.first().evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft));
  const allRows = page.locator('[data-testid="list-task-row"]');
  let nestedFound = false;
  for (let i = 0; i < (await allRows.count()); i++) {
    const r = allRows.nth(i);
    const pad = await r.evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft));
    const name = await r.locator('[data-testid="list-task-name"]').textContent().catch(() => '');
    if (pad > padParent + 10 && /subtask/i.test(name || '')) nestedFound = true;
  }
  log('subtask is indented under parent', nestedFound, `parentPad=${padParent}`);
  await page.screenshot({ path: `${OUT}/03-subtask-added.png`, clip: { x: 0, y: 0, width: 1440, height: 360 } });

  // ── 3. Add tag ─────────────────────────────────────────────────────────────
  await row.hover();
  await row.locator('[data-testid="row-action-add-tag"]').click();
  await page.waitForSelector('[data-testid="tag-picker-input"]', { timeout: 4000 });
  await sel('tag-picker-input').fill('urgent');
  await sel('tag-picker-add').click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const chips = await page.locator(`[data-task-id="${parentId}"] [data-testid="row-tag-chip"]`).count();
  log('add tag shows a chip on the row', chips >= 1, `chips=${chips}`);
  await page.screenshot({ path: `${OUT}/04-tag-added.png`, clip: { x: 0, y: 0, width: 1440, height: 360 } });

  // ── 4. Multi-select + bulk bar ─────────────────────────────────────────────
  const rowA = page.locator('[data-testid="list-task-row"]').nth(0);
  const rowB = page.locator('[data-testid="list-task-row"]').nth(1);
  await rowA.hover();
  await rowA.locator('[data-testid="row-select-checkbox"]').click();
  await rowB.hover();
  await rowB.locator('[data-testid="row-select-checkbox"]').click();
  await page.waitForTimeout(200);
  const barVisible = await sel('bulk-action-bar').isVisible().catch(() => false);
  const barCount = await sel('bulk-action-bar').locator('span').first().textContent().catch(() => '');
  log('bulk action bar shows with count', barVisible, `count text=${barCount}`);
  await page.screenshot({ path: `${OUT}/05-bulk-bar.png` });
  // clear
  await sel('bulk-action-done').click().catch(() => {});
  await page.waitForTimeout(150);
  log('bulk bar dismisses', !(await sel('bulk-action-bar').isVisible().catch(() => false)));

  // ── 5. Rename via pencil ───────────────────────────────────────────────────
  await rowA.hover();
  await rowA.locator('[data-testid="row-action-rename"]').click();
  await page.waitForSelector('[data-testid="list-task-rename"]', { timeout: 3000 });
  await sel('list-task-rename').fill('Renamed Task 1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const renamed = await page.locator('[data-testid="list-task-name"]').first().textContent();
  log('pencil renames inline', /Renamed Task 1/.test(renamed || ''), renamed || '');

  // ── 6. Drag reorder within group ───────────────────────────────────────────
  const beforeOrder = await page.locator('[data-testid="list-task-row"][draggable="true"] [data-testid="list-task-name"]')
    .allTextContents();
  const src = page.locator('[data-testid="list-task-row"][draggable="true"]').nth(0);
  const dst = page.locator('[data-testid="list-task-row"][draggable="true"]').nth(2);
  await src.dragTo(dst);
  await page.waitForTimeout(300);
  const afterOrder = await page.locator('[data-testid="list-task-row"][draggable="true"] [data-testid="list-task-name"]')
    .allTextContents();
  log('drag reorders rows', JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder),
    `before=${beforeOrder.slice(0, 3).join(',')} after=${afterOrder.slice(0, 3).join(',')}`);

  // ── 7. Seed a second status group, then drag across groups ─────────────────
  // Open the status pill on the last row and pick a non-current status so a
  // second group exists to drag into.
  const seedRow = page.locator('[data-testid="list-task-row"][draggable="true"]').last();
  await seedRow.hover();
  await seedRow.locator('[data-testid="cell-status"]').click();
  await page.waitForSelector('[data-testid="status-section"]', { timeout: 3000 });
  // pick a status option whose label differs from the current group ("to do")
  const options = page.locator('[data-testid="status-section"] [role="menuitem"]');
  const n = await options.count();
  let picked = false;
  for (let i = 0; i < n; i++) {
    const label = (await options.nth(i).textContent())?.trim().toLowerCase() || '';
    if (label && !/to do/.test(label)) {
      await options.nth(i).click();
      picked = true;
      break;
    }
  }
  await page.waitForTimeout(300);
  const groups = page.locator('[data-testid="list-status-group"]');
  const groupCount = await groups.count();

  if (picked && groupCount >= 2) {
    const g0row = groups.nth(0).locator('[data-testid="list-task-row"][draggable="true"]').first();
    const movedName = (await g0row.locator('[data-testid="list-task-name"]').textContent())?.trim();
    const g1target = groups.nth(1).locator('[data-testid="list-task-row"][draggable="true"]').first();
    const g1status = await groups.nth(1).getAttribute('data-status');
    await g0row.dragTo(g1target);
    await page.waitForTimeout(350);
    const inG1 = await groups.nth(1).locator(`[data-testid="list-task-name"]:text-is("${movedName}")`).count();
    log('drag across groups changes status', inG1 >= 1, `moved "${movedName}" -> ${g1status}`);
  } else {
    log('drag across groups changes status', false, `picked=${picked} groups=${groupCount}`);
  }
  await page.screenshot({ path: `${OUT}/06-after-drag.png`, clip: { x: 0, y: 0, width: 1440, height: 500 } });

  // ── 8. Persistence on reload (order + tag survive) ─────────────────────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="list-task-row"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  const chipsAfterReload = await page.locator('[data-testid="row-tag-chip"]').count();
  log('tag persists after reload', chipsAfterReload >= 1, `chips=${chipsAfterReload}`);
  const renamedAfterReload = (await page.locator('[data-testid="list-task-name"]').allTextContents())
    .some((t) => /Renamed Task 1/.test(t));
  log('rename persists after reload', renamedAfterReload);

  log('no fatal console/page errors', !fatalHit);
} catch (err) {
  log('script completed', false, err.message);
} finally {
  // Clean up seeded mutations so the corpus stays pristine.
  await page.evaluate(() => localStorage.removeItem('parity-workspace-v1')).catch(() => {});
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
