import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Response } from 'playwright';

export interface NetworkEntry {
  url: string;
  status: number;
  mimeType: string;
  headers: Record<string, string>;
  bodyBase64: string | null;
  bodyError?: string;
}

export interface NetworkRecorder {
  stop: (outDir: string) => Promise<void>;
}

export function startNetworkRecorder(context: BrowserContext): NetworkRecorder {
  const entries: NetworkEntry[] = [];
  const pending = new Set<Promise<void>>();

  const onResponse = (response: Response): void => {
    const task = (async () => {
      const headers = await response.allHeaders().catch(() => ({}) as Record<string, string>);
      const mimeType = (headers['content-type'] ?? '').split(';')[0].trim();

      let bodyBase64: string | null = null;
      let bodyError: string | undefined;
      try {
        const buf = await response.body();
        bodyBase64 = buf.toString('base64');
      } catch (err) {
        bodyError = err instanceof Error ? err.message : String(err);
      }

      entries.push({
        url: response.url(),
        status: response.status(),
        mimeType,
        headers,
        bodyBase64,
        bodyError,
      });
    })();
    pending.add(task);
    task.finally(() => pending.delete(task));
  };

  context.on('response', onResponse);

  return {
    stop: async (outDir: string) => {
      context.off('response', onResponse);
      await Promise.allSettled(Array.from(pending));
      writeFileSync(
        join(outDir, 'network.json'),
        JSON.stringify({ format: 'dr-parity-network@1', entries }, null, 2)
      );
    },
  };
}
