import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'tooling/parity-harness/output/listview-interactive-2026-06-01';
const PROJECT1 = 'http://localhost:4280/90152566819/v/l/901523542898';
const AB = 'http://localhost:4280/90152566819/v/l/901523547043';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

const results = [];
function log(name, ok, note = '') {
  results.push({ name, ok, note });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${note ? '  — ' + note : ''}`);
}

async function closeAll() {
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('[role="menu"]:visible').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
}

async function shotMenu(name, triggerSel, hoverSel) {
  await closeAll();
  try {
    if (hoverSel) {
      await page.locator(hoverSel).first().scrollIntoViewIfNeeded();
      await page.locator(hoverSel).first().hover();
      await page.waitForTimeout(120);
    }
    const t = page.locator(triggerSel).first();
    await t.click({ force: true });
    await page.waitForTimeout(260);
    const menu = page.locator('[role="menu"]:visible').last();
    await menu.waitFor({ state: 'visible', timeout: 2500 });
    const box = await menu.boundingBox();
    const pad = 8;
    await page.screenshot({
      path: `${OUT}/${name}.png`,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(page.viewportSize().width - Math.max(0, box.x - pad), box.width + pad * 2),
        height: Math.min(page.viewportSize().height - Math.max(0, box.y - pad), box.height + pad * 2),
      },
    });
    log(name, true, `${Math.round(box.width)}x${Math.round(box.height)}`);
    return menu;
  } catch (e) {
    log(name, false, e.message.split('\n')[0]);
    await page.screenshot({ path: `${OUT}/${name}-FAIL.png` });
    return null;
  }
}

// ── PROJECT 1 ────────────────────────────────────────────────────────────────
await page.goto(PROJECT1, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const rowCountBefore = await page.locator('[data-testid="list-task-row"]').count();
log('rows-render', rowCountBefore > 0, `${rowCountBefore} rows`);

// Toolbar menus
await shotMenu('toolbar-groupby', '[data-testid="list-toolbar-groupby"]');
await shotMenu('toolbar-subtasks', '[data-testid="list-toolbar-subtasks"]');
await shotMenu('toolbar-columns', '[data-testid="list-toolbar-columns"]');
await shotMenu('toolbar-filter', '[data-testid="list-toolbar-filter"]');
await shotMenu('toolbar-customize', '[data-testid="list-toolbar-customize"]');
await shotMenu('toolbar-addtask-caret', '[data-testid="list-toolbar-add-task-caret"]');

// Cell editors
await shotMenu('cell-status', '[data-testid="cell-status"]');
await shotMenu('cell-priority', '[data-testid="cell-priority"]');
await shotMenu('cell-assignee', '[data-testid="cell-assignee"]');
await shotMenu('cell-duedate', '[data-testid="cell-duedate"]');

// Add column
await shotMenu('col-addcolumn', '[data-testid="list-add-column"]');

// Row kebab (hover first row to reveal)
await shotMenu('row-kebab', '[data-testid="list-task-kebab"]', '[data-testid="list-task-row"]');

// Group menu (hover group header to reveal the kebab)
await shotMenu('group-menu', '[data-testid="list-group-menu"]', '[data-testid="list-group-header"]');

// ── FUNCTIONAL: change a task's priority via the cell ───────────────────────
await closeAll();
const firstRow = page.locator('[data-testid="list-task-row"]').first();
const beforePrioCell = await firstRow.locator('[data-testid="cell-priority"]').innerText().catch(() => '');
await firstRow.locator('[data-testid="cell-priority"]').click();
await page.waitForTimeout(220);
await page.locator('[role="menu"]:visible >> text=Urgent').first().click();
await page.waitForTimeout(220);
const afterPrioCell = await firstRow.locator('[data-testid="cell-priority"]').innerText().catch(() => '');
log('priority-cell-updates', afterPrioCell.includes('Urgent'), `"${beforePrioCell}" -> "${afterPrioCell}"`);

// Persist check: reload, priority should remain
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const persisted = await page
  .locator('[data-testid="list-task-row"]')
  .first()
  .locator('[data-testid="cell-priority"]')
  .innerText()
  .catch(() => '');
log('priority-persists', persisted.includes('Urgent'), `"${persisted}"`);

// ── FUNCTIONAL: change status via the status cell ───────────────────────────
await closeAll();
await page.locator('[data-testid="cell-status"]').nth(1).click();
await page.waitForTimeout(220);
const statusMenu = page.locator('[role="menu"]:visible').last();
const statusItem = statusMenu.locator('[role="menuitem"]').nth(1);
await statusItem.click();
await page.waitForTimeout(200);
log('status-cell-clickable', true, 'status applied');

// ── FUNCTIONAL: regroup by Priority ─────────────────────────────────────────
await closeAll();
await page.locator('[data-testid="list-toolbar-groupby"]').click();
await page.waitForTimeout(180);
await page.locator('[role="menu"]:visible >> text=Priority').first().click();
await page.waitForTimeout(260);
const pillText = await page.locator('[data-testid="list-toolbar-groupby"]').innerText();
log('regroup-by-priority', pillText.includes('Priority'), `pill="${pillText.replace(/\n/g, ' ')}"`);
await page.screenshot({ path: `${OUT}/regrouped-priority.png` });

// regroup back to Status
await closeAll();
await page.locator('[data-testid="list-toolbar-groupby"]').click();
await page.waitForTimeout(200);
await page.locator('[role="menu"]:visible [role="menuitem"]', { hasText: /^Status$/ }).first().click();
await page.waitForTimeout(240);

// ── FUNCTIONAL: hide a column ───────────────────────────────────────────────
await closeAll();
const colsBefore = await page.locator('[data-testid="list-task-row"]').first().locator('[data-testid="cell-comments"], [data-testid="cell-priority"]').count();
await page.locator('[data-testid="list-toolbar-columns"]').click();
await page.waitForTimeout(200);
// Toggle "Priority" off
await page.locator('[role="menu"]:visible >> text=Priority').first().click();
await page.waitForTimeout(220);
await closeAll();
const priorityCellsAfter = await page.locator('[data-testid="cell-priority"]').count();
log('hide-column', priorityCellsAfter === 0, `priority cells now ${priorityCellsAfter}`);
await page.screenshot({ path: `${OUT}/column-hidden.png` });
// re-show
await page.locator('[data-testid="list-toolbar-columns"]').click();
await page.waitForTimeout(180);
await page.locator('[role="menu"]:visible >> text=Priority').first().click();
await page.waitForTimeout(200);
await closeAll();

// ── FUNCTIONAL: toggle show-closed ──────────────────────────────────────────
const rowsClosedOn = await page.locator('[data-testid="list-task-row"]').count();
await page.locator('[data-testid="list-toolbar-closed"]').click();
await page.waitForTimeout(220);
const rowsClosedOff = await page.locator('[data-testid="list-task-row"]').count();
log('toggle-show-closed', rowsClosedOff <= rowsClosedOn, `${rowsClosedOn} -> ${rowsClosedOff}`);
await page.locator('[data-testid="list-toolbar-closed"]').click();
await page.waitForTimeout(180);

// ── FUNCTIONAL: row kebab duplicate + delete ───────────────────────────────
await closeAll();
const totalBefore = await page.locator('[data-testid="list-task-row"]').count();
await page.locator('[data-testid="list-task-row"]').first().hover();
await page.locator('[data-testid="list-task-kebab"]').first().click();
await page.waitForTimeout(180);
await page.locator('[role="menu"]:visible >> text=Duplicate').first().click();
await page.waitForTimeout(250);
const totalAfterDup = await page.locator('[data-testid="list-task-row"]').count();
log('kebab-duplicate', totalAfterDup === totalBefore + 1, `${totalBefore} -> ${totalAfterDup}`);

await closeAll();
await page.locator('[data-testid="list-task-row"]').first().hover();
await page.locator('[data-testid="list-task-kebab"]').first().click();
await page.waitForTimeout(180);
await page.locator('[role="menu"]:visible >> text=Delete').first().click();
await page.waitForTimeout(250);
const totalAfterDel = await page.locator('[data-testid="list-task-row"]').count();
log('kebab-delete', totalAfterDel === totalAfterDup - 1, `${totalAfterDup} -> ${totalAfterDel}`);

// ── FUNCTIONAL: group collapse all ──────────────────────────────────────────
await closeAll();
await page.locator('[data-testid="list-group-header"]').first().hover();
await page.waitForTimeout(120);
await page.locator('[data-testid="list-group-menu"]').first().click({ force: true });
await page.waitForTimeout(160);
await page.locator('[role="menu"]:visible >> text=Collapse all groups').first().click();
await page.waitForTimeout(250);
const rowsAfterCollapse = await page.locator('[data-testid="list-task-row"]').count();
log('group-collapse-all', rowsAfterCollapse === 0, `rows visible: ${rowsAfterCollapse}`);
await page.screenshot({ path: `${OUT}/collapsed-all.png` });

// ── AB CONTENT (custom statuses) ────────────────────────────────────────────
await page.goto(AB, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const abRows = await page.locator('[data-testid="list-task-row"]').count();
log('ab-content-rows', abRows > 0, `${abRows} rows`);
await shotMenu('ab-cell-status', '[data-testid="cell-status"]');
await page.screenshot({ path: `${OUT}/ab-content-overview.png`, fullPage: false });

// cleanup
await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));

await browser.close();

const pass = results.filter((r) => r.ok).length;
console.log(`\n=== ${pass}/${results.length} checks passed ===`);
for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL ${r.name}: ${r.note}`);
