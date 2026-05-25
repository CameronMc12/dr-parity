/**
 * Run a single form-capture scenario: navigate, fill inputs, optionally
 * submit, record the resulting POST/PUT response. Dry-run mode skips the
 * submit so the script never side-effects a real account.
 */

import type { BrowserContext, Page, Request, Response } from 'playwright';

import type { CapturedFormResponse, FormDefinition, FormScenario } from './types';

const FETCH_LIKE = new Set(['fetch', 'xhr']);

async function fillInputs(page: Page, formSelector: string, inputs: Record<string, string>): Promise<void> {
  await page.waitForSelector(formSelector, { timeout: 10_000 });
  for (const [selector, value] of Object.entries(inputs)) {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'attached', timeout: 5_000 });
    await locator.fill(value);
  }
}

function isInterestingResponse(request: Request, baseUrl: string): boolean {
  const rt = request.resourceType();
  if (!FETCH_LIKE.has(rt)) return false;
  const method = request.method().toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  // Same-origin only — third-party trackers etc. are not the form endpoint.
  try {
    const reqOrigin = new URL(request.url()).origin;
    const baseOrigin = new URL(baseUrl).origin;
    return reqOrigin === baseOrigin;
  } catch {
    return false;
  }
}

export type RunScenarioResult = {
  captured: CapturedFormResponse | null;
  dryRunDetails: { form: string; scenario: string; inputs: Record<string, string>; route: string };
};

export async function runScenario(
  context: BrowserContext,
  appUrl: string,
  form: FormDefinition,
  scenario: FormScenario,
  dryRun: boolean,
): Promise<RunScenarioResult> {
  const page = await context.newPage();
  const targetUrl = new URL(form.route, appUrl).toString();

  const dryRunDetails = {
    form: form.name,
    scenario: scenario.name,
    inputs: scenario.inputs,
    route: targetUrl,
  };

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await fillInputs(page, form.selector, scenario.inputs);

    if (dryRun) {
      return { captured: null, dryRunDetails };
    }

    // Listen for the first qualifying response after submit.
    const responsePromise: Promise<Response> = page.waitForResponse(
      (res) => isInterestingResponse(res.request(), appUrl),
      { timeout: 15_000 },
    );

    if (form.submitTrigger === 'form') {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLFormElement | null;
        if (el) el.requestSubmit();
      }, form.selector);
    } else {
      await page.locator(form.submitTrigger).first().click({ timeout: 5_000 });
    }

    const response = await responsePromise.catch(() => null);
    if (!response) {
      return { captured: null, dryRunDetails };
    }

    const request = response.request();
    let body: string | null = null;
    try {
      body = (await response.text()).slice(0, 50_000);
    } catch {
      body = null;
    }

    const captured: CapturedFormResponse = {
      formName: form.name,
      scenarioName: scenario.name,
      request: {
        method: request.method().toUpperCase(),
        url: request.url(),
        postData: request.postData() ?? null,
      },
      response: {
        status: response.status(),
        body,
        headers: response.headers(),
      },
      capturedAt: new Date().toISOString(),
    };

    return { captured, dryRunDetails };
  } finally {
    await page.close().catch(() => undefined);
  }
}
