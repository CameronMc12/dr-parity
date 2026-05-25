/**
 * Form-capture entrypoint. Wraps Playwright's persistent-profile launch,
 * iterates scenarios from a plan YAML, and appends captured responses to
 * `<outDir>/forms.jsonl`.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

import { loadFormPlan } from './plan-loader';
import { runScenario } from './scenario-runner';
import type { CapturedFormResponse, FormCaptureOptions, FormPlan } from './types';

export { loadFormPlan, parseYaml } from './plan-loader';
export { runScenario } from './scenario-runner';
export type {
  FormDefinition,
  FormScenario,
  FormPlan,
  CapturedFormResponse,
  FormCaptureOptions,
} from './types';

export type FormCaptureSummary = {
  scenariosRun: number;
  captured: number;
  skippedDryRun: number;
  outFile: string;
};

function appendJsonl(filePath: string, record: CapturedFormResponse): void {
  appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
}

export async function captureForms(options: FormCaptureOptions): Promise<FormCaptureSummary> {
  const plan: FormPlan = loadFormPlan(options.planPath);

  mkdirSync(options.outDir, { recursive: true });
  const outFile = join(options.outDir, 'forms.jsonl');

  let scenariosRun = 0;
  let captured = 0;
  let skippedDryRun = 0;

  const totalScenarios = plan.forms.reduce((n, f) => n + f.scenarios.length, 0);
  if (totalScenarios === 0) {
    console.log('[forms] no scenarios in plan; nothing to do.');
    return { scenariosRun: 0, captured: 0, skippedDryRun: 0, outFile };
  }

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });

  try {
    for (const form of plan.forms) {
      for (const scenario of form.scenarios) {
        scenariosRun++;
        console.log(`[forms] ${form.name}/${scenario.name}${options.dryRun ? ' (dry-run)' : ''}`);
        const result = await runScenario(
          context,
          options.appUrl,
          form,
          scenario,
          options.dryRun,
        );
        if (options.dryRun) {
          skippedDryRun++;
          console.log(`         would submit at ${result.dryRunDetails.route}`);
          for (const [sel, val] of Object.entries(result.dryRunDetails.inputs)) {
            console.log(`           ${sel} = ${JSON.stringify(val)}`);
          }
          continue;
        }
        if (result.captured) {
          captured++;
          appendJsonl(outFile, result.captured);
          console.log(`         captured ${result.captured.response.status} ${result.captured.request.url}`);
        } else {
          console.log('         no qualifying response captured');
        }
      }
    }
  } finally {
    await context.close().catch(() => undefined);
  }

  return { scenariosRun, captured, skippedDryRun, outFile };
}
