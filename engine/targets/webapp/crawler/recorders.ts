import { createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'playwright';

type Streams = {
  network: WriteStream;
  websocket: WriteStream;
  console: WriteStream;
  errors: WriteStream;
};

export type Recorders = {
  attachToPage(page: Page): Promise<void>;
  writeError(payload: unknown): void;
  close(): Promise<void>;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** Non-asset bodies (API/JSON/etc) are capped at this many bytes before encoding. */
const NON_ASSET_BODY_CAP = 300_000;

const BINARY_EXTENSIONS = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.wasm',
]);

const TEXT_ASSET_EXTENSIONS = new Set(['.css', '.svg', '.html', '.htm']);

// JS bundles and source maps are never used by the clone (verbatim-body strips
// <script>) or the mock layer (only API JSON matters). Capturing their full
// multi-MB bodies is pure bloat, so we record the metadata and omit the body.
const STRIPPED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.map']);
const STRIPPED_CT_EXACT = new Set([
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/json+sourcemap',
]);

const BINARY_CT_PREFIXES = ['font/', 'image/'];
const BINARY_CT_EXACT = new Set([
  'application/wasm',
  'application/octet-stream',
  'application/vnd.ms-fontobject',
]);

const TEXT_ASSET_CT_EXACT = new Set([
  'text/css',
  'text/html',
  'image/svg+xml',
]);

type BodyClass = 'binary' | 'text' | 'stripped' | 'other';

function extOfUrl(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/)[0];
  }
  const lastSeg = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = lastSeg.lastIndexOf('.');
  return dot < 0 ? '' : lastSeg.slice(dot).toLowerCase();
}

/** Classify a response body by content-type first, then URL extension. */
function classifyBody(contentType: string, url: string): BodyClass {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  const ext = extOfUrl(url);

  // JS bundles and source maps are stripped regardless of how they declare
  // themselves (a .map often arrives as application/json).
  if (STRIPPED_CT_EXACT.has(ct) || STRIPPED_EXTENSIONS.has(ext)) return 'stripped';

  if (BINARY_CT_EXACT.has(ct) || BINARY_CT_PREFIXES.some((p) => ct.startsWith(p))) {
    return 'binary';
  }
  if (TEXT_ASSET_CT_EXACT.has(ct)) return 'text';

  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  if (TEXT_ASSET_EXTENSIONS.has(ext)) return 'text';
  return 'other';
}

export async function startRecorders(
  context: BrowserContext,
  outDir: string,
): Promise<Recorders> {
  const streams: Streams = {
    network: createWriteStream(join(outDir, 'network.jsonl'), { flags: 'a' }),
    websocket: createWriteStream(join(outDir, 'websocket.jsonl'), { flags: 'a' }),
    console: createWriteStream(join(outDir, 'console.jsonl'), { flags: 'a' }),
    errors: createWriteStream(join(outDir, 'errors.jsonl'), { flags: 'a' }),
  };

  const writeLine = (stream: WriteStream, payload: unknown): void => {
    try {
      stream.write(`${JSON.stringify(payload)}\n`);
    } catch {
      // best-effort
    }
  };

  // HTTP/XHR/fetch via context-level events.
  context.on('request', (req) => {
    writeLine(streams.network, {
      kind: 'request',
      capturedAt: nowIso(),
      method: req.method(),
      url: req.url(),
      resourceType: req.resourceType(),
      headers: req.headers(),
      postData: req.postData() ?? null,
    });
  });

  context.on('response', async (res) => {
    let body: string | null = null;
    let bodyEncoding: 'utf8' | 'base64' = 'utf8';
    let bodySize: number | null = null;
    const headers = res.headers();
    const ct = headers['content-type'] ?? '';
    const url = res.url();
    const bodyClass = classifyBody(ct, url);
    try {
      if (bodyClass === 'binary') {
        // Binary assets (fonts/images/wasm): capture full, store base64-safe.
        const buf = await res.body();
        bodySize = buf.byteLength;
        body = buf.toString('base64');
        bodyEncoding = 'base64';
      } else if (bodyClass === 'text') {
        // Text assets (css/svg/html): capture full, no truncation.
        const buf = await res.body();
        bodySize = buf.byteLength;
        body = buf.toString('utf8');
      } else if (bodyClass === 'stripped') {
        // JS bundles + source maps: record size only, omit the body. Neither
        // the clone nor the mock layer reads JS file contents.
        bodySize = Number(headers['content-length'] ?? 0) || null;
      } else if (/json|text|xml|html/i.test(ct)) {
        // Other textual bodies (API/JSON): cap the BUFFER before decoding.
        const buf = await res.body();
        bodySize = buf.byteLength;
        body = buf.subarray(0, NON_ASSET_BODY_CAP).toString('utf8');
      } else {
        bodySize = Number(headers['content-length'] ?? 0) || null;
      }
    } catch {
      body = null;
    }
    writeLine(streams.network, {
      kind: 'response',
      capturedAt: nowIso(),
      status: res.status(),
      url,
      headers,
      body,
      bodyEncoding,
      bodySize,
    });
  });

  const cdpAttached = new WeakSet<Page>();

  const attachToPage = async (page: Page): Promise<void> => {
    page.on('console', (msg) => {
      writeLine(streams.console, {
        capturedAt: nowIso(),
        type: msg.type(),
        text: msg.text(),
        url: page.url(),
      });
    });
    page.on('pageerror', (err) => {
      writeLine(streams.errors, {
        capturedAt: nowIso(),
        kind: 'pageerror',
        message: err.message,
        stack: err.stack ?? null,
        url: page.url(),
      });
    });

    if (cdpAttached.has(page)) return;
    cdpAttached.add(page);

    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');

      // Track the connection URL per requestId so every frame can be
      // attributed to its socket endpoint during replay emit.
      const urlByRequestId = new Map<string, string>();

      cdp.on('Network.webSocketCreated', (evt) => {
        urlByRequestId.set(evt.requestId, evt.url);
        // Persist a `created` marker so the emit loader can join frames
        // to their URL even if a frame line lacks one.
        writeLine(streams.websocket, {
          kind: 'created',
          capturedAt: nowIso(),
          requestId: evt.requestId,
          url: evt.url,
        });
      });
      cdp.on('Network.webSocketFrameSent', (evt) => {
        writeLine(streams.websocket, {
          capturedAt: nowIso(),
          direction: 'sent',
          requestId: evt.requestId,
          url: urlByRequestId.get(evt.requestId) ?? null,
          timestamp: evt.timestamp,
          opcode: evt.response.opcode,
          payloadData: evt.response.payloadData.slice(0, 10_000),
        });
      });
      cdp.on('Network.webSocketFrameReceived', (evt) => {
        writeLine(streams.websocket, {
          capturedAt: nowIso(),
          direction: 'received',
          requestId: evt.requestId,
          url: urlByRequestId.get(evt.requestId) ?? null,
          timestamp: evt.timestamp,
          opcode: evt.response.opcode,
          payloadData: evt.response.payloadData.slice(0, 10_000),
        });
      });
    } catch (err) {
      writeLine(streams.errors, {
        capturedAt: nowIso(),
        kind: 'cdp-attach-failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  context.on('page', (page) => {
    void attachToPage(page);
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => streams.network.end(() => resolve()));
    await new Promise<void>((resolve) => streams.websocket.end(() => resolve()));
    await new Promise<void>((resolve) => streams.console.end(() => resolve()));
    await new Promise<void>((resolve) => streams.errors.end(() => resolve()));
  };

  return {
    attachToPage,
    writeError(payload) {
      writeLine(streams.errors, { capturedAt: nowIso(), ...((payload as object) ?? {}) });
    },
    close,
  };
}
