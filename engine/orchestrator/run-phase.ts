/**
 * Phase execution: spawns child processes for npm-script phases and
 * runs inline executors, streaming output live with a phase prefix.
 */

import { spawn } from 'node:child_process';

import type {
  OrchestratorContext,
  PhaseDefinition,
  PhaseResult,
} from './types';

const PHASE_HEADER = '▶';
const SUCCESS_MARK = '✓';
const FAIL_MARK = '✗';
const WARN_MARK = '⚠';
const SKIP_MARK = '↻';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m${secs}s`;
}

function prefixLines(prefix: string, chunk: Buffer | string, stream: NodeJS.WriteStream): void {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  const lines = text.split('\n');
  const trailing = lines[lines.length - 1] === '';
  const usable = trailing ? lines.slice(0, -1) : lines;
  for (const line of usable) {
    stream.write(`  [${prefix}] ${line}\n`);
  }
}

function spawnPhase(
  phase: PhaseDefinition,
  signal: AbortSignal,
): Promise<{ code: number; stderr: string }> {
  if (!phase.command) {
    return Promise.reject(new Error(`Phase ${phase.id} has no command and no inline executor`));
  }
  const { cmd, args, cwd } = phase.command;
  return new Promise((resolveSpawn, rejectSpawn) => {
    let stderrBuffer = '';
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      prefixLines(phase.slug, chunk, process.stdout);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf8');
      prefixLines(phase.slug, chunk, process.stderr);
    });
    child.on('error', (err) => {
      rejectSpawn(err);
    });
    child.on('close', (code) => {
      resolveSpawn({ code: code ?? 1, stderr: stderrBuffer });
    });
  });
}

export async function runPhase(
  phase: PhaseDefinition,
  ctx: OrchestratorContext,
): Promise<PhaseResult> {
  const isSkipped = ctx.skip.has(phase.id);
  const modeMismatch = phase.requiresMode !== undefined && phase.requiresMode !== ctx.mode;
  const headerNumbers = `Phase ${phase.id}/10`;
  const start = Date.now();

  if (isSkipped) {
    process.stdout.write(`\n${SKIP_MARK} ${headerNumbers}: ${phase.label} (skipped)\n`);
    return {
      id: phase.id,
      slug: phase.slug,
      label: phase.label,
      status: 'skipped',
      durationMs: 0,
      outputs: [],
    };
  }

  if (modeMismatch) {
    process.stdout.write(
      `\n${SKIP_MARK} [skip] phase ${phase.id}: requires --mode=${phase.requiresMode}\n`,
    );
    return {
      id: phase.id,
      slug: phase.slug,
      label: phase.label,
      status: 'skipped',
      durationMs: 0,
      outputs: [],
      warning: `requires --mode=${phase.requiresMode}`,
    };
  }

  process.stdout.write(`\n${PHASE_HEADER} ${headerNumbers}: ${phase.label}\n`);

  const controller = new AbortController();
  try {
    if (phase.inline) {
      const inline = await phase.inline(ctx);
      const durationMs = Date.now() - start;
      if (inline.warning) {
        process.stdout.write(
          `${WARN_MARK} ${headerNumbers} warning (${formatDuration(durationMs)}): ${inline.warning}\n`,
        );
        return {
          id: phase.id,
          slug: phase.slug,
          label: phase.label,
          status: 'success',
          durationMs,
          outputs: inline.outputs ?? phase.outputs,
          warning: inline.warning,
        };
      }
      process.stdout.write(
        `${SUCCESS_MARK} ${headerNumbers} done (${formatDuration(durationMs)})\n`,
      );
      return {
        id: phase.id,
        slug: phase.slug,
        label: phase.label,
        status: 'success',
        durationMs,
        outputs: inline.outputs ?? phase.outputs,
      };
    }

    const { code, stderr } = await spawnPhase(phase, controller.signal);
    const durationMs = Date.now() - start;
    if (code === 0) {
      process.stdout.write(
        `${SUCCESS_MARK} ${headerNumbers} done (${formatDuration(durationMs)})\n`,
      );
      return {
        id: phase.id,
        slug: phase.slug,
        label: phase.label,
        status: 'success',
        durationMs,
        outputs: phase.outputs,
      };
    }
    const errorMessage = `Exit code ${code}`;
    const tail = stderr.trim().split('\n').slice(-5).join('\n');
    if (phase.nonFatal) {
      process.stdout.write(
        `${WARN_MARK} ${headerNumbers} non-fatal failure (${formatDuration(durationMs)}): ${errorMessage}\n`,
      );
      return {
        id: phase.id,
        slug: phase.slug,
        label: phase.label,
        status: 'success',
        durationMs,
        outputs: phase.outputs,
        warning: tail || errorMessage,
      };
    }
    process.stdout.write(
      `${FAIL_MARK} ${headerNumbers} failed (${formatDuration(durationMs)}): ${errorMessage}\n`,
    );
    return {
      id: phase.id,
      slug: phase.slug,
      label: phase.label,
      status: 'failed',
      durationMs,
      outputs: [],
      error: tail || errorMessage,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      `${FAIL_MARK} ${headerNumbers} crashed (${formatDuration(durationMs)}): ${msg}\n`,
    );
    return {
      id: phase.id,
      slug: phase.slug,
      label: phase.label,
      status: 'failed',
      durationMs,
      outputs: [],
      error: msg,
    };
  }
}

export { formatDuration };
