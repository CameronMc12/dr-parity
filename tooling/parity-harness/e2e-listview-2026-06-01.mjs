import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'tooling/parity-harness/output/e2e-listview-2026-06-01';
const LIST = 'http://localhost:4280/90152566819/v/l/901523542898';
mkdirSync(OUT, { recursive: true });

const results = [];
function log(name, ok, note = '') {
  results.push({ name, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${note}`);
}

// ── console / pageerror collection ───────────────────────────────────────────
const consoleErrors = [];
const pageErrors = [];
const fatalPatterns = [
  /getServerSnapshot/i,
  /should be cached/i,
  /Maximum update depth/i,
  /infinite/i,
];
let fatalHit = false;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    consoleErrors.push(text);
    if (fatalPatterns.some((p) => p.test(text))) fatalHit = true;
  }
});
page.on('pageerror', (err) => {
  const text = err.message || String(err);
  pageErrors.push(text);
  if (fatalPatterns.some((p) => p.test(text))) fatalHit = true;
});

let stepNo = 0;
async function shot(name) {
  stepNo += 1;
  const n = String(stepNo).padStart(2, '0');
  await page.screenshot({ path: `${OUT}/${n}-${name}.png` });
}

async function closeAll() {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('[role="menu"]:visible').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
}

async function openMenu(triggerSel, hoverSel, label, screenshotName) {
  await closeAll();
  try {
    if (hoverSel) {
      await page.locator(hoverSel).first().scrollIntoViewIfNeeded();
      await page.locator(hoverSel).first().hover();
      await page.waitForTimeout(140);
    }
    await page.locator(triggerSel).first().click({ force: true });
    await page.waitForTimeout(260);
    const menu = page.locator('[role="menu"]:visible').last();
    await menu.waitFor({ state: 'visible', timeout: 2500 });
    const box = await menu.boundingBox();
    // dark-theme check: menu bg should be dark
    const bg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
    const dark = isDark(bg);
    if (screenshotName) await shot(screenshotName);
    log(label, !!box && dark, `${Math.round(box?.width)}x${Math.round(box?.height)} bg=${bg}${dark ? '' : ' NOT-DARK'}`);
    return menu;
  } catch (e) {
    log(label, false, e.message.split('\n')[0]);
    await shot(`${screenshotName || label}-FAIL`);
    return null;
  }
}

function isDark(rgb) {
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return (r * 0.299 + g * 0.587 + b * 0.114) < 90;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: Load list, assert rows, dark theme, zero errors
// ═════════════════════════════════════════════════════════════════════════════
await page.goto(LIST, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const rowCount = await page.locator('[data-testid="list-task-row"]').count();
const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
await shot('list-loaded');
log('1-rows-render', rowCount > 0, `${rowCount} rows`);
log('1-dark-theme', isDark(bodyBg), `body bg=${bodyBg}`);
log('1-no-errors-on-load', consoleErrors.length === 0 && pageErrors.length === 0, `console=${consoleErrors.length} page=${pageErrors.length}`);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: Toolbar menus
// ═════════════════════════════════════════════════════════════════════════════
// Group-by: open, regroup by Priority, assert groups change
await closeAll();
const groupsBefore = await page.locator('[data-testid="list-group-header"]').allInnerTexts();
await openMenu('[data-testid="list-toolbar-groupby"]', null, '2-groupby-menu-opens', 'toolbar-groupby');
const gbMenu = page.locator('[role="menu"]:visible').last();
let regroupOk = false, regroupNote = '';
try {
  await gbMenu.getByText('Priority', { exact: false }).first().click();
  await page.waitForTimeout(300);
  await closeAll();
  const groupsAfter = await page.locator('[data-testid="list-group-header"]').allInnerTexts();
  const pill = await page.locator('[data-testid="list-toolbar-groupby"]').innerText();
  regroupOk = JSON.stringify(groupsBefore) !== JSON.stringify(groupsAfter) || /priority/i.test(pill);
  regroupNote = `pill="${pill.replace(/\n/g, ' ')}" groups ${groupsBefore.length}->${groupsAfter.length}`;
  await shot('regrouped-by-priority');
} catch (e) { regroupNote = e.message.split('\n')[0]; }
log('2-regroup-by-priority', regroupOk, regroupNote);

// regroup back to Status for the rest of the flow
await closeAll();
try {
  await page.locator('[data-testid="list-toolbar-groupby"]').click();
  await page.waitForTimeout(200);
  await page.locator('[role="menu"]:visible').last().getByText(/^Status$/).first().click();
  await page.waitForTimeout(280);
} catch {}
await closeAll();

// Columns: hide "Priority" -> assert column disappears; re-show
let hideOk = false, hideNote = '', reshowOk = false;
try {
  const prioCellsBefore = await page.locator('[data-testid="cell-priority"]').count();
  await page.locator('[data-testid="list-toolbar-columns"]').click();
  await page.waitForTimeout(240);
  await shot('toolbar-columns');
  await page.locator('[role="menu"]:visible').last().getByText('Priority', { exact: true }).first().click();
  await page.waitForTimeout(260);
  await closeAll();
  const prioCellsAfter = await page.locator('[data-testid="cell-priority"]').count();
  hideOk = prioCellsBefore > 0 && prioCellsAfter === 0;
  hideNote = `priority cells ${prioCellsBefore}->${prioCellsAfter}`;
  await shot('column-priority-hidden');
  // re-show
  await page.locator('[data-testid="list-toolbar-columns"]').click();
  await page.waitForTimeout(220);
  await page.locator('[role="menu"]:visible').last().getByText('Priority', { exact: true }).first().click();
  await page.waitForTimeout(260);
  await closeAll();
  const prioCellsReshow = await page.locator('[data-testid="cell-priority"]').count();
  reshowOk = prioCellsReshow > 0;
  hideNote += ` reshow=${prioCellsReshow}`;
} catch (e) { hideNote = e.message.split('\n')[0]; }
log('2-columns-hide-priority', hideOk, hideNote);
log('2-columns-reshow-priority', reshowOk, '');

// Filter
await openMenu('[data-testid="list-toolbar-filter"]', null, '2-filter-menu-opens', 'toolbar-filter');
// Customize
await openMenu('[data-testid="list-toolbar-customize"]', null, '2-customize-menu-opens', 'toolbar-customize');
// Subtasks
await openMenu('[data-testid="list-toolbar-subtasks"]', null, '2-subtasks-menu-opens', 'toolbar-subtasks');
// Add-Task caret
await openMenu('[data-testid="list-toolbar-add-task-caret"]', null, '2-addtask-caret-opens', 'toolbar-addtask-caret');
await closeAll();

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: Cell editors (change value, assert row updates + persists on reload)
// ═════════════════════════════════════════════════════════════════════════════
function firstRow() { return page.locator('[data-testid="list-task-row"]').first(); }
// Target a row by its task name so re-grouping / reordering can't make us read
// a different row after the edit.
function rowByName(name) {
  return page
    .locator('[data-testid="list-task-row"]', {
      has: page.locator('[data-testid="list-task-name"]', { hasText: name }),
    })
    .first();
}

// 3a. Status cell -> pick a different status (target "Task 1" by name)
let statusOk = false, statusNote = '';
let chosenStatus = '';
try {
  const target = rowByName('Task 1');
  const before = (await target.locator('[data-testid="cell-status"]').innerText()).trim();
  await target.locator('[data-testid="cell-status"]').click();
  await page.waitForTimeout(240);
  await shot('cell-status-open');
  const menu = page.locator('[role="menu"]:visible').last();
  const items = menu.locator('[role="menuitem"]');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const t = (await items.nth(i).innerText()).trim();
    if (t && !before.toLowerCase().includes(t.toLowerCase()) && t.length < 40) { chosenStatus = t; await items.nth(i).click(); break; }
  }
  await page.waitForTimeout(300);
  await closeAll();
  const after = (await rowByName('Task 1').locator('[data-testid="cell-status"]').innerText()).trim();
  statusOk = before.toLowerCase() !== after.toLowerCase();
  statusNote = `"${before}" -> "${after}" (chose ${chosenStatus}, by-name row)`;
} catch (e) { statusNote = e.message.split('\n')[0]; }
log('3-status-cell-updates', statusOk, statusNote);

// 3b. Priority cell -> set High (target "Task 2" by name)
let prioOk = false, prioNote = '';
try {
  await rowByName('Task 2').locator('[data-testid="cell-priority"]').click();
  await page.waitForTimeout(240);
  await shot('cell-priority-open');
  await page.locator('[role="menu"]:visible').last().getByText('High', { exact: false }).first().click();
  await page.waitForTimeout(260);
  await closeAll();
  const after = (await rowByName('Task 2').locator('[data-testid="cell-priority"]').innerText()).trim();
  prioOk = /high/i.test(after);
  prioNote = `Task 2 -> "${after}"`;
} catch (e) { prioNote = e.message.split('\n')[0]; }
log('3-priority-cell-set-high', prioOk, prioNote);

// 3c. Assignee cell -> assign Me (target "Task 2")
let assignOk = false, assignNote = '';
try {
  await rowByName('Task 2').locator('[data-testid="cell-assignee"]').click();
  await page.waitForTimeout(240);
  await shot('cell-assignee-open');
  const menu = page.locator('[role="menu"]:visible').last();
  const meOpt = menu.getByText('(Me)', { exact: false }).first();
  if (await meOpt.count()) await meOpt.click();
  else await menu.locator('[role="menuitem"]').first().click();
  await page.waitForTimeout(260);
  await closeAll();
  const after = (await rowByName('Task 2').locator('[data-testid="cell-assignee"]').innerText()).trim();
  assignOk = after.length > 0;
  assignNote = `Task 2 assignee cell now "${after}"`;
} catch (e) { assignNote = e.message.split('\n')[0]; }
log('3-assignee-cell-assign-me', assignOk, assignNote);

// 3d. Due date cell -> pick a date from the calendar (target "Task 2")
let dateOk = false, dateNote = '';
try {
  const before = (await rowByName('Task 2').locator('[data-testid="cell-duedate"]').innerText()).trim();
  await rowByName('Task 2').locator('[data-testid="cell-duedate"]').click();
  await page.waitForTimeout(280);
  await shot('cell-duedate-open');
  const menu = page.locator('[role="menu"]:visible').last();
  const day = menu.getByRole('button', { name: /^15$/ }).first();
  if (await day.count()) await day.click();
  else await menu.getByText(/^1[0-9]$/).first().click();
  await page.waitForTimeout(280);
  await closeAll();
  const after = (await rowByName('Task 2').locator('[data-testid="cell-duedate"]').innerText()).trim();
  dateOk = after.length > 0 && after !== before;
  dateNote = `Task 2 "${before}" -> "${after}"`;
} catch (e) { dateNote = e.message.split('\n')[0]; }
log('3-duedate-cell-pick', dateOk, dateNote);

await shot('cells-edited');

// 3-persist: reload, assert Task 2 priority High + due date survive
let persistOk = false, persistNote = '';
try {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const prio = (await rowByName('Task 2').locator('[data-testid="cell-priority"]').innerText().catch(() => '')).trim();
  const due = (await rowByName('Task 2').locator('[data-testid="cell-duedate"]').innerText().catch(() => '')).trim();
  const st = (await rowByName('Task 1').locator('[data-testid="cell-status"]').innerText().catch(() => '')).trim();
  persistOk = /high/i.test(prio) && due.length > 0;
  persistNote = `Task2 prio="${prio}" due="${due}" | Task1 status="${st}"`;
} catch (e) { persistNote = e.message.split('\n')[0]; }
log('3-cell-edits-persist-on-reload', persistOk, persistNote);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: Row kebab — Duplicate + Delete
// ═════════════════════════════════════════════════════════════════════════════
let dupOk = false, dupNote = '';
try {
  await closeAll();
  const before = await page.locator('[data-testid="list-task-row"]').count();
  await firstRow().hover();
  await page.waitForTimeout(120);
  await page.locator('[data-testid="list-task-kebab"]').first().click({ force: true });
  await page.waitForTimeout(220);
  await shot('row-kebab-open');
  await page.locator('[role="menu"]:visible').last().getByText('Duplicate', { exact: false }).first().click();
  await page.waitForTimeout(300);
  await closeAll();
  const after = await page.locator('[data-testid="list-task-row"]').count();
  dupOk = after === before + 1;
  dupNote = `${before} -> ${after}`;
} catch (e) { dupNote = e.message.split('\n')[0]; }
log('4-kebab-duplicate', dupOk, dupNote);

let delOk = false, delNote = '';
try {
  await closeAll();
  const before = await page.locator('[data-testid="list-task-row"]').count();
  await firstRow().hover();
  await page.waitForTimeout(120);
  await page.locator('[data-testid="list-task-kebab"]').first().click({ force: true });
  await page.waitForTimeout(220);
  await page.locator('[role="menu"]:visible').last().getByText('Delete', { exact: false }).first().click();
  await page.waitForTimeout(300);
  await closeAll();
  const after = await page.locator('[data-testid="list-task-row"]').count();
  delOk = after === before - 1;
  delNote = `${before} -> ${after}`;
} catch (e) { delNote = e.message.split('\n')[0]; }
log('4-kebab-delete', delOk, delNote);
await shot('after-kebab-ops');

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: Group menu — Collapse all
// ═════════════════════════════════════════════════════════════════════════════
let collapseOk = false, collapseNote = '';
try {
  await closeAll();
  await page.locator('[data-testid="list-group-header"]').first().hover();
  await page.waitForTimeout(120);
  await page.locator('[data-testid="list-group-menu"]').first().click({ force: true });
  await page.waitForTimeout(200);
  await shot('group-menu-open');
  await page.locator('[role="menu"]:visible').last().getByText('Collapse all', { exact: false }).first().click();
  await page.waitForTimeout(300);
  const rowsVisible = await page.locator('[data-testid="list-task-row"]:visible').count();
  collapseOk = rowsVisible === 0;
  collapseNote = `visible rows after collapse: ${rowsVisible}`;
  await shot('groups-collapsed');
} catch (e) { collapseNote = e.message.split('\n')[0]; }
log('5-group-collapse-all', collapseOk, collapseNote);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6: Open task panel via task NAME click
// ═════════════════════════════════════════════════════════════════════════════
// Clear persisted view-config (Step 5 collapse-all is persisted) and re-seed so
// the list is expanded with task names visible again.
await page.goto(LIST, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

let navOk = false, navNote = '', taskId = '';
let panelOk = false, panelNote = '';
try {
  const nameEl = page.locator('[data-testid="list-task-name"]').first();
  const taskName = (await nameEl.innerText()).trim();
  await nameEl.click();
  await page.waitForTimeout(600);
  const url = page.url();
  navOk = /\/90152566819\/t\/[^/]+/.test(url);
  taskId = (url.match(/\/t\/([^/?#]+)/) || [])[1] || '';
  navNote = `url=${url.replace('http://localhost:4280', '')} name="${taskName}"`;
  await shot('task-panel-open');

  // panel components
  const titleInput = page.locator('[aria-label="Task name"]');
  const hasTitle = await titleInput.count();
  const hasStatus = await page.getByText('Status', { exact: true }).count();
  const hasDates = await page.getByText('Dates', { exact: true }).count();
  const hasAssignees = await page.getByText('Assignees', { exact: true }).count();
  const hasPriority = await page.getByText('Priority', { exact: true }).count();
  // Description renders as a read-mode button ("Add description" or the body);
  // the aria-labelled textarea only exists once you click into edit mode.
  const hasDescEdit = await page.locator('[aria-label="Task description"]').count();
  const hasDescRead = await page.getByRole('button', { name: /Add description/i }).count();
  const hasDesc = hasDescEdit + hasDescRead;
  const hasActivity = await page.getByText('Activity', { exact: false }).count();
  panelOk = hasTitle > 0 && hasStatus > 0 && hasDates > 0 && hasAssignees > 0 && hasPriority > 0 && hasDesc > 0 && hasActivity > 0;
  panelNote = `title=${hasTitle} status=${hasStatus} dates=${hasDates} assignees=${hasAssignees} priority=${hasPriority} desc=${hasDesc} activity=${hasActivity}`;
} catch (e) { navNote = e.message.split('\n')[0]; }
log('6-task-name-navigates', navOk, navNote);
log('6-panel-renders-all-sections', panelOk, panelNote);

// helper: read the title value whether it's an <input>/<textarea> or contenteditable
async function readTitle() {
  const el = page.locator('[aria-label="Task name"]').first();
  const v = await el.inputValue().catch(() => null);
  if (v !== null) return v;
  return (await el.innerText().catch(() => '')) || '';
}

// Edit title + status in panel, reload, assert persisted
let editTitleOk = false, editStatusOk = false, panelTitlePersist = false, panelStatusPersist = false, editNote = '';
const newTitle = `E2E Edited ${Date.now() % 100000}`;
let chosenPanelStatus = '';
try {
  const titleInput = page.locator('[aria-label="Task name"]').first();
  await titleInput.click();
  await titleInput.fill(newTitle).catch(async () => {
    // contenteditable fallback
    await titleInput.evaluate((el, t) => { el.textContent = t; }, newTitle);
  });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  const titleNow = await readTitle();
  editTitleOk = (titleNow || '').includes(newTitle);

  // status: the StatusField button is the aria-expanded button whose label is a
  // status value (to do / in progress / in review / complete). Scope by text so
  // we don't grab the shell's "Task" create button (which also has aria-expanded).
  const statusRe = /^(to do|in progress|in review|complete)$/i;
  const statusBtn = page
    .locator('button[aria-expanded]')
    .filter({ hasText: statusRe })
    .first();
  const statusBtnFn = () =>
    page.locator('button[aria-expanded]').filter({ hasText: statusRe }).first();
  if (await statusBtn.count()) {
    const beforeStatus = (await statusBtn.innerText()).trim();
    await statusBtn.click();
    await page.waitForTimeout(240);
    const menu = page.locator('[role="menu"]:visible').last();
    const items = menu.locator('[role="menuitem"]');
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const t = (await items.nth(i).innerText()).trim();
      if (t && !beforeStatus.toLowerCase().includes(t.toLowerCase())) { chosenPanelStatus = t; await items.nth(i).click(); break; }
    }
    await page.waitForTimeout(300);
    const afterStatus = (await statusBtnFn().innerText().catch(() => '')).trim();
    editStatusOk = !!chosenPanelStatus && afterStatus.toLowerCase().includes(chosenPanelStatus.toLowerCase());
    editNote = `status "${beforeStatus}" -> "${afterStatus}"`;
  } else {
    editNote = 'status button not found';
  }
  await shot('panel-edited');

  // reload, assert both title + status persisted
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const titleAfter = await readTitle();
  panelTitlePersist = (titleAfter || '').includes(newTitle);
  const statusAfterReload = (await page.locator('button[aria-expanded]').filter({ hasText: statusRe }).first().innerText().catch(() => '')).trim();
  panelStatusPersist = chosenPanelStatus ? statusAfterReload.toLowerCase().includes(chosenPanelStatus.toLowerCase()) : false;
  editNote += ` | persistedTitle="${titleAfter}" persistedStatus="${statusAfterReload}"`;
  await shot('panel-after-reload');
} catch (e) { editNote = e.message.split('\n')[0]; }
log('6-panel-edit-title', editTitleOk, editNote);
log('6-panel-edit-status', editStatusOk, `chose ${chosenPanelStatus}`);
log('6-panel-edits-persist-on-reload', panelTitlePersist && panelStatusPersist, `title=${panelTitlePersist} status=${panelStatusPersist}`);

// Close / back -> returns to list
let backOk = false, backNote = '';
try {
  await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);
  const url = page.url();
  const rows = await page.locator('[data-testid="list-task-row"]').count();
  backOk = /\/v\/l\//.test(url) && rows > 0;
  backNote = `url=${url.replace('http://localhost:4280', '')} rows=${rows}`;
  await shot('back-to-list');
} catch (e) { backNote = e.message.split('\n')[0]; }
log('6-panel-close-returns-to-list', backOk, backNote);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 7: final error re-assert
// ═════════════════════════════════════════════════════════════════════════════
log('7-zero-console-errors', consoleErrors.length === 0, `${consoleErrors.length} errors`);
log('7-zero-page-errors', pageErrors.length === 0, `${pageErrors.length} errors`);
log('7-no-fatal-patterns', !fatalHit, fatalHit ? 'FATAL pattern hit (getServerSnapshot / cached / max update depth / infinite)' : 'none');

// ═════════════════════════════════════════════════════════════════════════════
// CLEANUP: clear localStorage + reload to confirm clean re-seed
// ═════════════════════════════════════════════════════════════════════════════
let cleanupOk = false, cleanupNote = '';
try {
  // Ensure we are on the app origin (a failed goBack can leave us on about:blank,
  // where localStorage access throws SecurityError).
  if (!page.url().startsWith('http://localhost:4280')) {
    await page.goto(LIST, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
  await page.goto(LIST, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const rows = await page.locator('[data-testid="list-task-row"]').count();
  const stored = await page.evaluate(() => localStorage.getItem('parity-workspace-v1'));
  cleanupOk = rows > 0;
  cleanupNote = `re-seeded rows=${rows} storageKeyPresent=${!!stored}`;
  await shot('cleanup-reseed');
} catch (e) { cleanupNote = e.message.split('\n')[0]; }
log('cleanup-clean-reseed', cleanupOk, cleanupNote);

await browser.close();

// ── report ───────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n================= SCOREBOARD =================`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.note}`);
console.log(`\n${pass}/${results.length} checks passed`);
console.log(`\nCONSOLE ERRORS (${consoleErrors.length}):`);
consoleErrors.slice(0, 25).forEach((e, i) => console.log(`  [${i}] ${e.slice(0, 200)}`));
console.log(`\nPAGE ERRORS (${pageErrors.length}):`);
pageErrors.slice(0, 25).forEach((e, i) => console.log(`  [${i}] ${e.slice(0, 200)}`));
console.log(`\nFATAL PATTERN HIT: ${fatalHit}`);
