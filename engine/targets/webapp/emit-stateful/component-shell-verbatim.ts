/**
 * Compose the final TSX file for one webapp route using VERBATIM body HTML.
 *
 * Unlike `component-shell.ts` (which embeds JSX produced by `htmlToJsx`), this
 * shell embeds the captured body markup unchanged through
 * `dangerouslySetInnerHTML`. Every attribute (`class`, `_ngcontent-ng-c*`,
 * `_nghost-ng-c*`, `cdk-*`, custom element attrs, inline `style`) reaches the
 * live DOM exactly as captured, so framework-scoped CSS (e.g. Angular
 * ViewEncapsulation.Emulated) matches and the clone renders fully styled.
 *
 * Interaction wiring that JSX would normally carry via `onClick` is instead
 * applied after mount: a single effect binds click listeners to elements
 * stamped with `data-dr-parity-trigger` / `data-dr-parity-close` markers.
 */

import { TRIGGER_MARKER_ATTR, CLOSE_MARKER_ATTR } from './verbatim-body';
import type { OverlayWiring, TriggerWiring } from './verbatim-body';
import { emitInteractionEffect } from './interaction-layer';

export interface VerbatimShellArgs {
  componentName: string;
  stateHookLines: string[];
  effectLines: string[];
  effectImportNames: Set<string>;
  bodyHtml: string;
  triggers: TriggerWiring[];
  overlays: OverlayWiring[];
}

// U+2028 / U+2029 are valid inside HTML but terminate a JS string literal, so
// they must be escaped when embedding HTML as a string constant.
const LINE_SEP_RE = new RegExp('\\u2028', 'g');
const PARA_SEP_RE = new RegExp('\\u2029', 'g');

/** Embed an arbitrary HTML string as a single-quoted JS string literal. */
function jsString(value: string): string {
  return (
    "'" +
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(LINE_SEP_RE, '\\u2028')
      .replace(PARA_SEP_RE, '\\u2029') +
    "'"
  );
}

/**
 * Effect that wires every trigger / close marker to its setter after the
 * verbatim body mounts. Bound once on mount; setters are stable React
 * dispatchers so the empty dep array is safe.
 */
function emitWiringEffect(
  triggers: TriggerWiring[],
  overlays: OverlayWiring[],
): { lines: string[]; needsEffect: boolean } {
  const closeWirings = overlays.filter((o) => o.closeMarkerId !== null);
  if (triggers.length === 0 && closeWirings.length === 0) {
    return { lines: [], needsEffect: false };
  }

  const lines: string[] = [];
  lines.push('  useEffect(() => {');
  lines.push('    const root = bodyRef.current;');
  lines.push('    if (!root) return;');
  lines.push('    const cleanups: Array<() => void> = [];');
  lines.push('    const bind = (sel: string, fn: () => void) => {');
  lines.push('      const el = root.querySelector(sel);');
  lines.push('      if (!el) return;');
  lines.push('      const handler = (e: Event) => { e.preventDefault(); fn(); };');
  lines.push("      el.addEventListener('click', handler);");
  lines.push("      cleanups.push(() => el.removeEventListener('click', handler));");
  lines.push('    };');

  for (const t of triggers) {
    lines.push(
      `    bind('[${TRIGGER_MARKER_ATTR}="${t.markerId}"]', () => ${t.setter}(true));`,
    );
  }
  for (const o of closeWirings) {
    lines.push(
      `    bind('[${CLOSE_MARKER_ATTR}="${o.closeMarkerId}"]', () => ${o.setter}(false));`,
    );
  }

  lines.push('    return () => { for (const c of cleanups) c(); };');
  lines.push('    // eslint-disable-next-line react-hooks/exhaustive-deps');
  lines.push('  }, []);');
  return { lines, needsEffect: true };
}

function emitOverlayBlocks(overlays: OverlayWiring[]): string[] {
  const lines: string[] = [];
  for (const o of overlays) {
    const refAttr = o.refName ? ` ref={${o.refName}}` : '';
    lines.push(`      {${o.stateVar} && (`);
    lines.push(
      `        <div${refAttr} dangerouslySetInnerHTML={{ __html: ${jsString(o.html)} }} />`,
    );
    lines.push('      )}');
  }
  return lines;
}

export function emitVerbatimComponentShell(args: VerbatimShellArgs): string {
  const {
    componentName,
    stateHookLines,
    effectLines,
    effectImportNames,
    bodyHtml,
    triggers,
    overlays,
  } = args;

  const wiring = emitWiringEffect(triggers, overlays);
  // The generic interaction layer (tabs / search modal / sidebar nav) always
  // runs against the verbatim body, independent of inferred state toggles.
  const interaction = emitInteractionEffect();
  const needsBodyRef = wiring.needsEffect || interaction.needsEffect;

  const usesState = stateHookLines.some((l) => l.includes('useState('));
  const usesRef = stateHookLines.some((l) => l.includes('useRef(')) || needsBodyRef;

  const hookImports = new Set<string>(effectImportNames);
  if (usesState) hookImports.add('useState');
  if (usesRef) hookImports.add('useRef');
  if (needsBodyRef || effectLines.length > 0) hookImports.add('useEffect');

  const importLine =
    hookImports.size > 0
      ? `import { ${[...hookImports].sort().join(', ')} } from 'react';`
      : '';

  const head = [importLine, '', `const __BODY_HTML = ${jsString(bodyHtml)};`, ''].filter(
    (l) => l !== null,
  );

  const body: string[] = [];
  body.push(`export function ${componentName}() {`);

  if (stateHookLines.length > 0) {
    body.push(...stateHookLines);
  }
  if (needsBodyRef) {
    body.push('  const bodyRef = useRef<HTMLDivElement | null>(null);');
  }
  if (stateHookLines.length > 0 || needsBodyRef) {
    body.push('');
  }

  if (effectLines.length > 0) {
    body.push(...effectLines);
    body.push('');
  }
  if (wiring.lines.length > 0) {
    body.push(...wiring.lines);
    body.push('');
  }
  if (interaction.lines.length > 0) {
    body.push(...interaction.lines);
    body.push('');
  }

  const bodyRefAttr = needsBodyRef ? ' ref={bodyRef}' : '';
  body.push('  return (');
  body.push('    <>');
  body.push(
    `      <div${bodyRefAttr} dangerouslySetInnerHTML={{ __html: __BODY_HTML }} />`,
  );
  body.push(...emitOverlayBlocks(overlays));
  body.push('    </>');
  body.push('  );');
  body.push('}');
  body.push('');
  body.push(`export default ${componentName};`);
  body.push('');

  return [...head, ...body].join('\n');
}
