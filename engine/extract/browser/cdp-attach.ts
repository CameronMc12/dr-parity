import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
} from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CDP_URL = 'http://localhost:9222';
const DEFAULT_USER_DATA_DIR = join(homedir(), '.config', 'playwright-pinterest');

export type CaptureMode = 'launch' | 'cdp' | 'persistent';

export interface OpenBrowserOptions {
  mode: CaptureMode;
  headless?: boolean;
  cdpUrl?: string;
  userDataDir?: string;
  probeTimeoutMs?: number;
}

export interface LaunchHandle {
  mode: 'launch';
  browser: Browser;
  newContext: (opts: BrowserContextOptions) => Promise<BrowserContext>;
}

export interface CdpHandle {
  mode: 'cdp';
  browser: Browser;
  existingContext: BrowserContext;
}

export interface PersistentHandle {
  mode: 'persistent';
  context: BrowserContext;
}

export type BrowserHandle = LaunchHandle | CdpHandle | PersistentHandle;

async function probeCdp(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function openLaunch(headless: boolean): Promise<LaunchHandle> {
  const browser = await chromium.launch({ headless });
  return {
    mode: 'launch',
    browser,
    newContext: (opts) => browser.newContext(opts),
  };
}

async function openCdp(cdpUrl: string, probeTimeoutMs: number): Promise<CdpHandle> {
  const versionUrl = `${cdpUrl}/json/version`;
  const live = await probeCdp(versionUrl, probeTimeoutMs);
  if (!live) {
    throw new Error(
      `CDP endpoint not reachable at ${cdpUrl}. Start Image Studio (or another Chrome) with --remote-debugging-port=9222, then retry.`
    );
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error(`Connected to CDP at ${cdpUrl} but no browser context was found.`);
  }
  return { mode: 'cdp', browser, existingContext: contexts[0] };
}

async function openPersistent(userDataDir: string): Promise<PersistentHandle> {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });
  return { mode: 'persistent', context };
}

export async function openBrowser(opts: OpenBrowserOptions): Promise<BrowserHandle> {
  const headless = opts.headless ?? true;
  const cdpUrl = opts.cdpUrl ?? CDP_URL;
  const userDataDir = opts.userDataDir ?? DEFAULT_USER_DATA_DIR;
  const probeTimeoutMs = opts.probeTimeoutMs ?? 2000;

  switch (opts.mode) {
    case 'launch':
      return openLaunch(headless);
    case 'cdp':
      return openCdp(cdpUrl, probeTimeoutMs);
    case 'persistent':
      return openPersistent(userDataDir);
    default: {
      const exhaustive: never = opts.mode;
      throw new Error(`Unknown capture mode: ${String(exhaustive)}`);
    }
  }
}

export async function closeBrowser(handle: BrowserHandle): Promise<void> {
  if (handle.mode === 'launch') {
    try {
      await handle.browser.close();
    } catch (err) {
      console.error('[cdp-attach] failed to close launched browser:', err);
    }
    return;
  }
  if (handle.mode === 'cdp') {
    return;
  }
  try {
    await handle.context.close();
  } catch (err) {
    console.error('[cdp-attach] failed to close persistent context:', err);
  }
}
