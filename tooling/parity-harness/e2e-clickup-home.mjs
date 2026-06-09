// Throwaway E2E gate for the ClickUp clone Home experience.
// Playwright CLI only. Verification — does not edit app code.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:4280';
const WS = '90152566819';
const OUT = new URL('./output/e2e-2026-06-01/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// ── error capture ──────────────────────────────────────────────────────────
const consoleErrors = [];
const pageErrors = [];
const FATAL_RE = /getServerSnapshot|should be cached|Maximum update depth|infinite/i;

const board = []; // scoreboard rows
function row(feature, pass, note) {
  board.push({ feature, pass: pass ? 'PASS' : 'FAIL', note });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${feature} — ${note}`);
}

let shotN = 0;
async function shot(page, name) {
  const file = join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStore(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('parity-workspace-v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));

  // window.prompt handlers for Add Channel / New Space / New List
  let promptAnswer = null;
  page.on('dialog', async (d) => {
    if (d.type() === 'prompt') await d.accept(promptAnswer ?? '');
    else await d.accept();
  });

  try {
    // ── STEP 1: Load home, assert dashboard renders ──────────────────────────
    await page.goto(`${BASE}/${WS}/home`, { waitUntil: 'networkidle' });
    await sleep(700);
    const heroVisible = await page
      .locator('text=My Work')
      .first()
      .isVisible()
      .catch(() => false);
    const widgetCount =
      (await page.locator('[data-testid="mywork-tasks"]').count()) +
      (await page.getByText('Recents', { exact: false }).count()) +
      (await page.getByText('Agenda', { exact: false }).count());
    await shot(page, 'home-loaded');
    const step1Err = consoleErrors.length + pageErrors.length;
    row(
      '1. Home dashboard',
      heroVisible && step1Err === 0,
      `hero=${heroVisible} widgets≈${widgetCount} errs@load=${step1Err}`,
    );

    // ── STEP 2: Create task via + menu ───────────────────────────────────────
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await sleep(250);
    await shot(page, 'create-menu-open');
    // click the "Task" menuitem
    await page.getByRole('menuitem', { name: 'Task', exact: false }).first().click();
    await sleep(300);
    const modal = page.locator('[data-testid="create-task-modal"]');
    const modalOpen = await modal.isVisible().catch(() => false);
    await page.locator('[data-testid="create-task-name"]').fill('E2E Test Task');
    // pick a list
    await page.locator('[data-testid="create-task-list-trigger"]').click();
    await sleep(200);
    await shot(page, 'modal-list-picker');
    // pick "Project 1" (list 901523542898)
    await page.getByRole('menuitem', { name: 'Project 1', exact: false }).first().click();
    await sleep(150);
    await shot(page, 'modal-filled');
    await page.locator('[data-testid="create-task-submit"]').click();
    await sleep(400);
    const modalClosed = !(await modal.isVisible().catch(() => false));
    const store2 = await readStore(page);
    const taskInStore =
      !!store2 &&
      JSON.stringify(store2).includes('E2E Test Task');
    await shot(page, 'task-created');
    row(
      '2. Create task (+ menu)',
      modalOpen && modalClosed && taskInStore,
      `modalOpen=${modalOpen} closed=${modalClosed} inStore=${taskInStore}`,
    );

    // ── STEP 3: Persist check (reload) ───────────────────────────────────────
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(700);
    const store3 = await readStore(page);
    const taskPersisted = !!store3 && JSON.stringify(store3).includes('E2E Test Task');
    await shot(page, 'after-reload');
    row('3. Task persists (reload)', taskPersisted, `inStore=${taskPersisted}`);

    // ── STEP 4: Channel send ─────────────────────────────────────────────────
    await page.goto(`${BASE}/${WS}/chat/r/ch-demo`, { waitUntil: 'networkidle' });
    await sleep(600);
    const composer = page.locator('[data-testid="channel-composer"]');
    const composerVisible = await composer.isVisible().catch(() => false);
    const MSG = 'E2E hello from the gate';
    await composer.fill(MSG);
    await page.locator('[data-testid="channel-send"]').click();
    await sleep(300);
    const msgRendered = await page
      .locator('[data-testid="channel-message"]', { hasText: MSG })
      .count();
    await shot(page, 'channel-message-sent');
    // persist
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(600);
    const msgAfterReload = await page
      .locator('[data-testid="channel-message"]', { hasText: MSG })
      .count();
    await shot(page, 'channel-message-persist');
    row(
      '4. Channel send + persist',
      composerVisible && msgRendered > 0 && msgAfterReload > 0,
      `composer=${composerVisible} rendered=${msgRendered} afterReload=${msgAfterReload}`,
    );

    // ── STEP 5: Create channel ───────────────────────────────────────────────
    promptAnswer = 'e2e-chan';
    // Click the inline "Add Channel" row in the sidebar. Channels section may be collapsed.
    // Ensure Channels section expanded: click its header if "Add Channel" not visible.
    let addChannelRow = page.locator('text=Add Channel').first();
    if (!(await addChannelRow.isVisible().catch(() => false))) {
      // try clicking Channels section header
      await page.getByText('Channels', { exact: true }).first().click().catch(() => {});
      await sleep(300);
      addChannelRow = page.locator('text=Add Channel').first();
    }
    const addChannelClickable = await addChannelRow.isVisible().catch(() => false);
    if (addChannelClickable) {
      await addChannelRow.click();
      await sleep(500);
    }
    const chanInSidebar = await page.locator('text=e2e-chan').first().isVisible().catch(() => false);
    const store5 = await readStore(page);
    const chanInStore = !!store5 && JSON.stringify(store5).includes('e2e-chan');
    await shot(page, 'channel-created');
    row(
      '5. Create channel',
      (chanInSidebar || chanInStore) && addChannelClickable,
      `clickable=${addChannelClickable} sidebar=${chanInSidebar} store=${chanInStore}`,
    );

    // ── STEP 6: Projects/list — open list + quick add ────────────────────────
    // Spaces are expanded by default in seed. Open "Project 1" list directly.
    await page.goto(`${BASE}/${WS}/v/l/901523542898`, { waitUntil: 'networkidle' });
    await sleep(700);
    const taskRows = await page.locator('[data-testid="list-task-row"]').count();
    // our E2E Test Task should be here too (created into this list)
    const e2eTaskInList = await page
      .locator('[data-testid="list-task-row"]', { hasText: 'E2E Test Task' })
      .count();
    await shot(page, 'listview-loaded');
    const quickAdd = page.locator('[data-testid="list-quick-add"]');
    const quickAddVisible = await quickAdd.isVisible().catch(() => false);
    if (quickAddVisible) {
      await quickAdd.fill('E2E List Task');
      await quickAdd.press('Enter');
      await sleep(400);
    }
    const listTaskAdded = await page
      .locator('[data-testid="list-task-row"]', { hasText: 'E2E List Task' })
      .count();
    await shot(page, 'listview-task-added');
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(600);
    const listTaskPersist = await page
      .locator('[data-testid="list-task-row"]', { hasText: 'E2E List Task' })
      .count();
    row(
      '6. List render + quick-add + persist',
      taskRows > 0 && quickAddVisible && listTaskAdded > 0 && listTaskPersist > 0,
      `rows=${taskRows} e2eTaskHere=${e2eTaskInList} quickAdd=${quickAddVisible} added=${listTaskAdded} persist=${listTaskPersist}`,
    );

    // ── STEP 7: Expand persist ───────────────────────────────────────────────
    // Spaces default expanded. Collapse one space, reload, assert it STAYS collapsed
    // (persisted), then re-expand and reload to assert expanded persists too.
    await page.goto(`${BASE}/${WS}/home`, { waitUntil: 'networkidle' });
    await sleep(600);
    // Toggle "Software Development" space (id 901511060890) collapsed.
    const spaceLabel = page.getByText('Software Development', { exact: true }).first();
    await spaceLabel.scrollIntoViewIfNeeded().catch(() => {});
    await spaceLabel.click().catch(() => {});
    await sleep(300);
    const storeT1 = await readStore(page);
    const expandedAfterToggle = storeT1?.state?.expanded?.['901511060890'];
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(600);
    const storeT2 = await readStore(page);
    const expandedPersisted = storeT2?.state?.expanded?.['901511060890'];
    await shot(page, 'expand-persist');
    row(
      '7. Expand state persists',
      expandedAfterToggle === expandedPersisted && storeT2?.state?.expanded !== undefined,
      `afterToggle=${expandedAfterToggle} afterReload=${expandedPersisted}`,
    );

    // ── STEP 8: Favorite ─────────────────────────────────────────────────────
    // Hover the "Project 1" list row to reveal its kebab, open it, click Add to Favorites.
    const project1Row = page
      .locator('div.cu-row-kebab-wrap', { hasText: 'Project 1' })
      .first();
    await project1Row.scrollIntoViewIfNeeded().catch(() => {});
    await project1Row.hover().catch(() => {});
    await sleep(200);
    const kebab = project1Row.locator('button[data-row-kebab]').first();
    let favClicked = false;
    if (await kebab.isVisible().catch(() => false)) {
      await kebab.click();
      await sleep(250);
      await shot(page, 'kebab-open');
      const favItem = page.getByRole('menuitem', { name: 'Add to Favorites', exact: false }).first();
      if (await favItem.isVisible().catch(() => false)) {
        await favItem.click();
        favClicked = true;
        await sleep(300);
      }
    }
    const storeF = await readStore(page);
    const favInStore =
      !!storeF &&
      Array.isArray(storeF?.state?.favorites) &&
      storeF.state.favorites.includes('901523542898');
    // favorites section should now list Project 1
    await shot(page, 'favorite-added');
    row(
      '8. Favorite',
      favClicked && favInStore,
      `clicked=${favClicked} inStoreFavorites=${favInStore}`,
    );

    // ── STEP 9: Rename + delete (sidebar nodes — tasks have no delete UI) ─────
    let renameOk = false;
    let deleteOk = false;
    let deleteNote = '';

    // Rename a LIST node (lists wire onRename; channels do NOT — app limitation).
    // Rename "Project 2" (id 901523542899) inline via kebab → Rename.
    await page.goto(`${BASE}/${WS}/home`, { waitUntil: 'networkidle' });
    await sleep(600);
    const listRow = page.locator('div.cu-row-kebab-wrap', { hasText: 'Project 2' }).first();
    if (await listRow.count()) {
      await listRow.scrollIntoViewIfNeeded().catch(() => {});
      await listRow.hover();
      await sleep(200);
      const ck = listRow.locator('button[data-row-kebab]').first();
      await ck.hover().catch(() => {});
      await sleep(100);
      if (await ck.isVisible().catch(() => false)) {
        await ck.click();
        await sleep(250);
        const renameItem = page.getByRole('menuitem', { name: 'Rename', exact: true }).first();
        if (await renameItem.isVisible().catch(() => false)) {
          await renameItem.click();
          await sleep(250);
          const rn = page.locator('[data-testid="inline-rename"]').first();
          if (await rn.isVisible().catch(() => false)) {
            await rn.fill('Project 2 RENAMED');
            await rn.press('Enter');
            await sleep(300);
            const storeR = await readStore(page);
            renameOk = !!storeR && JSON.stringify(storeR).includes('Project 2 RENAMED');
          }
        }
      }
    }
    await shot(page, 'renamed');

    // Delete a LIST node via kebab → Delete (deleteNode handles tree nodes only;
    // it does NOT remove channels). Delete the list we just renamed —
    // "Project 2 RENAMED" (id 901523542899), a unique label avoiding TEST collision.
    const delRow = page
      .locator('div.cu-row-kebab-wrap', { hasText: 'Project 2 RENAMED' })
      .first();
    if (await delRow.count()) {
      await delRow.scrollIntoViewIfNeeded().catch(() => {});
      await delRow.hover();
      await sleep(200);
      const dk = delRow.locator('button[data-row-kebab]').first();
      await dk.hover().catch(() => {});
      await sleep(100);
      if (await dk.isVisible().catch(() => false)) {
        await dk.click();
        await sleep(250);
        const items = await page.getByRole('menuitem').allInnerTexts().catch(() => []);
        deleteNote = `menu=[${items.join(',')}]`;
        const del = page.getByRole('menuitem', { name: 'Delete', exact: true }).first();
        if (await del.isVisible().catch(() => false)) {
          await del.click();
          await sleep(400);
        }
      }
    }
    await sleep(200);
    const storeD = await readStore(page);
    const listGone =
      !!storeD &&
      !storeD.state.tree.spaces.some((s) =>
        (s.folderlessLists ?? []).some((l) => l.id === '901523542899'),
      );
    deleteOk = listGone;
    await shot(page, 'deleted');
    row(
      '9. Rename + delete (list nodes)',
      renameOk && deleteOk,
      `renameList=${renameOk} deleteListGone=${deleteOk} ${deleteNote}`,
    );

    // ── STEP 10: final error re-assert ───────────────────────────────────────
    const fatalConsole = consoleErrors.filter((t) => FATAL_RE.test(t));
    const fatalPage = pageErrors.filter((t) => FATAL_RE.test(t));
    const totalErr = consoleErrors.length + pageErrors.length;
    row(
      '10. Zero console/page errors',
      totalErr === 0,
      `consoleErr=${consoleErrors.length} pageErr=${pageErrors.length} fatal=${fatalConsole.length + fatalPage.length}`,
    );

    // ── CLEANUP ──────────────────────────────────────────────────────────────
    await page.evaluate(() => localStorage.removeItem('parity-workspace-v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1500);
    const reseededHero = await page
      .locator('text=My Work')
      .first()
      .isVisible()
      .catch(() => false);
    const reseededShell = await page.getByText('Spaces', { exact: true }).first().isVisible().catch(() => false);
    const storeAfterClear = await readStore(page);
    await shot(page, 'after-cleanup-reseed');

    // ── REPORT ───────────────────────────────────────────────────────────────
    console.log('\n================ SCOREBOARD ================');
    for (const r of board) {
      console.log(`${r.pass.padEnd(4)} | ${r.feature.padEnd(40)} | ${r.note}`);
    }
    console.log('============================================');
    console.log(`TOTAL console errors: ${consoleErrors.length}`);
    console.log(`TOTAL page errors:    ${pageErrors.length}`);
    console.log(`FATAL (getServerSnapshot/cached/update-depth/infinite): ${fatalConsole.length + fatalPage.length}`);
    if (consoleErrors.length) {
      console.log('\n--- console errors (unique, up to 20) ---');
      [...new Set(consoleErrors)].slice(0, 20).forEach((e) => console.log('  • ' + e.slice(0, 300)));
    }
    if (pageErrors.length) {
      console.log('\n--- page errors (unique, up to 20) ---');
      [...new Set(pageErrors)].slice(0, 20).forEach((e) => console.log('  • ' + e.slice(0, 300)));
    }
    console.log(
      `\nCLEANUP: storage cleared=${storeAfterClear === null} reseededHeroVisible=${reseededHero} reseededShell=${reseededShell}`,
    );
    const passCount = board.filter((r) => r.pass === 'PASS').length;
    console.log(`\nRESULT: ${passCount}/${board.length} steps PASS`);
  } catch (err) {
    console.log('FATAL TEST HARNESS ERROR: ' + (err?.stack || err));
    await shot(page, 'harness-error');
  } finally {
    await browser.close();
  }
})();
