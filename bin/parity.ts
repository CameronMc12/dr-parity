#!/usr/bin/env -S npx tsx
/**
 * `parity` CLI entry point.
 *
 * Phase 4 scaffold per docs/V2.0/04-cli-and-logging-design.md (Part B)
 * and docs/V2.0/05-action-plan.md §4 Phase 4.
 *
 * Every subcommand is a stub that prints `stage: <name> (not yet wired)`
 * and exits with status 0. Phase 5 will wire real behaviour by importing
 * the in-process stages and composing them via `engine/cli/orchestrate.ts`.
 *
 * No subprocess spawning. No Chrome MCP. Playwright extraction only.
 *
 * Help text obeys the project writing style rule: no em dashes, no
 * single hyphens used as punctuation, no double hyphens. Hyphens inside
 * flag names (`--no-tour`) and inside code samples are exempt.
 */

import { defineCommand, runMain } from "citty";
import { runRegressionTest } from "../engine/cli/regression/run-test.js";
import { runParityClone } from "../engine/cli/run-clone-stage.js";
import { runsHarvestCommand } from "../engine/cli/runs-harvest-cli.js";

const PARITY_VERSION = "2.0.0-dev";

function stub(name: string): void {
  process.stdout.write(`stage: ${name} (not yet wired)\n`);
}

const testCommand = defineCommand({
  meta: {
    name: "test",
    description:
      "Run the regression corpus against every fixture under tests/fixtures/sites/. Exits non-zero on any regression.",
  },
  args: {
    root: {
      type: "string",
      description: "Override the repo root used to resolve fixtures.",
      valueHint: "path",
    },
  },
  async run({ args }) {
    const root = typeof args.root === "string" ? args.root : undefined;
    const exitCode = await runRegressionTest(root);
    process.exit(exitCode);
  },
});

const cloneCommand = defineCommand({
  meta: {
    name: "clone",
    description:
      "Capture a single URL and emit a static clone (full pipeline).",
  },
  args: {
    url: {
      type: "positional",
      description: "Origin URL to clone.",
      required: true,
    },
    target: {
      type: "positional",
      description: "Target name. Defaults to a slug derived from the host.",
      required: false,
    },
    viewport: {
      type: "string",
      description:
        "Comma separated viewport list. Accepts mobile,tablet,desktop,wide or all.",
      default: "all",
      valueHint: "list",
    },
    tour: {
      type: "boolean",
      description: "Run the scroll and hover tour to wake lazy content.",
      default: true,
      negativeDescription: "Skip the tour pass.",
    },
    parity: {
      type: "boolean",
      description: "Run the parity verification stage after build.",
      default: true,
      negativeDescription: "Skip parity verification.",
    },
    "parity-threshold": {
      type: "string",
      description: "Pixel diff threshold for parity verification.",
      default: "0.02",
      valueHint: "ratio",
    },
    out: {
      type: "string",
      description: "Override the base output directory.",
      valueHint: "path",
    },
  },
  async run({ args }) {
    const url = String(args.url);
    const targetArg =
      typeof args.target === "string" && args.target.length > 0
        ? (args.target as "astro" | "react" | "webapp" | "html-mirror")
        : undefined;
    const viewports =
      typeof args.viewport === "string" && args.viewport !== "all"
        ? args.viewport
        : undefined;
    const outDir = typeof args.out === "string" ? args.out : undefined;
    const tour = args.tour !== false;

    const result = await runParityClone({
      url,
      target: targetArg,
      viewports,
      tour,
      outDir,
    });
    process.stdout.write(
      `\nparity clone finished: status=${result.status}\n` +
        `  runId : ${result.runId}\n` +
        `  runDir: ${result.runDir}\n` +
        `  summary: ${result.summaryPath}\n`,
    );
    process.exit(result.status === "ok" ? 0 : 1);
  },
});

const captureCommand = defineCommand({
  meta: {
    name: "capture",
    description:
      "Run the Playwright capture stage for one URL. Produces HAR, trace, screenshots, and DOM snapshots.",
  },
  args: {
    url: {
      type: "positional",
      description: "Origin URL to capture.",
      required: true,
    },
    viewport: {
      type: "string",
      description: "Comma separated viewport list or all.",
      default: "all",
    },
    mode: {
      type: "enum",
      description: "Capture mode.",
      options: ["launch", "cdp", "persistent"],
      default: "launch",
    },
    tour: {
      type: "boolean",
      description: "Run the scroll and hover tour.",
      default: true,
      negativeDescription: "Skip the tour pass.",
    },
    headed: {
      type: "boolean",
      description: "Run the browser with a visible window.",
      default: false,
    },
    out: {
      type: "string",
      description: "Override the base output directory.",
      valueHint: "path",
    },
  },
  run({ args }) {
    process.stdout.write(
      `parity capture (stub): url=${args.url} mode=${args.mode} viewport=${args.viewport} tour=${args.tour} headed=${args.headed}\n`,
    );
    stub("capture");
  },
});

const parseCommand = defineCommand({
  meta: {
    name: "parse",
    description:
      "Parse a capture directory into structured assets. Wraps parse:har and parse:trace.",
  },
  args: {
    captureDir: {
      type: "positional",
      description: "Path to the capture directory produced by parity capture.",
      required: true,
    },
    har: {
      type: "boolean",
      description: "Parse the HAR network log only.",
      default: false,
    },
    trace: {
      type: "boolean",
      description: "Parse the Playwright trace only.",
      default: false,
    },
    all: {
      type: "boolean",
      description: "Parse HAR and trace. Default behaviour.",
      default: true,
      negativeDescription: "Disable the all parse default.",
    },
  },
  run({ args }) {
    process.stdout.write(
      `parity parse (stub): dir=${args.captureDir} har=${args.har} trace=${args.trace} all=${args.all}\n`,
    );
    stub("parse");
  },
});

const cloneStaticCommand = defineCommand({
  meta: {
    name: "clone-static",
    description:
      "Build the static 1:1 clone from a parsed capture directory. Equivalent to the existing scripts/clone.ts step.",
  },
  args: {
    captureDir: {
      type: "positional",
      description: "Path to the parsed capture directory.",
      required: true,
    },
    viewport: {
      type: "string",
      description: "Comma separated viewport list or all.",
      default: "all",
    },
    out: {
      type: "string",
      description: "Override the base output directory.",
      valueHint: "path",
    },
  },
  run({ args }) {
    process.stdout.write(
      `parity clone-static (stub): dir=${args.captureDir} viewport=${args.viewport} out=${args.out ?? "default"}\n`,
    );
    stub("clone-static");
  },
});

const targetsListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List registered framework targets.",
  },
  run() {
    process.stdout.write(
      "targets (stub): astro, react, webapp, html-mirror\n",
    );
    stub("targets list");
  },
});

const targetsCommand = defineCommand({
  meta: {
    name: "targets",
    description: "Inspect the registered framework targets.",
  },
  subCommands: {
    list: targetsListCommand,
  },
});

const runsListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List recent runs from the .runs directory.",
  },
  args: {
    last: {
      type: "string",
      description: "Limit to the most recent N runs.",
      valueHint: "N",
    },
    target: {
      type: "string",
      description: "Filter by target host or slug.",
      valueHint: "name",
    },
  },
  run({ args }) {
    process.stdout.write(
      `parity runs list (stub): last=${args.last ?? "all"} target=${args.target ?? "any"}\n`,
    );
    stub("runs list");
  },
});

const runsCommand = defineCommand({
  meta: {
    name: "runs",
    description: "Inspect and manage durable run records under .runs/.",
  },
  subCommands: {
    list: runsListCommand,
    harvest: runsHarvestCommand,
  },
});

const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Print the parity CLI version.",
  },
  run() {
    process.stdout.write(`${PARITY_VERSION}\n`);
  },
});

const main = defineCommand({
  meta: {
    name: "parity",
    version: PARITY_VERSION,
    description:
      "Dr Parity. One binary for capturing, cloning, building, and verifying any website.",
  },
  subCommands: {
    clone: cloneCommand,
    capture: captureCommand,
    parse: parseCommand,
    "clone-static": cloneStaticCommand,
    targets: targetsCommand,
    runs: runsCommand,
    test: testCommand,
    version: versionCommand,
  },
});

runMain(main);
