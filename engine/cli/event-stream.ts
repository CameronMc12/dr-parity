/**
 * NDJSON event stream writer for `.runs/<runId>/pipeline.jsonl`.
 *
 * Phase 5 implementation per docs/V2.0/04-cli-and-logging-design.md (Part D, D.2)
 * and docs/V2.0/05-action-plan.md §4 Phase 5 task 1.
 *
 * Append only. One JSON object per line. Every event carries a stable type
 * tag plus an ISO timestamp. The set of event types is locked by the audit;
 * adding new ones is an additive schema change (manifest schemaVersion
 * stays the same as long as readers tolerate unknown event types).
 */

import {
  createWriteStream,
  type WriteStream as FsWriteStream,
} from "node:fs";

/** Locked event union. */
export type PipelineEvent =
  | {
      type: "stage_start";
      stage: string;
      at: string;
      input?: unknown;
    }
  | {
      type: "stage_end";
      stage: string;
      at: string;
      status: "ok" | "warn" | "partial" | "fail";
      durationMs: number;
      metrics?: Record<string, number | string>;
    }
  | {
      type: "metric";
      stage: string;
      at: string;
      name: string;
      value: number | string;
      meta?: Record<string, unknown>;
    }
  | {
      type: "warning";
      stage: string;
      at: string;
      message: string;
      hint?: string;
      meta?: Record<string, unknown>;
    }
  | {
      type: "error";
      stage: string;
      at: string;
      message: string;
      stack?: string;
      meta?: Record<string, unknown>;
    }
  | {
      type: "artefact";
      stage: string;
      at: string;
      name: string;
      path: string;
      bytes?: number;
    }
  | {
      type: "decision";
      stage: string;
      at: string;
      decision: string;
      reason: string;
    }
  | {
      type: "run_start";
      at: string;
      command: string;
      argv: readonly string[];
    }
  | {
      type: "run_end";
      at: string;
      status: "ok" | "warn" | "partial" | "fail";
      durationMs: number;
    }
  | {
      type: "log";
      stage: string;
      at: string;
      level: "info" | "warn" | "error";
      message: string;
      meta?: Record<string, unknown>;
    };

export interface EventStreamWriter {
  emit(event: PipelineEvent): void;
  close(): Promise<void>;
}

/**
 * Open a JSONL writer at `filePath`. Caller is responsible for ensuring the
 * parent directory exists. The stream is opened in append mode so reruns
 * with `--run-id=<existing>` chain into the existing log.
 */
export function createEventStream(filePath: string): EventStreamWriter {
  const stream: FsWriteStream = createWriteStream(filePath, { flags: "a" });
  let closed = false;

  return {
    emit(event: PipelineEvent): void {
      if (closed) return;
      stream.write(`${JSON.stringify(event)}\n`);
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        stream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

/** Current ISO timestamp helper. Centralised so every event uses the same format. */
export function nowIso(): string {
  return new Date().toISOString();
}
