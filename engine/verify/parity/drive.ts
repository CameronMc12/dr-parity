/**
 * Drives reference and candidate through the same states/requests via
 * Playwright. Both sides use the SW-controller wait + reload + settle pattern
 * so a service-worker-backed candidate (the replay clone) serves recorded
 * traffic before we measure.
 *
 * For every state we collect: a primary screenshot, a second reference-side
 * screenshot for the non-determinism mask, a normalized DOM signature, and the
 * network responses observed during load (for the API avenue).
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext, Page, Response } from 'playwright';
import { captureDomSignature } from '../dom-signature';
import type { ParityState, StateInteraction } from './state-spec';

const NAV_TIMEOUT_MS = 30_000;
const SW_CONTROLLER_TIMEOUT_MS = 12_000;
const SETTLE_DELAY_MS = 2_500;
const INTERACTION_TIMEOUT_MS = 5_000;

/** A captured network response, trimmed for shape comparison. */
export type ObservedResponse = {
  /** METHOD + normalized path key, used to pair reference vs candidate. */
  key: string;
  method: string;
  url: string;
  status: number;
  contentType: string;
  /** Parsed JSON body when content-type is JSON; else undefined. */
  json?: unknown;
};

export type CapturedState = {
  stateId: string;
  /** "base" or the interaction label. */
  state: string;
  /** Primary screenshot path. */
  shot: string;
  /** Second screenshot (reference only; '' on candidate). */
  shotB: string;
  signature: string[];
  responses: ObservedResponse[];
  ok: boolean;
  notes: string[];
};

export type DriveSide = 'reference' | 'candidate';

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/** Normalize a request path so volatile id segments do not break pairing. */
function requestKey(method: string, url: string): string {
  let pathname = url;
  let origin = '';
  try {
    const u = new URL(url);
    pathname = u.pathname;
    origin = u.host;
  } catch {
    /* keep raw */
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const segs = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => (UUID.test(s) || /^[0-9]+$|^[0-9a-f]{8,}$/i.test(s) ? '*' : s));
  return `${method.toUpperCase()} ${origin}/${segs.join('/')}`;
}

function isJsonContentType(ct: string): boolean {
  return /\bjson\b/i.test(ct);
}

/**
 * Wait until the page is controlled by its service worker, then reload once so
 * the controlled load is what we measure. No-op when no SW is registered
 * (reference side, or a candidate without a SW) — resolves on timeout.
 */
async function waitForSwControllerAndReload(page: Page): Promise<boolean> {
  let controlled = false;
  try {
    controlled = await page.evaluate(
      (timeoutMs: number) =>
        new Promise<boolean>((resolve) => {
          const nav = navigator as Navigator & { serviceWorker?: ServiceWorkerContainer };
          if (!nav.serviceWorker) {
            resolve(false);
            return;
          }
          if (nav.serviceWorker.controller) {
            resolve(true);
            return;
          }
          const timer = setTimeout(() => resolve(false), timeoutMs);
          nav.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              clearTimeout(timer);
              resolve(true);
            },
            { once: true },
          );
        }),
      SW_CONTROLLER_TIMEOUT_MS,
    );
  } catch {
    controlled = false;
  }
  if (controlled) {
    try {
      await page.reload({ waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    } catch {
      /* tolerate networkidle timeout; settle below */
    }
  }
  return controlled;
}

async function attachResponseCollector(page: Page): Promise<ObservedResponse[]> {
  const responses: ObservedResponse[] = [];
  page.on('response', (resp: Response) => {
    void (async () => {
      try {
        const req = resp.request();
        const url = resp.url();
        const method = req.method();
        const status = resp.status();
        const headers = resp.headers();
        const contentType = headers['content-type'] ?? '';
        const entry: ObservedResponse = {
          key: requestKey(method, url),
          method,
          url,
          status,
          contentType,
        };
        if (isJsonContentType(contentType)) {
          try {
            entry.json = await resp.json();
          } catch {
            /* non-parseable JSON; leave undefined */
          }
        }
        responses.push(entry);
      } catch {
        /* response collection is best-effort */
      }
    })();
  });
  return responses;
}

async function loadAndSettle(page: Page, url: string): Promise<{ ok: boolean; note?: string }> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Timeout/i.test(msg)) {
      return { ok: false, note: `load failed: ${msg}` };
    }
  }
  await waitForSwControllerAndReload(page);
  await page.waitForTimeout(SETTLE_DELAY_MS);
  return { ok: true };
}

async function performInteraction(
  page: Page,
  interaction: StateInteraction,
): Promise<{ performed: boolean; note?: string }> {
  const locator = page.locator(interaction.selector).first();
  try {
    if ((await locator.count()) === 0) {
      return { performed: false, note: `selector not found: ${interaction.selector}` };
    }
    if (interaction.kind === 'hover') {
      await locator.hover({ timeout: INTERACTION_TIMEOUT_MS });
    } else {
      await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { performed: false, note: `interaction failed: ${msg}` };
  }
  await page.waitForTimeout(SETTLE_DELAY_MS);
  return { performed: true };
}

export type DriveStateDeps = {
  ctx: BrowserContext;
  side: DriveSide;
  base: string;
  /** Output dir for screenshots: <outDir>/<side>/<stateId>/<state>.png */
  outDir: string;
  /** When false, skip the second screenshot (candidate side). */
  captureMaskShot: boolean;
};

/**
 * Drive one ParityState (base + each interaction) on one side, returning a
 * CapturedState per state. Fresh page per state so service-worker control and
 * response collection are clean.
 */
export async function driveState(
  state: ParityState,
  deps: DriveStateDeps,
): Promise<CapturedState[]> {
  const { ctx, side, base, outDir, captureMaskShot } = deps;
  const url = joinUrl(base, state.path);
  const stateDir = join(outDir, side, state.id);
  await mkdir(stateDir, { recursive: true });

  const captured: CapturedState[] = [];

  captured.push(await captureOne(ctx, url, state, 'base', null, stateDir, side, captureMaskShot));

  for (const interaction of state.interactions) {
    captured.push(
      await captureOne(ctx, url, state, interaction.label, interaction, stateDir, side, captureMaskShot),
    );
  }

  return captured;
}

async function captureOne(
  ctx: BrowserContext,
  url: string,
  state: ParityState,
  stateLabel: string,
  interaction: StateInteraction | null,
  stateDir: string,
  side: DriveSide,
  captureMaskShot: boolean,
): Promise<CapturedState> {
  const notes: string[] = [];
  const page = await ctx.newPage();
  const responses = await attachResponseCollector(page);
  const shot = join(stateDir, `${stateLabel}.png`);
  const shotB = captureMaskShot ? join(stateDir, `${stateLabel}-b.png`) : '';
  let ok = true;
  let signature: string[] = [];

  try {
    const load = await loadAndSettle(page, url);
    if (!load.ok) {
      ok = false;
      if (load.note) notes.push(`${side} ${load.note}`);
    }
    if (interaction) {
      const result = await performInteraction(page, interaction);
      if (!result.performed && result.note) notes.push(`${side} ${result.note}`);
    }
    signature = await captureDomSignature(page);
    await page.screenshot({ path: shot, fullPage: true });
    if (captureMaskShot) {
      // Second settle pass for the non-determinism mask.
      await page.waitForTimeout(800);
      await page.screenshot({ path: shotB, fullPage: true });
    }
  } catch (err) {
    ok = false;
    notes.push(`${side} capture error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await page.close().catch(() => {});
  }

  return {
    stateId: state.id,
    state: stateLabel,
    shot,
    shotB,
    signature,
    responses: responses.slice(),
    ok,
    notes,
  };
}
