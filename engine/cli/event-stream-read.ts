/**
 * Read side of `.runs/<runId>/pipeline.jsonl`.
 *
 * The writer lives in `event-stream.ts`. Harvest needs a typed reader that
 * tolerates partial / malformed lines (tail of an aborted run) and returns
 * a plain array of events for in memory aggregation.
 */

import { promises as fs } from "node:fs";
import { type PipelineEvent } from "./event-stream.js";

export type { PipelineEvent } from "./event-stream.js";

export async function readEventStream(
  filePath: string,
): Promise<PipelineEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }
  const events: PipelineEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as PipelineEvent);
    } catch {
      // ignore truncated tail lines
    }
  }
  return events;
}
