import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { BrowserContext, BrowserContextOptions } from 'playwright';
import type { Viewport } from '../browser/viewports';

export type BuildContextArgs = {
  viewport: Viewport;
  outDir: string;
};

export function buildContextOptions({ viewport, outDir }: BuildContextArgs): BrowserContextOptions {
  mkdirSync(join(outDir, 'video'), { recursive: true });
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    recordHar: {
      path: join(outDir, 'network.har'),
      content: 'embed',
      mode: 'full',
    },
    recordVideo: {
      dir: join(outDir, 'video'),
      size: { width: viewport.width, height: viewport.height },
    },
  };
}

export async function startTrace(context: BrowserContext): Promise<void> {
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
    title: 'dr-parity-capture',
  });
}

export async function stopTrace(context: BrowserContext, outDir: string): Promise<void> {
  await context.tracing.stop({ path: join(outDir, 'trace.zip') });
}
