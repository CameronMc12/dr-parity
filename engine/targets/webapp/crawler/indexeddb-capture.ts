/**
 * IndexedDB capture for replay seeding.
 *
 * Apps like ClickUp persist auth tokens and cached data in IndexedDB. Without
 * seeding it, the replay target re-fetches or redirects to login. This walks
 * every database for the app origin, reads each object store's records + keys,
 * and returns a serialisable dump. Per-store size is capped so a multi-MB cache
 * store does not bloat storage-state.json; oversized stores are noted as
 * truncated.
 *
 * Fully defensive — runs entirely inside one `page.evaluate`; any failure (no
 * indexedDB, blocked open, structured-clone-unfriendly value) is swallowed and
 * yields a partial/empty result rather than throwing.
 */

import type { Page } from 'playwright';

export type IndexedDbRecord = {
  key: unknown;
  value: unknown;
};

export type IndexedDbStore = {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  recordCount: number;
  /** True when records were capped and not all rows are present. */
  truncated: boolean;
  records: IndexedDbRecord[];
};

export type IndexedDbDatabase = {
  name: string;
  version: number | null;
  stores: IndexedDbStore[];
};

export type IndexedDbSnapshot = {
  origin: string;
  databases: IndexedDbDatabase[];
  /** Populated when enumeration/open partially failed. */
  errors: string[];
};

/** Max records pulled per object store before truncation kicks in. */
const MAX_RECORDS_PER_STORE = 2_000;
/** Max serialised bytes per store before we stop accumulating records. */
const MAX_STORE_BYTES = 2_000_000;

/**
 * Dump all IndexedDB databases for the current page's origin. Returns null only
 * if the evaluate itself throws; otherwise returns a snapshot that may contain
 * partial data plus an `errors` list.
 */
export async function captureIndexedDb(page: Page): Promise<IndexedDbSnapshot | null> {
  const args = JSON.stringify({
    maxRecords: MAX_RECORDS_PER_STORE,
    maxBytes: MAX_STORE_BYTES,
  });

  const script = `(() => new Promise((resolve) => {
    var ARGS = ${args};
    var errors = [];
    var origin = window.location.origin;

    function done(databases) {
      resolve({ origin: origin, databases: databases, errors: errors });
    }

    if (!('indexedDB' in window) || !window.indexedDB) {
      errors.push('indexedDB unavailable');
      done([]);
      return;
    }

    function listDatabases() {
      try {
        if (typeof indexedDB.databases === 'function') {
          return indexedDB.databases();
        }
      } catch (e) {
        errors.push('databases() threw: ' + (e && e.message ? e.message : String(e)));
      }
      return Promise.resolve([]);
    }

    function safeSize(value) {
      try { return JSON.stringify(value).length; } catch (e) { return 0; }
    }

    function readStore(db, storeName) {
      return new Promise(function (res) {
        var store;
        try {
          var tx = db.transaction(storeName, 'readonly');
          store = tx.objectStore(storeName);
        } catch (e) {
          errors.push('tx ' + db.name + '/' + storeName + ': ' + (e && e.message ? e.message : String(e)));
          res(null);
          return;
        }
        var meta = {
          name: storeName,
          keyPath: store.keyPath != null ? store.keyPath : null,
          autoIncrement: !!store.autoIncrement,
          recordCount: 0,
          truncated: false,
          records: []
        };
        var bytes = 0;
        var cursorReq;
        try {
          cursorReq = store.openCursor();
        } catch (e) {
          errors.push('cursor ' + db.name + '/' + storeName + ': ' + (e && e.message ? e.message : String(e)));
          res(meta);
          return;
        }
        cursorReq.onerror = function () { res(meta); };
        cursorReq.onsuccess = function (ev) {
          var cursor = ev.target.result;
          if (!cursor) { res(meta); return; }
          if (meta.records.length >= ARGS.maxRecords || bytes >= ARGS.maxBytes) {
            meta.truncated = true;
            res(meta);
            return;
          }
          var rec;
          try {
            rec = { key: cursor.key, value: cursor.value };
          } catch (e) {
            rec = { key: null, value: null };
          }
          bytes += safeSize(rec.value) + safeSize(rec.key);
          meta.records.push(rec);
          meta.recordCount = meta.records.length;
          try { cursor.continue(); } catch (e) { res(meta); }
        };
      });
    }

    function readDatabase(info) {
      return new Promise(function (res) {
        var name = info && info.name;
        if (!name) { res(null); return; }
        var openReq;
        try {
          openReq = indexedDB.open(name);
        } catch (e) {
          errors.push('open ' + name + ': ' + (e && e.message ? e.message : String(e)));
          res(null);
          return;
        }
        openReq.onerror = function () {
          errors.push('open ' + name + ' errored');
          res(null);
        };
        openReq.onblocked = function () {
          errors.push('open ' + name + ' blocked');
          res(null);
        };
        openReq.onsuccess = function (ev) {
          var db = ev.target.result;
          var storeNames = [];
          try {
            storeNames = Array.prototype.slice.call(db.objectStoreNames);
          } catch (e) {
            errors.push('objectStoreNames ' + name + ': ' + (e && e.message ? e.message : String(e)));
          }
          var chain = Promise.resolve([]);
          storeNames.forEach(function (sn) {
            chain = chain.then(function (acc) {
              return readStore(db, sn).then(function (storeMeta) {
                if (storeMeta) acc.push(storeMeta);
                return acc;
              });
            });
          });
          chain.then(function (stores) {
            try { db.close(); } catch (e) {}
            res({ name: name, version: info.version != null ? info.version : null, stores: stores });
          });
        };
      });
    }

    listDatabases().then(function (infos) {
      var list = Array.isArray(infos) ? infos : [];
      var chain = Promise.resolve([]);
      list.forEach(function (info) {
        chain = chain.then(function (acc) {
          return readDatabase(info).then(function (dbDump) {
            if (dbDump) acc.push(dbDump);
            return acc;
          });
        });
      });
      chain.then(done).catch(function (e) {
        errors.push('walk failed: ' + (e && e.message ? e.message : String(e)));
        done([]);
      });
    }).catch(function (e) {
      errors.push('list failed: ' + (e && e.message ? e.message : String(e)));
      done([]);
    });
  }))()`;

  try {
    const snapshot = (await page.evaluate(script)) as IndexedDbSnapshot | null;
    if (!snapshot) return null;
    return {
      origin: snapshot.origin ?? '',
      databases: Array.isArray(snapshot.databases) ? snapshot.databases : [],
      errors: Array.isArray(snapshot.errors) ? snapshot.errors : [],
    };
  } catch (err) {
    return {
      origin: '',
      databases: [],
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

/** Count total records across all stores for logging. */
export function countIndexedDbRecords(snapshot: IndexedDbSnapshot): {
  databases: number;
  stores: number;
  records: number;
  truncatedStores: number;
} {
  let stores = 0;
  let records = 0;
  let truncatedStores = 0;
  for (const db of snapshot.databases) {
    for (const store of db.stores) {
      stores++;
      records += store.recordCount;
      if (store.truncated) truncatedStores++;
    }
  }
  return { databases: snapshot.databases.length, stores, records, truncatedStores };
}
