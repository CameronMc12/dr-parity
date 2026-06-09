/**
 * seed-workspace — CLI to plan / apply / purge the DR-PARITY-SEED ClickUp data.
 *
 * Usage:
 *   npm run seed:workspace -- --team=<wsid> --dry-run
 *   npm run seed:workspace -- --team=<wsid>
 *   npm run seed:workspace -- --team=<wsid> --purge
 *
 * Token: env CLICKUP_API_TOKEN (personal token, sent as the raw Authorization
 * header — no "Bearer" prefix). Not required for --dry-run.
 *
 * Safety: every write stays inside the DR-PARITY-SEED space; --purge refuses to
 * delete unless the space name matches the marker.
 */

import { applyFixture } from '../engine/seed/apply.js';
import { ClickUpClient } from '../engine/seed/clickup-api.js';
import { fixture } from '../engine/seed/fixture.js';
import { MANIFEST_PATH, emptyManifest, loadManifest, writeManifest } from '../engine/seed/manifest.js';
import { buildPlan } from '../engine/seed/plan.js';
import { purgeSeed } from '../engine/seed/purge.js';

interface CliArgs {
  team: string | null;
  dryRun: boolean;
  purge: boolean;
  minIntervalMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { team: null, dryRun: false, purge: false, minIntervalMs: 700 };
  for (const raw of argv) {
    if (raw.startsWith('--team=')) args.team = raw.slice('--team='.length).trim();
    else if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--purge') args.purge = true;
    else if (raw.startsWith('--throttle=')) {
      const n = Number(raw.slice('--throttle='.length));
      if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid --throttle: ${raw}`);
      args.minIntervalMs = n;
    } else if (raw.startsWith('--')) throw new Error(`Unknown flag: ${raw}`);
    else throw new Error(`Unexpected argument: ${raw}`);
  }
  return args;
}

function printPlan(now: number): void {
  const plan = buildPlan(fixture, now);
  for (const line of plan.lines) {
    process.stdout.write(`${'  '.repeat(line.depth)}${line.label}\n`);
  }
  process.stdout.write('\n=== PLAN COUNTS ===\n');
  for (const [k, v] of Object.entries(plan.counts)) {
    process.stdout.write(`  ${k.padEnd(18)} ${v}\n`);
  }
  process.stdout.write('\n');
}

function getToken(): string {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token || token.trim() === '') {
    throw new Error('CLICKUP_API_TOKEN env var is required for live operations. Use --dry-run to preview without a token.');
  }
  return token.trim();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();

  if (args.dryRun) {
    process.stdout.write(`# DRY RUN — no API calls. Target team: ${args.team ?? '(not set; required for live)'}\n\n`);
    printPlan(now);
    process.stdout.write('Dry run complete. Re-run without --dry-run (and with CLICKUP_API_TOKEN set) to apply.\n');
    return;
  }

  if (!args.team) {
    throw new Error('--team=<wsid> is required. Find it in your ClickUp URL: app.clickup.com/<wsid>/...');
  }

  const token = getToken();
  const client = new ClickUpClient({ token, minIntervalMs: args.minIntervalMs });
  const log = (msg: string) => process.stdout.write(`${msg}\n`);

  if (args.purge) {
    const result = await purgeSeed(client, fixture, args.team, log);
    process.stdout.write(`\nPURGE: ${result.reason}\n`);
    return;
  }

  const existing = await loadManifest(MANIFEST_PATH);
  const manifest =
    existing && existing.teamId === args.team ? existing : emptyManifest(args.team);
  manifest.generatedAt = new Date().toISOString();

  const result = await applyFixture(client, fixture, args.team, manifest, log);
  await writeManifest(MANIFEST_PATH, result.manifest);

  process.stdout.write(`\nApplied. Manifest written to ${MANIFEST_PATH} (${Object.keys(result.manifest.ids).length} ids).\n`);
  if (result.remappedStatuses.length > 0) {
    process.stdout.write('\nREMAPPED STATUSES (custom statuses cannot be created via public API — mapped to existing ones):\n');
    for (const s of [...new Set(result.remappedStatuses)]) process.stdout.write(`  - ${s}\n`);
  }
  if (result.skippedFields.length > 0) {
    process.stdout.write('\nSKIPPED CUSTOM FIELDS (public API cannot create fields — add these in the UI then re-run):\n');
    for (const s of [...new Set(result.skippedFields)]) process.stdout.write(`  - ${s}\n`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`\nERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
