/**
 * Persist the result of `emitRealtime` into a scaffolded webapp project.
 * `emitRealtime` returns code + fixture descriptors but does not touch disk,
 * so the build orchestrator calls this to write `src/mocks/socket.ts` plus
 * each `src/fixtures/ws-*.json`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { EmitRealtimeResult } from './types';

export function writeRealtimeOutputs(outDir: string, result: EmitRealtimeResult): void {
  if (!result.fixture) return;

  const socketPath = join(outDir, 'src', 'mocks', 'socket.ts');
  mkdirSync(dirname(socketPath), { recursive: true });
  writeFileSync(socketPath, result.fixture.socketBootCode, 'utf8');

  for (const file of result.fixture.fixtureFiles) {
    const abs = join(outDir, file.relativePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content, 'utf8');
  }
}
