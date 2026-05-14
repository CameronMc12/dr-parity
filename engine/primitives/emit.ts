import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EmittedPrimitive, PrimitiveConfig, PrimitiveDef } from './types';

export interface EmitOptions {
  outDir: string;
  force: boolean;
}

export function emitPrimitives(
  config: PrimitiveConfig,
  opts: EmitOptions,
): EmittedPrimitive[] {
  mkdirSync(opts.outDir, { recursive: true });

  const names = Object.keys(config.primitives).sort();
  const emitted: EmittedPrimitive[] = [];

  for (const name of names) {
    const def = config.primitives[name];
    const file = join(opts.outDir, `${name}.astro`);
    const source = renderAstro(name, def);
    writeFileSync(file, source, 'utf8');

    emitted.push({
      name,
      file,
      baseClass: def.matchClasses?.[0] ?? null,
      variantKeys: def.variants ? Object.keys(def.variants) : [],
      sizeKeys: def.sizes ? Object.keys(def.sizes) : [],
      matchClasses: def.matchClasses ? [...def.matchClasses] : [],
      matchTags: def.matchTags ? [...def.matchTags] : [],
    });
  }

  return emitted;
}

export function emitIndex(outDir: string, emitted: EmittedPrimitive[]): string {
  const lines = emitted
    .map((p) => `export { default as ${p.name} } from './${p.name}.astro';`)
    .join('\n');
  const file = join(outDir, 'index.ts');
  writeFileSync(file, `${lines}\n`, 'utf8');
  return file;
}

function renderAstro(name: string, def: PrimitiveDef): string {
  const variantKeys = def.variants ? Object.keys(def.variants) : [];
  const sizeKeys = def.sizes ? Object.keys(def.sizes) : [];
  const baseClass = def.matchClasses?.[0] ?? null;

  const hasVariants = variantKeys.length > 0;
  const hasSizes = sizeKeys.length > 0;
  const defaultVariant = hasVariants ? variantKeys[0] : null;
  const defaultSize = hasSizes ? sizeKeys[0] : null;

  const fmTypeLines: string[] = [];
  if (hasVariants) {
    fmTypeLines.push(`type Variant = ${unionLiteral(variantKeys)};`);
  }
  if (hasSizes) {
    fmTypeLines.push(`type Size = ${unionLiteral(sizeKeys)};`);
  }

  const propLines: string[] = [];
  if (hasVariants) propLines.push('  variant?: Variant;');
  if (hasSizes) propLines.push('  size?: Size;');
  propLines.push('  class?: string;');
  propLines.push('  as?: string;');
  propLines.push('  [key: string]: unknown;');

  const destructure: string[] = [];
  if (hasVariants) destructure.push(`variant${defaultVariant ? ` = '${defaultVariant}'` : ''}`);
  if (hasSizes) destructure.push(`size${defaultSize ? ` = '${defaultSize}'` : ''}`);
  destructure.push(`class: className = ''`);
  destructure.push(`as: Tag = '${def.tag}'`);
  destructure.push('...rest');

  const classExprLines: string[] = [];
  if (hasVariants) {
    classExprLines.push(renderLookupConst('variantClass', 'variant', def.variants!));
  }
  if (hasSizes) {
    classExprLines.push(renderLookupConst('sizeClass', 'size', def.sizes!));
  }

  const classPieces: string[] = [];
  if (baseClass) classPieces.push(`'${baseClass}'`);
  if (hasVariants) classPieces.push('variantClass');
  if (hasSizes) classPieces.push('sizeClass');
  classPieces.push('className');

  classExprLines.push(
    `const classes = [${classPieces.join(', ')}].filter(Boolean).join(' ');`,
  );

  const frontmatter: string[] = ['---'];
  frontmatter.push(...fmTypeLines);
  if (fmTypeLines.length > 0) frontmatter.push('');
  frontmatter.push('export interface Props {');
  frontmatter.push(...propLines);
  frontmatter.push('}');
  frontmatter.push('');
  frontmatter.push(`const { ${destructure.join(', ')} } = Astro.props;`);
  frontmatter.push(...classExprLines);
  frontmatter.push('---');

  const body = `<Tag class={classes} {...rest}><slot /></Tag>\n`;
  void name;
  return `${frontmatter.join('\n')}\n${body}`;
}

function renderLookupConst(
  constName: string,
  propName: string,
  table: Record<string, string>,
): string {
  const keys = Object.keys(table);
  const ternaries = keys
    .map((k) => `${propName} === '${k}' ? '${table[k]}'`)
    .join(' : ');
  return `const ${constName} = ${ternaries} : '';`;
}

function unionLiteral(keys: string[]): string {
  return keys.map((k) => `'${k}'`).join(' | ');
}
