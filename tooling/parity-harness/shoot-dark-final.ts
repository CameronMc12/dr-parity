import { chromium, Page } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:4280";
const OUT = join(
  process.cwd(),
  "output",
  "dark-final-verify-2026-06-01"
);
mkdirSync(OUT, { recursive: true });

const VP = { width: 1440, height: 900 };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot:", name);
}

async function goto(page: Page, path: string) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // Job 1 — list view
  await goto(page, "/90152566819/v/l/2kyr6013-2255");
  await shot(page, "01-listview-project1");

  // Job 2 — surfaces
  await goto(page, "/home");
  await shot(page, "02-home-dashboard");

  // open + create menu (top-left "+" New / Add)
  const plusSelectors = [
    'button[aria-label*="reate" i]',
    'button[title*="reate" i]',
    'button:has-text("New")',
    'button:has-text("Create")',
    '[data-test*="create" i]',
  ];
  let openedPlus = false;
  for (const sel of plusSelectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
      // heuristic: did a menu/overlay appear?
      const overlay = await page.locator('[role="menu"], [role="dialog"], .menu, [class*="popover" i]').count().catch(() => 0);
      if (overlay) { openedPlus = true; break; }
    }
  }
  await shot(page, "03-create-menu");

  // Create Task modal — try clicking a "Task" entry in the menu, else "Add Task"
  let modalOpened = false;
  const taskEntry = page.locator('[role="menuitem"]:has-text("Task"), li:has-text("Task"), button:has-text("Task")').first();
  if (await taskEntry.count().catch(() => 0)) {
    await taskEntry.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
    modalOpened = (await page.locator('[role="dialog"]').count().catch(() => 0)) > 0;
  }
  if (!modalOpened) {
    // fallback: go to list and use Add Task
    await goto(page, "/90152566819/v/l/2kyr6013-2255");
    const addTask = page.locator('button:has-text("Add Task")').first();
    if (await addTask.count().catch(() => 0)) {
      await addTask.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  await shot(page, "04-create-task-modal");
  // close any modal
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  await goto(page, "/inbox");
  await shot(page, "05-inbox");

  await goto(page, "/chat/r/ch-demo");
  await shot(page, "06-chat-channel");

  await goto(page, "/my-work");
  await shot(page, "07-my-work");

  // sidebar row context (⋯) menu — hover a sidebar project row then click its ... button
  await goto(page, "/home");
  const sidebarRow = page.locator('text=Project 1').first();
  if (await sidebarRow.count().catch(() => 0)) {
    await sidebarRow.hover().catch(() => {});
    await page.waitForTimeout(300);
  }
  const ctxBtns = [
    'button[aria-label*="ettings" i]',
    'button[aria-label*="more" i]',
    'button[title*="more" i]',
    'button:has-text("⋯")',
    'button:has-text("...")',
  ];
  let ctxOpened = false;
  for (const sel of ctxBtns) {
    const el = page.locator(sel);
    const n = await el.count().catch(() => 0);
    if (n) {
      // click one near a sidebar project
      await el.last().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(500);
      if ((await page.locator('[role="menu"], [class*="popover" i], .menu').count().catch(() => 0)) > 0) { ctxOpened = true; break; }
    }
  }
  await shot(page, "08-sidebar-context-menu");
  await page.keyboard.press("Escape").catch(() => {});

  await goto(page, "/90152566819/settings/account");
  await shot(page, "09-settings-account");

  await browser.close();
  console.log("DONE ->", OUT);
}

run().catch((e) => { console.error(e); process.exit(1); });
