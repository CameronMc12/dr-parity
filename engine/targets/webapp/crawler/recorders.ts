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
    let bodySize: number | null = null;
    const headers = res.headers();
    const ct = headers['content-type'] ?? '';
    try {
      if (/json|text|xml|javascript|html/i.test(ct)) {
        const buf = await res.body();
        bodySize = buf.byteLength;
        // cap stored body to ~50KB per response
        body = buf.toString('utf8').slice(0, 50_000);
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
      url: res.url(),
      headers,
      body,
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
      cdp.on('Network.webSocketFrameSent', (evt) => {
        writeLine(streams.websocket, {
          capturedAt: nowIso(),
          direction: 'sent',
          requestId: evt.requestId,
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
