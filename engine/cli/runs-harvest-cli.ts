/**
 * Citty handler for `parity runs harvest`.
 *
 * Translates command line args into a HarvestOptions call, prints a short
 * summary of what got scanned and emitted, and exits with status 0.
 */

import { defineCommand } from "citty";
import { harvestRuns } from "./runs-harvest.js";

export const runsHarvestCommand = defineCommand({
  meta: {
    name: "harvest",
    description:
      "Walk .runs/ and emit triage tickets to docs/parity-issues/ for findings that surface across multiple runs.",
  },
  args: {
    since: {
      type: "string",
      description: "ISO date or full ISO timestamp. Skip runs that started earlier.",
      valueHint: "iso",
    },
    target: {
      type: "string",
      description: "Filter to runs whose target matches this value (astro, react, webapp, host, etc).",
      valueHint: "name",
    },
    "min-recurrence": {
      type: "string",
      description: "Minimum number of runs a finding must appear in. Default 2.",
      valueHint: "n",
    },
    "tickets-dir": {
      type: "string",
      description: "Override the docs/parity-issues/ output directory.",
      valueHint: "path",
    },
    "runs-dir": {
      type: "string",
      description: "Override the .runs/ input directory.",
      valueHint: "path",
    },
  },
  async run({ args }) {
    const minRecurrence = parseInteger(args["min-recurrence"]);
    const result = await harvestRuns({
      repoRoot: process.cwd(),
      since: typeof args.since === "string" ? args.since : undefined,
      target: typeof args.target === "string" ? args.target : undefined,
      minRecurrence: minRecurrence,
      ticketsDir:
        typeof args["tickets-dir"] === "string"
          ? String(args["tickets-dir"])
          : undefined,
      runsDir:
        typeof args["runs-dir"] === "string"
          ? String(args["runs-dir"])
          : undefined,
    });

    process.stdout.write(
      `parity runs harvest finished:\n` +
        `  runs scanned: ${result.runsScanned}\n` +
        `  findings    : ${result.findings.length}\n` +
        `  tickets     : ${result.ticketsWritten.length}\n` +
        `  index       : ${result.indexPath}\n`,
    );
  },
});

function parseInteger(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}
