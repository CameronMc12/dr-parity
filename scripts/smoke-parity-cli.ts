/**
 * Smoke test for the parity CLI scaffold.
 *
 * Runs:
 *   1. `parity --help` and asserts it exits 0 and prints expected commands.
 *   2. `parity clone --help` and asserts it exits 0 and mentions key flags.
 *   3. `parity version` and asserts it prints a version string.
 *
 * Invocation:
 *   npx tsx scripts/smoke-parity-cli.ts
 *
 * The CLI is invoked through `npx tsx bin/parity.ts` so the test runs against
 * the source entry point (no `npm link` required).
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

interface Case {
  readonly label: string;
  readonly argv: readonly string[];
  readonly mustInclude: readonly string[];
  readonly expectedExit: number;
}

const repoRoot = resolve(import.meta.dirname ?? ".", "..");
const cliPath = resolve(repoRoot, "bin", "parity.ts");

const cases: readonly Case[] = [
  {
    label: "parity --help",
    argv: ["--help"],
    mustInclude: [
      "parity",
      "clone",
      "capture",
      "parse",
      "clone-static",
      "targets",
      "runs",
    ],
    expectedExit: 0,
  },
  {
    label: "parity clone --help",
    argv: ["clone", "--help"],
    mustInclude: ["url", "viewport", "tour", "parity", "out"],
    expectedExit: 0,
  },
  {
    label: "parity version",
    argv: ["version"],
    mustInclude: ["2.0.0"],
    expectedExit: 0,
  },
  {
    label: "parity targets list",
    argv: ["targets", "list"],
    mustInclude: ["astro"],
    expectedExit: 0,
  },
];

function runCase(c: Case): { ok: boolean; reason?: string } {
  const result = spawnSync("npx", ["tsx", cliPath, ...c.argv], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) {
    return { ok: false, reason: `spawn error: ${result.error.message}` };
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`.toLowerCase();

  if (result.status !== c.expectedExit) {
    return {
      ok: false,
      reason: `exit ${result.status} (expected ${c.expectedExit})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    };
  }

  for (const needle of c.mustInclude) {
    if (!combined.includes(needle.toLowerCase())) {
      return {
        ok: false,
        reason: `missing "${needle}" in output\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      };
    }
  }
  return { ok: true };
}

let failures = 0;
for (const c of cases) {
  const { ok, reason } = runCase(c);
  if (ok) {
    process.stdout.write(`PASS  ${c.label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL  ${c.label}\n  ${reason}\n`);
  }
}

if (failures > 0) {
  process.stdout.write(`\n${failures} smoke test(s) failed.\n`);
  process.exit(1);
}

process.stdout.write(`\nAll ${cases.length} smoke tests passed.\n`);
