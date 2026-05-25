import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import {
  captureIndexedDb,
  countIndexedDbRecords,
  type IndexedDbSnapshot,
} from './indexeddb-capture';

type KeyValue = { name: string; value: string };

type OriginWebStorage = {
  origin: string;
  localStorage: KeyValue[];
  sessionStorage: KeyValue[];
};

type PlaywrightStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * The shape written to `<outDir>/storage-state.json`.
 *
 * `storageState` is Playwright's own `context.storageState()` payload (cookies
 * plus per-origin localStorage). `appOrigin` is an explicit, robust snapshot of
 * the start route's origin storage taken via `page.evaluate`, including
 * sessionStorage, which `storageState()` does NOT cover. The replay boot shim
 * should prefer `appOrigin` for localStorage/sessionStorage and `storageState`
 * for cookies.
 *
 * IndexedDB IS captured (additive `indexedDB` field) so the replay agent can
 * seed databases the app persists auth/cache into. Older consumers ignore the
 * field; it is absent only when capture failed outright.
 */
type ReplayStorageState = {
  capturedAt: string;
  url: string;
  storageState: PlaywrightStorageState;
  appOrigin: OriginWebStorage | null;
  /**
   * Additive. Full IndexedDB dump for the app origin (databases → stores →
   * records). Null when capture failed. Per-store records are capped; oversized
   * stores are flagged `truncated`.
   */
  indexedDB: IndexedDbSnapshot | null;
};

/**
 * Snapshot localStorage + sessionStorage for the current page's origin.
 *
 * Uses a string-script payload (not a function callback) so esbuild's `__name`
 * helper injection cannot break the evaluate — that injection is the reason the
 * function form silently threw and yielded `null` ("0 localStorage, origin
 * unknown") on the persistent ClickUp context. Returns null only on a true
 * evaluate failure; callers fall back to the Playwright storageState origins.
 */
async function snapshotAppOrigin(page: Page): Promise<OriginWebStorage | null> {
  const script = `(() => {
    function dump(store) {
      var out = [];
      for (var i = 0; i < store.length; i++) {
        var name = store.key(i);
        if (name === null) continue;
        var value = store.getItem(name);
        out.push({ name: name, value: value === null ? '' : value });
      }
      return out;
    }
    return {
      origin: window.location.origin,
      localStorage: dump(window.localStorage),
      sessionStorage: dump(window.sessionStorage)
    };
  })()`;
  try {
    const raw = (await page.evaluate(script)) as OriginWebStorage | null;
    if (!raw || typeof raw.origin !== 'string') return null;
    return {
      origin: raw.origin,
      localStorage: Array.isArray(raw.localStorage) ? raw.localStorage : [],
      sessionStorage: Array.isArray(raw.sessionStorage) ? raw.sessionStorage : [],
    };
  } catch {
    return null;
  }
}

/**
 * Recover an `appOrigin` from the Playwright `storageState` when the live
 * `page.evaluate` dump failed. `context.storageState()` reliably captures
 * per-origin localStorage even on a persistent context where the evaluate
 * throws, so this guarantees localStorage still lands in storage-state.json.
 * sessionStorage is NOT covered by storageState, so it stays empty here.
 */
function appOriginFromStorageState(
  storageState: PlaywrightStorageState,
  pageOrigin: string,
): OriginWebStorage | null {
  const match =
    storageState.origins.find((o) => o.origin === pageOrigin) ??
    storageState.origins.find((o) => o.localStorage.length > 0);
  if (!match) return null;
  return {
    origin: match.origin,
    localStorage: match.localStorage.map((kv) => ({ name: kv.name, value: kv.value })),
    sessionStorage: [],
  };
}

/** Best-effort current page origin without throwing. */
function safeOrigin(page: Page): string {
  try {
    return new URL(page.url()).origin;
  } catch {
    return '';
  }
}

/**
 * Fold the live `appOrigin` localStorage into the Playwright `storageState`
 * origins, so a persistent context that returned empty per-origin storage still
 * carries the authenticated localStorage the replay shim seeds from.
 */
function mergeAppOriginIntoStorageState(
  storageState: PlaywrightStorageState,
  appOrigin: OriginWebStorage | null,
): PlaywrightStorageState {
  if (!appOrigin || appOrigin.localStorage.length === 0) return storageState;

  const origins = [...storageState.origins];
  const existing = origins.find((o) => o.origin === appOrigin.origin);
  if (existing && existing.localStorage.length > 0) return storageState;

  const folded = { origin: appOrigin.origin, localStorage: appOrigin.localStorage };
  const next = existing
    ? origins.map((o) => (o.origin === appOrigin.origin ? folded : o))
    : [...origins, folded];
  return { ...storageState, origins: next };
}

/**
 * Capture the browser's persistent client state to `storage-state.json` so the
 * replay target can seed the bundle and boot into the authenticated state
 * instead of redirecting to login.
 *
 * MUST be called AFTER the start route has fully navigated + settled + auth was
 * verified — never on about:blank or pre-navigation, or both sources come back
 * empty. Logs cookie / localStorage counts so an empty dump is obvious.
 */
export async function captureStorageState(
  context: BrowserContext,
  page: Page,
  outDir: string,
): Promise<void> {
  try {
    const rawState = await context.storageState();
    // Prefer the live evaluate dump (it also covers sessionStorage). When that
    // fails on a persistent context — returning null, the "origin unknown" case
    // — fall back to the localStorage Playwright already captured per-origin so
    // the dump still lands instead of logging "0 localStorage".
    const liveAppOrigin = await snapshotAppOrigin(page);
    const appOrigin =
      liveAppOrigin && liveAppOrigin.localStorage.length > 0
        ? liveAppOrigin
        : appOriginFromStorageState(rawState, safeOrigin(page)) ?? liveAppOrigin;
    const storageState = mergeAppOriginIntoStorageState(rawState, appOrigin);
    const indexedDB = await captureIndexedDb(page);

    const payload: ReplayStorageState = {
      capturedAt: new Date().toISOString(),
      url: page.url(),
      storageState,
      appOrigin,
      indexedDB,
    };
    writeFileSync(
      join(outDir, 'storage-state.json'),
      JSON.stringify(payload, null, 2),
      'utf8',
    );

    const cookieCount = storageState.cookies.length;
    const localCount = appOrigin?.localStorage.length ?? 0;
    const sessionCount = appOrigin?.sessionStorage.length ?? 0;
    console.log(
      `[crawl] storage-state : ${cookieCount} cookies, ${localCount} localStorage, ` +
        `${sessionCount} sessionStorage (origin ${appOrigin?.origin ?? 'unknown'})`,
    );
    if (indexedDB) {
      const idb = countIndexedDbRecords(indexedDB);
      console.log(
        `[crawl] indexedDB     : ${idb.databases} databases, ${idb.stores} stores, ` +
          `${idb.records} records` +
          (idb.truncatedStores > 0 ? ` (${idb.truncatedStores} truncated)` : ''),
      );
      if (indexedDB.errors.length > 0) {
        console.warn(`[crawl] indexedDB partial: ${indexedDB.errors.slice(0, 3).join('; ')}`);
      }
    } else {
      console.warn('[crawl] indexedDB     : capture failed (none seeded for replay)');
    }
    if (cookieCount === 0 && localCount === 0) {
      console.warn(
        '[crawl] storage-state EMPTY — replay will boot unauthenticated. ' +
          'Ensure the session is logged in and the dump runs after the start route settles.',
      );
    }
  } catch (err) {
    console.warn(
      `[crawl] storage-state capture failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
