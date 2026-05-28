/**
 * Emit the inline BOOT shim injected as the first <head> script, BEFORE the
 * app's own bundle. It does four things, in strict order:
 *
 *   1. Seed localStorage / sessionStorage / cookies SYNCHRONOUSLY from the
 *      captured storage state, so the app boots already-authenticated and does
 *      not bounce to a login screen.
 *   2. Recreate captured IndexedDB databases ASYNCHRONOUSLY and AWAIT them all
 *      before continuing, so an app that reads IndexedDB on boot sees its data.
 *   3. Patch `window.WebSocket` to a frame-replaying mock that emits the
 *      captured server->client frames on their recorded offsets, so realtime
 *      UI populates without a live socket.
 *   4. Register the Service Worker and, on the FIRST load where the SW is not
 *      yet controlling the page, reload once so the worker intercepts the
 *      bundle's very first fetch/XHR. This solves boot-ordering: the bundle
 *      always runs under an active interceptor.
 *
 * SEQUENCING (critical): the whole shim runs inside one async IIFE. Steps 1, 3
 * are synchronous. Step 2 is awaited BEFORE the SW register + reload so the
 * guarded reload never races a half-written IndexedDB, and the IndexedDB opens
 * complete before the bundle that follows runs. The WS patch happens before the
 * reload too so a reloaded page still gets the patched constructor early.
 *
 * The WebSocket patch and storage seed are pure inline JS (no deps). WS replay
 * is a tiny self-contained shim rather than `mock-socket` so the emitted site
 * needs no install step and runs under `npx serve`.
 */

import type { ReplayWsConnection, SeededState } from './types';

type BootShimArgs = {
  seeded: SeededState | null;
  wsConnections: ReplayWsConnection[];
  /**
   * Additive. Extra shim source appended verbatim AFTER the core boot shim
   * (storage seed + WS patch + SW register). Used by docFreeze-enabled
   * profiles to inline the doc-freezer shim. Empty/undefined => unchanged.
   */
  extraShimJs?: string;
};

export function buildBootShim(args: BootShimArgs): string {
  const { seeded, wsConnections, extraShimJs } = args;
  const seedJson = JSON.stringify(
    seeded ?? { localStorage: {}, sessionStorage: {}, cookies: [], indexedDB: [] },
  );
  const wsJson = JSON.stringify(wsConnections);

  return `/* dr-parity replay boot shim — runs before the app bundle */
(function () {
  'use strict';

  var SEED = ${seedJson};
  var WS_CONNECTIONS = ${wsJson};

  // 1. Seed storage + cookies synchronously so the app boots authenticated.
  try {
    var ls = SEED.localStorage || {};
    for (var lk in ls) { if (Object.prototype.hasOwnProperty.call(ls, lk)) localStorage.setItem(lk, ls[lk]); }
    var ss = SEED.sessionStorage || {};
    for (var sk in ss) { if (Object.prototype.hasOwnProperty.call(ss, sk)) sessionStorage.setItem(sk, ss[sk]); }
    var cookies = SEED.cookies || [];
    for (var ci = 0; ci < cookies.length; ci++) { document.cookie = cookies[ci] + '; path=/'; }
  } catch (e) { /* storage may be blocked; continue */ }

  // 2. Recreate captured IndexedDB databases. Returns a promise resolved once
  //    every database is open with its records written. Defensive no-op when
  //    SEED.indexedDB is absent (older captures) or IndexedDB is unavailable.
  function seedIndexedDb() {
    var dbs = SEED.indexedDB || [];
    if (!dbs.length || typeof indexedDB === 'undefined') return Promise.resolve();

    function seedOne(spec) {
      return new Promise(function (resolve) {
        var req;
        try {
          req = indexedDB.open(spec.database, spec.version || 1);
        } catch (e) { resolve(); return; }

        // Create object stores on upgrade so keyPath/autoIncrement are honoured.
        req.onupgradeneeded = function (event) {
          var db = event.target.result;
          var stores = spec.stores || [];
          for (var si = 0; si < stores.length; si++) {
            var store = stores[si];
            if (!store || !store.name) continue;
            if (db.objectStoreNames.contains(store.name)) continue;
            var opts = {};
            if (store.keyPath !== null && store.keyPath !== undefined) opts.keyPath = store.keyPath;
            if (store.autoIncrement) opts.autoIncrement = true;
            try { db.createObjectStore(store.name, opts); } catch (e) {}
          }
        };

        req.onerror = function () { resolve(); };
        req.onblocked = function () { resolve(); };

        req.onsuccess = function (event) {
          var db = event.target.result;
          var stores = (spec.stores || []).filter(function (s) {
            return s && s.name && s.records && s.records.length &&
              db.objectStoreNames.contains(s.name);
          });
          if (!stores.length) { try { db.close(); } catch (e) {} resolve(); return; }

          var names = stores.map(function (s) { return s.name; });
          var tx;
          try { tx = db.transaction(names, 'readwrite'); }
          catch (e) { try { db.close(); } catch (e2) {} resolve(); return; }

          tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(); };
          tx.onerror = function () { try { db.close(); } catch (e) {} resolve(); };
          tx.onabort = function () { try { db.close(); } catch (e) {} resolve(); };

          for (var ti = 0; ti < stores.length; ti++) {
            var s = stores[ti];
            var os = tx.objectStore(s.name);
            var inline = s.keyPath !== null && s.keyPath !== undefined;
            for (var ri = 0; ri < s.records.length; ri++) {
              var rec = s.records[ri];
              try {
                if (!inline && rec.key !== undefined) { os.put(rec.value, rec.key); }
                else { os.put(rec.value); }
              } catch (e) { /* skip one bad record, keep going */ }
            }
          }
        };
      });
    }

    var chain = Promise.resolve();
    dbs.forEach(function (spec) {
      chain = chain.then(function () { return seedOne(spec); });
    });
    return chain;
  }

  // 3. Patch WebSocket to replay captured server->client frames.
  if (WS_CONNECTIONS.length > 0 && typeof window.WebSocket !== 'undefined') {
    var NativeWebSocket = window.WebSocket;

    // ClickUp's connectivity manager keys off navigator.onLine + the window
    // 'offline'/'online' events for the SOURCE of its connectivity observable,
    // but the actual gate is a real network probe: it fetches a 1x1 pixel GIF
    // (./media/pixel-EYYJE32I.gif?ngsw-bypass=1&cache-bust=<ts>) via new
    // Image() and only emits "online" when that image's onload fires. The
    // ngsw-bypass=1 query forces the request PAST the service worker, so the
    // replay's SW never serves it and the request 404s -> onerror -> the
    // observable emits false -> NgRx store selector disconnected = true ->
    // the "Offline mode" toast appears. Overriding navigator.onLine alone (as
    // tried before) does NOT help, because the pixel probe runs regardless.
    //
    // Fix every layer of the signal deterministically:
    //   (a) report navigator.onLine = true and swallow the 'offline' event so
    //       the observable SOURCE never emits offline,
    //   (b) intercept the connectivity pixel probe at Image.prototype.src so
    //       it resolves with onload (success), exactly as it would online,
    //       feeding the observable GATE a healthy result. Scoped strictly to
    //       the connectivity pixel; all other images load natively.
    try {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: function () { return true; },
      });
    } catch (e) { /* some engines forbid redefining onLine; continue */ }
    window.addEventListener('offline', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
    // Nudge any listener that already cached an offline state back to online.
    setTimeout(function () {
      try { window.dispatchEvent(new Event('online')); } catch (e) {}
    }, 0);

    // Force the connectivity pixel probe to "load". Match ONLY the connectivity
    // GIF so ordinary <img> loads keep their native behaviour.
    try {
      var ImageProto = window.HTMLImageElement && window.HTMLImageElement.prototype;
      var nativeSrc = ImageProto && Object.getOwnPropertyDescriptor(ImageProto, 'src');
      if (nativeSrc && nativeSrc.set && nativeSrc.configurable) {
        var isConnectivityPixel = function (value) {
          var v = String(value);
          return v.indexOf('pixel-EYYJE32I') !== -1 ||
                 (v.indexOf('/media/pixel-') !== -1 && v.indexOf('ngsw-bypass') !== -1);
        };
        Object.defineProperty(ImageProto, 'src', {
          configurable: true,
          enumerable: nativeSrc.enumerable,
          get: function () { return nativeSrc.get.call(this); },
          set: function (value) {
            if (isConnectivityPixel(value)) {
              var img = this;
              // Mark the probe as a same-size loaded image and fire onload async,
              // mirroring a successful network fetch without touching the network.
              setTimeout(function () {
                try {
                  if (typeof img.onload === 'function') {
                    img.onload({ type: 'load', target: img });
                  }
                  img.dispatchEvent(new Event('load'));
                } catch (e) {}
              }, 0);
              return;
            }
            nativeSrc.set.call(this, value);
          },
        });
      }
    } catch (e) { /* if src is non-configurable, fall back to network behaviour */ }

    function stripQuery(u) { var i = u.indexOf('?'); return i === -1 ? u : u.slice(0, i); }

    function findConnection(url) {
      var bare = stripQuery(String(url));
      for (var i = 0; i < WS_CONNECTIONS.length; i++) {
        var c = WS_CONNECTIONS[i];
        if (c.url === url || c.urlPattern === bare || c.url === bare) return c;
      }
      // Fall back to the first captured connection so realtime still populates.
      return WS_CONNECTIONS[0];
    }

    // Pull the canonical auth/ack frame a connection received, so we can replay
    // its EXACT payload (with user / ws_key / team_id) in response to the app's
    // own auth/connection_init send — rather than a synthetic stub the app's
    // onAuthReceived handler might reject.
    function canonicalFrame(conn, predicate) {
      if (!conn) return null;
      for (var i = 0; i < conn.frames.length; i++) {
        var f = conn.frames[i];
        if (f.direction !== 'received') continue;
        if (predicate(f.payload || '')) return f.payload;
      }
      return null;
    }

    function ReplaySocket(url, protocols) {
      var self = this;
      this.url = String(url);
      this.readyState = 0; // CONNECTING
      this.protocol = (protocols && protocols.length) ? protocols[0] : '';
      this.bufferedAmount = 0;
      this.extensions = '';
      this.binaryType = 'blob';
      this.onopen = null; this.onclose = null; this.onmessage = null; this.onerror = null;
      this._listeners = {};

      var conn = findConnection(this.url);
      this._conn = conn;
      this._authPayload = canonicalFrame(conn, function (p) { return p.indexOf('AuthReceived') !== -1; });
      this._ackPayload = canonicalFrame(conn, function (p) { return p.indexOf('connection_ack') !== -1; });

      setTimeout(function () {
        self.readyState = 1; // OPEN
        self._emit('open', { type: 'open' });
        if (!conn) return;
        for (var fi = 0; fi < conn.frames.length; fi++) {
          (function (frame) {
            if (frame.direction !== 'received') return;
            setTimeout(function () {
              if (self.readyState !== 1) return;
              self._emit('message', { type: 'message', data: frame.payload });
            }, Math.max(0, frame.atMs));
          })(conn.frames[fi]);
        }
      }, 0);
    }

    ReplaySocket.CONNECTING = 0; ReplaySocket.OPEN = 1; ReplaySocket.CLOSING = 2; ReplaySocket.CLOSED = 3;
    ReplaySocket.prototype.CONNECTING = 0; ReplaySocket.prototype.OPEN = 1;
    ReplaySocket.prototype.CLOSING = 2; ReplaySocket.prototype.CLOSED = 3;

    ReplaySocket.prototype._emit = function (type, event) {
      var handler = this['on' + type];
      if (typeof handler === 'function') { try { handler.call(this, event); } catch (e) {} }
      var list = this._listeners[type] || [];
      for (var i = 0; i < list.length; i++) { try { list[i].call(this, event); } catch (e) {} }
    };

    // Reply to the app's liveness probes so its WS service treats this socket as
    // connected indefinitely. Without a reply, the heartbeat watchdog times out,
    // the app closes the socket, handleClose fires, and the "Offline mode" toast
    // appears. We mirror the captured server protocol: heartbeat -> heartbeatReply
    // (echoing the sent message id via reply_to), connection_init -> connection_ack,
    // and any 'ping'/'auth' probe gets an ok ack. Data sends are still swallowed.
    ReplaySocket.prototype.send = function (raw) {
      var self = this;
      var msg = null;
      try { msg = JSON.parse(String(raw)); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;

      function replyRaw(str) {
        if (self.readyState !== 1 || !str) return;
        setTimeout(function () {
          self._emit('message', { type: 'message', data: str });
        }, 0);
      }
      function reply(obj) { replyRaw(JSON.stringify(obj)); }

      // GraphQL-over-WS keep-alive handshake. Prefer the captured connection_ack
      // (carries any payload the app expects); fall back to the protocol stub.
      if (msg.type === 'connection_init') {
        if (self._ackPayload) replyRaw(self._ackPayload);
        else reply({ type: 'connection_ack' });
        return;
      }
      if (msg.type === 'ping') { reply({ type: 'pong' }); return; }

      // ClickUp app-protocol probes.
      if (msg.method === 'heartbeat') {
        reply({ msg: 'heartbeatReply', ok: true, method: 'heartbeat', reply_to: msg.id });
        return;
      }
      if (msg.method === 'auth') {
        // Replay the captured AuthReceived verbatim (real user / ws_key /
        // team_id) so onAuthReceived() runs its full connected path. The app's
        // handler ignores reply_to here and keys off the AuthReceived msg type.
        if (self._authPayload) replyRaw(self._authPayload);
        else reply({ msg: 'AuthReceived', ok: true, method: 'auth', reply_to: msg.id });
        return;
      }
      if (typeof msg.id !== 'undefined' && typeof msg.method === 'string') {
        // Generic ack for projectId / category / subcategory subscriptions so the
        // app's per-id promise resolves rather than hanging.
        reply({ msg: 'ack', ok: true, method: msg.method, reply_to: msg.id });
        return;
      }
      /* other data sends are swallowed */
    };

    // Never propagate a close to the app: a close event triggers ClickUp's
    // handleClose -> setOfflineByWebsocketDisconnect -> "Offline mode" toast.
    // The replay socket stays "open" for the life of the page.
    ReplaySocket.prototype.close = function () { /* no-op: stay connected */ };
    ReplaySocket.prototype.addEventListener = function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    };
    ReplaySocket.prototype.removeEventListener = function (type, fn) {
      var list = this._listeners[type]; if (!list) return;
      this._listeners[type] = list.filter(function (f) { return f !== fn; });
    };
    ReplaySocket.prototype.dispatchEvent = function () { return true; };

    try {
      window.WebSocket = ReplaySocket;
    } catch (e) { window.WebSocket = NativeWebSocket; }
  }

  // 4. Register the Service Worker DETERMINISTICALLY so it controls the page
  //    before the bundle's runtime fetch/XHR + lazy-chunk loads.
  //
  //    The SW calls skipWaiting() on install + clients.claim() on activate, so a
  //    freshly-installed worker takes control of THIS page without a reload.
  //    We await navigator.serviceWorker.ready (resolves once a worker is
  //    active) and then, only if the page is still uncontrolled, do a SINGLE
  //    guarded reload. The sessionStorage guard prevents any reload loop.
  //
  //    sw.js is at the ROOT so its default scope is '/', controlling the whole
  //    origin (page + bundle + /_ext assets). A nested path with { scope: '/' }
  //    would need a Service-Worker-Allowed header that static 'npx serve' never
  //    sends, so root placement is the only reliable fix.
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (navigator.serviceWorker.controller) {
      // Already controlled. Clear the guard so a future hard refresh can reload.
      try { sessionStorage.removeItem('__dr_sw_reloaded'); } catch (e) {}
      return;
    }
    var reloadGuard = '__dr_sw_reloaded';
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller) {
        // claim() already took control — no reload needed.
        try { sessionStorage.removeItem(reloadGuard); } catch (e) {}
        return;
      }
      // Active but not yet controlling this client. One guarded reload makes
      // the next load start under the active worker.
      if (!sessionStorage.getItem(reloadGuard)) {
        sessionStorage.setItem(reloadGuard, '1');
        window.location.reload();
      }
    } catch (e) {
      /* SW unavailable; app may hit network */
    }
  }

  // Orchestrate: IndexedDB seeding (async) MUST finish before we register the
  // SW + do the guarded reload, so the reload never races a half-written DB and
  // the bundle that follows always sees the seeded data. localStorage/cookies
  // (step 1) and the WS patch (step 3) already ran synchronously above.
  (async function () {
    try { await seedIndexedDb(); } catch (e) { /* seeding best-effort */ }
    await registerServiceWorker();
  })();
})();
${extraShimJs ?? ''}`;
}
