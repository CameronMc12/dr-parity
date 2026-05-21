/**
 * Compose the final TSX file for one route component.
 *
 * Layout:
 *   imports → component fn → useState/useRef → useEffect dismissals →
 *   return <> base JSX with onClick handlers + overlay blocks </>
 */

export interface ComponentShellArgs {
  componentName: string;
  reactHookImports: Set<string>;
  stateHookLines: string[];
  effectLines: string[];
  baseJsx: string;
  overlayLines: string[];
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map((l) => (l.length > 0 ? prefix + l : l)).join('\n');
}

export function emitComponentShell(args: ComponentShellArgs): string {
  const {
    componentName,
    reactHookImports,
    stateHookLines,
    effectLines,
    baseJsx,
    overlayLines,
  } = args;

  const importList = [...reactHookImports].sort();
  const importLine =
    importList.length > 0
      ? `import { ${importList.join(', ')} } from 'react';`
      : '';

  const head = [importLine, '', `export function ${componentName}() {`].filter((l) => l !== null);

  const body: string[] = [];
  if (stateHookLines.length > 0) {
    body.push(...stateHookLines);
    body.push('');
  }
  if (effectLines.length > 0) {
    body.push(...effectLines);
    body.push('');
  }

  body.push('  return (');
  body.push('    <>');
  body.push(indent(baseJsx.trim(), '      '));
  if (overlayLines.length > 0) {
    body.push(...overlayLines);
  }
  body.push('    </>');
  body.push('  );');
  body.push('}');
  body.push('');
  body.push(`export default ${componentName};`);
  body.push('');

  return [...head, ...body].join('\n');
}
