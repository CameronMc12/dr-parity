import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import type { Viewport } from './types';
import type {
  RouteSpec,
  RouteInteraction,
  ScoreWeights,
  StateScore,
  RouteScore,
} from './score-types';
import { maskedDiff } from './masked-diff';
import { captureDomSignature, domSimilarity } from './dom-signature';

const NAV_TIMEOUT_MS = 20_000;
const SETTLE_DELAY_MS = 2_000;
const INTERACTION_TIMEOUT_MS = 5_000;

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

type LoadResult = {
  ok: boolean;
  signature: string[];
  note?: string;
};

async function loadRoute(page: Page, url: string): Promise<LoadResult> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Timeout/i.test(msg)) {
      return { ok: false, signature: [], note: `load failed: ${msg}` };
    }
  }
  await page.waitForTimeout(SETTLE_DELAY_MS);
  const signature = await captureDomSignature(page);
  return { ok: true, signature };
}

type InteractionResult = {
  performed: boolean;
  changed: boolean;
  signature: string[];
  note?: string;
};

async function performInteraction(
  page: Page,
  interaction: RouteInteraction,
  beforeSignature: string[],
): Promise<InteractionResult> {
  const locator = page.locator(interaction.selector).first();
  try {
    const count = await locator.count();
    if (count === 0) {
      return { performed: false, changed: false, signature: beforeSignature, note: 'selector not found' };
    }
    if (interaction.kind === 'hover') {
      await locator.hover({ timeout: INTERACTION_TIMEOUT_MS });
    } else {
      await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { performed: false, changed: false, signature: beforeSignature, note: `interaction failed: ${msg}` };
  }
  await page.waitForTimeout(SETTLE_DELAY_MS);
  const after = await captureDomSignature(page);
  const sim = domSimilarity(beforeSignature, after);
  // DOM transitioned if the post-interaction signature meaningfully differs.
  const changed = sim < 0.98;
  return { performed: true, changed, signature: after };
}

function blendScore(
  weights: ScoreWeights,
  visual: number,
  dom: number,
  functional: number | null,
): number {
  if (functional === null) {
    const total = weights.visual + weights.dom;
    if (total === 0) return 0;
    return (weights.visual * visual + weights.dom * dom) / total;
  }
  const total = weights.visual + weights.dom + weights.functional;
  if (total === 0) return 0;
  return (
    (weights.visual * visual + weights.dom * dom + weights.functional * functional) / total
  );
}

async function screenshotTo(page: Page, path: string): Promise<void> {
  await page.screenshot({ path, fullPage: true });
}

export type ScoreRouteDeps = {
  referenceCtx: BrowserContext;
  candidateCtx: BrowserContext;
  referenceBase: string;
  candidateBase: string;
  viewport: Viewport;
  weights: ScoreWeights;
  outDir: string;
};

/**
 * Scores a single route and all its interaction states across reference and
 * candidate. Captures two reference loads to derive the non-determinism mask.
 */
export async function scoreRoute(
  route: RouteSpec,
  deps: ScoreRouteDeps,
): Promise<RouteScore> {
  const { referenceCtx, candidateCtx, referenceBase, candidateBase, viewport, weights, outDir } =
    deps;
  const routeDir = join(outDir, route.id);
  await mkdir(routeDir, { recursive: true });

  const refUrl = joinUrl(referenceBase, route.path);
  const candUrl = joinUrl(candidateBase, route.path);

  const refPage = await referenceCtx.newPage();
  const refPageB = await referenceCtx.newPage();
  const candPage = await candidateCtx.newPage();
  const states: StateScore[] = [];

  try {
    // Base state: load route on both, plus a second reference load for the mask.
    const refLoad = await loadRoute(refPage, refUrl);
    const refLoadB = await loadRoute(refPageB, refUrl);
    const candLoad = await loadRoute(candPage, candUrl);

    states.push(
      await scoreState({
        routeId: route.id,
        state: 'base',
        refPage,
        refPageB,
        candPage,
        refSig: refLoad.signature,
        candSig: candLoad.signature,
        functional: null,
        loadNotes: collectLoadNotes(refLoad, refLoadB, candLoad),
        weights,
        stateDir: join(routeDir, 'base'),
      }),
    );

    for (const interaction of route.interactions ?? []) {
      // Reset all three pages to the base route before each interaction.
      const r = await loadRoute(refPage, refUrl);
      const rb = await loadRoute(refPageB, refUrl);
      const c = await loadRoute(candPage, candUrl);

      const refInter = await performInteraction(refPage, interaction, r.signature);
      const refInterB = await performInteraction(refPageB, interaction, rb.signature);
      const candInter = await performInteraction(candPage, interaction, c.signature);

      // Functional: candidate transitioned the same way the reference did.
      const functional = computeFunctional(refInter, candInter);
      const notes = collectInteractionNotes(interaction, refInter, refInterB, candInter);

      states.push(
        await scoreState({
          routeId: route.id,
          state: interaction.label,
          refPage,
          refPageB,
          candPage,
          refSig: refInter.signature,
          candSig: candInter.signature,
          functional,
          loadNotes: notes,
          weights,
          stateDir: join(routeDir, interaction.label),
        }),
      );
    }
  } finally {
    await Promise.allSettled([refPage.close(), refPageB.close(), candPage.close()]);
  }

  const routeScore =
    states.length > 0 ? states.reduce((sum, s) => sum + s.blended, 0) / states.length : 0;

  return {
    routeId: route.id,
    path: route.path,
    label: route.label ?? route.path,
    states,
    routeScore,
  };
}

function collectLoadNotes(ref: LoadResult, refB: LoadResult, cand: LoadResult): string[] {
  const notes: string[] = [];
  if (!ref.ok) notes.push(`reference ${ref.note ?? 'load failed'}`);
  if (!refB.ok) notes.push(`reference (mask) ${refB.note ?? 'load failed'}`);
  if (!cand.ok) notes.push(`candidate ${cand.note ?? 'load failed'}`);
  return notes;
}

function collectInteractionNotes(
  interaction: RouteInteraction,
  ref: InteractionResult,
  refB: InteractionResult,
  cand: InteractionResult,
): string[] {
  const notes: string[] = [];
  if (!ref.performed) notes.push(`reference interaction (${interaction.selector}): ${ref.note ?? 'not performed'}`);
  if (!cand.performed) notes.push(`candidate interaction (${interaction.selector}): ${cand.note ?? 'not performed'}`);
  void refB;
  return notes;
}

function computeFunctional(ref: InteractionResult, cand: InteractionResult): number | null {
  if (!ref.performed && !cand.performed) return null;
  if (!ref.performed) {
    // Reference could not reach the state; treat as non-scoring.
    return null;
  }
  if (!cand.performed) return 0;
  // Both performed: full marks if both transitioned (or both stayed put).
  return ref.changed === cand.changed ? 1 : 0;
}

type ScoreStateArgs = {
  routeId: string;
  state: string;
  refPage: Page;
  refPageB: Page;
  candPage: Page;
  refSig: string[];
  candSig: string[];
  functional: number | null;
  loadNotes: string[];
  weights: ScoreWeights;
  stateDir: string;
};

async function scoreState(args: ScoreStateArgs): Promise<StateScore> {
  const { routeId, state, refPage, refPageB, candPage, refSig, candSig, functional, loadNotes, weights, stateDir } =
    args;
  await mkdir(stateDir, { recursive: true });

  const referenceShot = join(stateDir, 'reference.png');
  const referenceShotB = join(stateDir, 'reference-b.png');
  const candidateShot = join(stateDir, 'candidate.png');
  const diffShot = join(stateDir, 'diff.png');
  const notes = [...loadNotes];

  await Promise.all([
    screenshotTo(refPage, referenceShot),
    screenshotTo(refPageB, referenceShotB),
    screenshotTo(candPage, candidateShot),
  ]);

  let visualScore = 0;
  let mismatchedPixels = 0;
  let totalPixels = 0;
  let maskedPixels = 0;
  try {
    const result = await maskedDiff({
      candidatePath: candidateShot,
      referencePath: referenceShot,
      referencePathB: referenceShotB,
      diffPath: diffShot,
    });
    visualScore = result.visualScore;
    mismatchedPixels = result.mismatchedPixels;
    totalPixels = result.totalPixels;
    maskedPixels = result.maskedPixels;
  } catch (err) {
    notes.push(`visual diff failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const domScore = domSimilarity(refSig, candSig);
  const blended = blendScore(weights, visualScore, domScore, functional);

  return {
    routeId,
    state,
    visualScore,
    domScore,
    functionalScore: functional,
    blended,
    mismatchedPixels,
    totalPixels,
    maskedPixels,
    candidateShot,
    referenceShot,
    diffShot,
    notes,
  };
}
