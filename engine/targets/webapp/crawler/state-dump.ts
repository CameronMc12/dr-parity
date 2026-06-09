/**
 * L2 runtime state-dump for SPA crawls.
 *
 * ClickUp is an Angular shell whose state lives in an NGXS `Store`, plus a
 * React island (`cu-react-app`) with its own redux/zustand/jotai-style store.
 * Both bundles are minified, so the store handles cannot be located statically
 * — they MUST be discovered at runtime by evaluating JS in the live page.
 *
 * `discoverStores(page)` runs four fallback strategies in the page context and
 * stashes whatever it finds on `window.__PARITY__` for cheap re-reads.
 * `dumpState(page)` re-reads the current snapshot from those stashed handles and
 * is safe to call hundreds of times. Both are fully defensive: a missing store,
 * a thrown evaluate, or an absent strategy never throws to the caller.
 *
 * ADDITIVE: this module touches no existing crawler behaviour. It only adds new
 * artifacts (`state.json`) and a one-time discovery call.
 */
import type { Page } from 'playwright';

/** Cap any single serialised string at 50KB; mark the truncation inline. */
const MAX_STRING_BYTES = 50 * 1024;

export type StoreDiscovery = {
  ngxs: boolean;
  react: boolean;
  source: string[];
};

export type StateDump = {
  ngxs?: unknown;
  react?: unknown;
  source: string[];
};

/**
 * In-page discovery script. Runs entirely inside the browser, stashes located
 * store handles on `window.__PARITY__`, and returns a small descriptor of what
 * was found. Written as a self-contained string-IIFE so esbuild's `__name`
 * helper injection cannot corrupt the evaluate (same hazard handled in
 * storage-state.ts), and so it has zero outer-scope dependencies.
 *
 * Each strategy is wrapped in its own try/catch: one failing strategy never
 * aborts the others.
 */
const DISCOVER_SCRIPT = `(() => {
  var W = window;
  W.__PARITY__ = W.__PARITY__ || {};
  var P = W.__PARITY__;
  var source = [];

  function looksLikeNgxs(obj) {
    return !!obj && typeof obj.snapshot === 'function' &&
      (typeof obj.selectSnapshot === 'function' || !!obj._stateStream);
  }
  function looksLikeReduxish(obj) {
    return !!obj && typeof obj.getState === 'function';
  }

  // (a) NGXS via Angular debug / injector.
  try {
    var roots = [];
    if (typeof W.getAllAngularRootElements === 'function') {
      roots = W.getAllAngularRootElements() || [];
    }
    if (!roots.length) {
      var candidate = document.querySelector('[ng-version], app-root, cu-app, body > *');
      if (candidate) roots = [candidate];
    }
    var injector = null;
    for (var i = 0; i < roots.length && !injector; i++) {
      var el = roots[i];
      if (W.ng && typeof W.ng.getInjector === 'function') {
        try { injector = W.ng.getInjector(el); } catch (e) {}
      }
      if (!injector) {
        var ctx = el && el.__ngContext__;
        if (ctx) {
          // __ngContext__ is an LView array; scan its entries for an injector.
          var arr = Array.isArray(ctx) ? ctx : [ctx];
          for (var j = 0; j < arr.length && !injector; j++) {
            var c = arr[j];
            if (c && typeof c.get === 'function') injector = c;
          }
        }
      }
    }
    if (injector && typeof injector.get === 'function') {
      // Resolve NGXS Store by duck-typing common provider tokens, then verify.
      var store = null;
      var tokenNames = ['Store', 'NgxsStore'];
      for (var t = 0; t < tokenNames.length && !store; t++) {
        try {
          var maybe = injector.get(tokenNames[t], null);
          if (looksLikeNgxs(maybe)) store = maybe;
        } catch (e) {}
      }
      if (store) {
        P.ngxsStore = store;
        source.push('angular-injector');
      }
    }
  } catch (e) {}

  // (b) React island fiber walk. NOTE: the cu-react-app custom element itself
  // carries NO __reactFiber$ key in ClickUp's prod build — the fibers live on
  // its child DIVs. So we (1) pick a fiber-bearing element inside the react
  // island (or anywhere, as a fallback) and (2) walk return/child/sibling
  // collecting EVERY distinct getState-store on memoizedProps/memoizedState,
  // because the island has several stores. The richest (most state keys) wins
  // as the primary handle; all are stashed on P.reactStores for completeness.
  try {
    function findFiber(el) {
      if (!el) return null;
      for (var fk in el) {
        if (fk.indexOf('__reactFiber$') === 0 || fk.indexOf('__reactContainer$') === 0) {
          return el[fk];
        }
      }
      return null;
    }
    // Collect SEED fibers from many fiber-bearing elements. ClickUp's island
    // renders multiple disjoint React roots/portals (~600 fiber-bearing DOM
    // nodes), so walking one fiber's tree misses the rest. We sample fibers
    // across the island (capped) and walk each, deduping stores globally.
    var seeds = [];
    var island = document.querySelector('cu-react-app');
    var direct = findFiber(island);
    if (direct) seeds.push(direct);
    var pool = (island || document.body).querySelectorAll('*');
    for (var s = 0; s < pool.length && seeds.length < 60; s++) {
      var sf = findFiber(pool[s]);
      if (sf) seeds.push(sf);
    }

    if (seeds.length) {
      var collected = [];
      var seenStores = new WeakSet();
      var seenFibers = new WeakSet();
      var visited = 0;
      function consider(candidate) {
        if (looksLikeReduxish(candidate) && !seenStores.has(candidate)) {
          seenStores.add(candidate);
          collected.push(candidate);
        }
      }
      var stack = seeds.slice();
      while (stack.length && visited < 40000) {
        var f = stack.pop(); visited++;
        if (!f || typeof f !== 'object' || seenFibers.has(f)) continue;
        seenFibers.add(f);
        var probes = [f.memoizedProps, f.memoizedState, f.stateNode];
        for (var p = 0; p < probes.length; p++) {
          var pr = probes[p];
          if (pr && typeof pr === 'object') {
            consider(pr.store);
            consider(pr);
            // dependencies (useContext) often hold the provider store value.
            try {
              var dep = pr.value;
              if (dep) { consider(dep.store); consider(dep); }
            } catch (e) {}
          }
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
        if (f.return) stack.push(f.return);
      }
      if (collected.length) {
        // Rank by number of top-level state keys; richest store becomes primary.
        function keyCount(s) {
          try { var st = s.getState(); return st && typeof st === 'object' ? Object.keys(st).length : 0; }
          catch (e) { return 0; }
        }
        collected.sort(function (a, b) { return keyCount(b) - keyCount(a); });
        P.reactStore = collected[0];
        P.reactStores = collected;
        source.push('react-fiber:' + collected.length);
      }
    }
  } catch (e) {}

  // (c) Redux devtools fallback.
  try {
    if (!P.reactStore) {
      var ext = W.__REDUX_DEVTOOLS_EXTENSION__;
      if (ext) {
        var conns = ext.connections || ext._connections || null;
        if (conns) {
          var list = Array.isArray(conns) ? conns : Object.keys(conns).map(function (n) { return conns[n]; });
          for (var c2 = 0; c2 < list.length; c2++) {
            var conn = list[c2];
            if (conn && looksLikeReduxish(conn.store)) { P.reactStore = conn.store; source.push('redux-devtools'); break; }
          }
        }
      }
    }
  } catch (e) {}

  // (d) Generic window scan for getState / NGXS-like handles.
  try {
    var names = Object.getOwnPropertyNames(W);
    for (var w = 0; w < names.length; w++) {
      var nm = names[w];
      var val;
      try { val = W[nm]; } catch (e) { continue; }
      if (!val || typeof val !== 'object') continue;
      if (!P.reactStore && looksLikeReduxish(val)) { P.reactStore = val; source.push('window:' + nm); }
      if (!P.ngxsStore && looksLikeNgxs(val)) { P.ngxsStore = val; source.push('window:' + nm + '(ngxs)'); }
      if (P.reactStore && P.ngxsStore) break;
    }
  } catch (e) {}

  return { ngxs: !!P.ngxsStore, react: !!P.reactStore, source: source };
})()`;

/**
 * Read script: pulls a current snapshot from the stashed handles. NGXS exposes
 * `.snapshot()`; redux-ish stores expose `.getState()`. Serialisation is done
 * in-page with a circular-safe replacer and a 50KB per-string cap so the payload
 * crossing the CDP bridge stays bounded even for huge app states.
 */
const DUMP_SCRIPT = `(() => {
  var P = (window.__PARITY__ = window.__PARITY__ || {});
  var MAX = ${MAX_STRING_BYTES};
  var source = [];

  function safeStringify(obj) {
    var seen = new WeakSet();
    return JSON.stringify(obj, function (key, value) {
      if (typeof value === 'string' && value.length > MAX) {
        return value.slice(0, MAX) + '…[truncated ' + (value.length - MAX) + ' chars]';
      }
      if (typeof value === 'function') return '[Function]';
      if (typeof value === 'bigint') return value.toString();
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  }
  function snapshotOf(store, kind) {
    try {
      var snap = kind === 'ngxs' ? store.snapshot() : store.getState();
      return JSON.parse(safeStringify(snap));
    } catch (e) {
      return { __error: String(e && e.message ? e.message : e) };
    }
  }

  var out = { ngxs: undefined, react: undefined };
  if (P.ngxsStore) { out.ngxs = snapshotOf(P.ngxsStore, 'ngxs'); source.push('ngxs'); }

  // React: merge EVERY discovered island store under its own slot so a small
  // helper store (e.g. gantt) never masks a richer one. Keys are deduped by
  // their state shape; the richest store also fills the top-level for callers
  // that only read one. Falls back to the single primary handle.
  if (P.reactStores && P.reactStores.length > 1) {
    var merged = {};
    for (var i = 0; i < P.reactStores.length; i++) {
      var snap = snapshotOf(P.reactStores[i], 'react');
      var slot = 'store' + i;
      try {
        var ks = snap && typeof snap === 'object' ? Object.keys(snap).slice(0, 3).join('_') : '';
        if (ks) slot = ks;
      } catch (e) {}
      merged[slot] = snap;
    }
    out.react = merged;
    source.push('react:' + P.reactStores.length);
  } else if (P.reactStore) {
    out.react = snapshotOf(P.reactStore, 'react');
    source.push('react');
  }
  out.source = source;
  return out;
})()`;

/**
 * Locate the NGXS store and/or the React island store in the live page and stash
 * references on `window.__PARITY__`. Idempotent: re-running re-discovers any
 * store that was lost to an SPA re-render. Never throws.
 */
export async function discoverStores(page: Page): Promise<StoreDiscovery> {
  try {
    const result = (await page.evaluate(DISCOVER_SCRIPT)) as StoreDiscovery;
    return {
      ngxs: !!result?.ngxs,
      react: !!result?.react,
      source: Array.isArray(result?.source) ? result.source : [],
    };
  } catch (err) {
    return { ngxs: false, react: false, source: [`discover-failed:${errMsg(err)}`] };
  }
}

/** True when `window.__PARITY__` currently holds at least one store handle. */
const HAS_HANDLES_SCRIPT = `(() => {
  var P = window.__PARITY__;
  return !!(P && (P.ngxsStore || P.reactStore || (P.reactStores && P.reactStores.length)));
})()`;

/**
 * Re-read the current snapshot from the stashed store handles. Returns null
 * sections when a store was never found. Safe to call hundreds of times. Never
 * throws — a failed read yields `{ source: [] }`.
 *
 * SELF-HEALING: ClickUp is an SPA. Every full navigation (and many in-place
 * re-renders) destroys `window.__PARITY__`, so handles discovered once at crawl
 * start are GONE by the time later per-state captures run. Before each dump we
 * cheaply check whether handles still exist and, if not, re-run discovery in the
 * live page. This is what makes a `state.json` land on every captured state
 * instead of only the very first one. Discovery is idempotent and guarded.
 */
export async function dumpState(page: Page): Promise<StateDump> {
  try {
    let hasHandles = false;
    try {
      hasHandles = Boolean(await page.evaluate(HAS_HANDLES_SCRIPT));
    } catch {
      hasHandles = false;
    }
    if (!hasHandles) {
      await discoverStores(page);
    }
    const result = (await page.evaluate(DUMP_SCRIPT)) as StateDump;
    return {
      ngxs: result?.ngxs,
      react: result?.react,
      source: Array.isArray(result?.source) ? result.source : [],
    };
  } catch (err) {
    return { source: [`dump-failed:${errMsg(err)}`] };
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
