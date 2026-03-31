/**
 * Component generator — transforms ComponentNodes into React component source
 * files with Tailwind classes, animation hooks, and proper imports.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type {
  ComponentNode,
  ComponentSpec,
  DesignTokens,
  ImportSpec,
} from '../types/component';
import type {
  AnimationSpec,
  ElementSpec,
  StateSpec,
  StaggerPattern,
} from '../types/extraction';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComponentGenOutput {
  filePath: string;
  content: string;
  componentName: string;
}

export interface ComponentGenOptions {
  projectDir: string;
  tokens: DesignTokens;
  /** Stagger patterns detected across the page, used for child animation delays. */
  staggerPatterns?: StaggerPattern[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateComponent(
  node: ComponentNode,
  options: ComponentGenOptions,
): ComponentGenOutput {
  const content = buildComponentSource(node, options.tokens, options.staggerPatterns ?? []);
  const filePath = join(options.projectDir, node.filePath);

  return { filePath, content, componentName: node.name };
}

export function generateAllComponents(
  nodes: ComponentNode[],
  options: ComponentGenOptions,
): ComponentGenOutput[] {
  return nodes.map((node) => generateComponent(node, options));
}

export async function writeComponents(
  outputs: ComponentGenOutput[],
): Promise<string[]> {
  const written: string[] = [];
  for (const output of outputs) {
    await mkdir(dirname(output.filePath), { recursive: true });
    await writeFile(output.filePath, output.content, 'utf-8');
    written.push(output.filePath);
  }
  return written;
}

// ---------------------------------------------------------------------------
// Component source builder
// ---------------------------------------------------------------------------

function buildComponentSource(
  node: ComponentNode,
  tokens: DesignTokens,
  staggerPatterns: StaggerPattern[] = [],
): string {
  const { spec } = node;
  const lines: string[] = [];
  const ctx: GenContext = { tokens, indent: 0, needsUseEffect: false, needsUseRef: false, needsUseState: false };

  // Determine hooks needed from animations and stagger patterns
  analyzeHookRequirements(spec, ctx);
  if (staggerPatterns.length > 0) {
    ctx.needsUseEffect = true;
    ctx.needsUseRef = true;
  }

  // "use client" directive
  if (spec.isClient) {
    lines.push('"use client";');
    lines.push('');
  }

  // Imports
  const importBlock = buildImportBlock(spec, ctx);
  lines.push(importBlock);
  lines.push('');

  // Component function
  const propsType = buildPropsType(spec);
  if (propsType) {
    lines.push(propsType);
    lines.push('');
  }

  const propsParam = spec.props.length > 0 ? `{ ${spec.props.map((p) => p.name).join(', ')} }: ${spec.name}Props` : '';

  lines.push(`export function ${spec.name}(${propsParam}) {`);

  // Animation hooks
  const hookCode = buildAnimationHooks(spec, ctx);
  if (hookCode) {
    lines.push(hookCode);
  }

  // Stagger animation hooks
  const staggerCode = buildStaggerHooks(staggerPatterns);
  if (staggerCode) {
    lines.push(staggerCode);
  }

  // JSX
  lines.push('  return (');
  const jsxContent = buildJsxTree(spec.elements, tokens, 2);
  if (jsxContent.trim()) {
    lines.push(jsxContent);
  } else {
    lines.push('    <section />');
  }
  lines.push('  );');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Context for tracking hook needs
// ---------------------------------------------------------------------------

interface GenContext {
  tokens: DesignTokens;
  indent: number;
  needsUseEffect: boolean;
  needsUseRef: boolean;
  needsUseState: boolean;
}

function analyzeHookRequirements(spec: ComponentSpec, ctx: GenContext): void {
  for (const anim of spec.animations) {
    if (
      anim.type === 'intersection-observer' ||
      anim.type === 'scroll-listener' ||
      anim.type === 'gsap' ||
      anim.type === 'lenis'
    ) {
      ctx.needsUseEffect = true;
      ctx.needsUseRef = true;
    }
    if (anim.type === 'css-scroll-timeline' || anim.type === 'raf-driven') {
      ctx.needsUseEffect = true;
      ctx.needsUseRef = true;
    }
  }

  // Check for stateful interaction models
  if (
    spec.interactionModel === 'click-driven' ||
    spec.interactionModel === 'hybrid'
  ) {
    ctx.needsUseState = true;
  }
}

// ---------------------------------------------------------------------------
// Import block
// ---------------------------------------------------------------------------

function buildImportBlock(spec: ComponentSpec, ctx: GenContext): string {
  const lines: string[] = [];
  const reactImports: string[] = [];

  if (ctx.needsUseEffect) reactImports.push('useEffect');
  if (ctx.needsUseRef) reactImports.push('useRef');
  if (ctx.needsUseState) reactImports.push('useState');

  if (reactImports.length > 0) {
    lines.push(`import { ${reactImports.join(', ')} } from "react";`);
  }

  // Deduplicate and emit other imports
  const seen = new Set<string>();
  for (const imp of spec.imports) {
    const key = importKey(imp);
    if (seen.has(key)) continue;
    seen.add(key);

    if (imp.defaultImport && imp.namedImports && imp.namedImports.length > 0) {
      lines.push(
        `import ${imp.defaultImport}, { ${imp.namedImports.join(', ')} } from "${imp.module}";`,
      );
    } else if (imp.defaultImport) {
      lines.push(`import ${imp.defaultImport} from "${imp.module}";`);
    } else if (imp.namedImports && imp.namedImports.length > 0) {
      lines.push(
        `import { ${imp.namedImports.join(', ')} } from "${imp.module}";`,
      );
    }
  }

  return lines.join('\n');
}

function importKey(imp: ImportSpec): string {
  return `${imp.module}|${imp.defaultImport ?? ''}|${(imp.namedImports ?? []).join(',')}`;
}

// ---------------------------------------------------------------------------
// Props type
// ---------------------------------------------------------------------------

function buildPropsType(spec: ComponentSpec): string {
  if (spec.props.length === 0) return '';

  const lines: string[] = [];
  lines.push(`interface ${spec.name}Props {`);
  for (const prop of spec.props) {
    const optional = prop.required ? '' : '?';
    const desc = prop.description ? `  /** ${prop.description} */\n` : '';
    lines.push(`${desc}  ${prop.name}${optional}: ${prop.type};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Animation hooks
// ---------------------------------------------------------------------------

function buildAnimationHooks(spec: ComponentSpec, ctx: GenContext): string {
  const lines: string[] = [];

  // Ref declarations
  if (ctx.needsUseRef) {
    lines.push('  const sectionRef = useRef<HTMLElement>(null);');
  }

  // State declarations
  if (ctx.needsUseState) {
    lines.push('  const [isActive, setIsActive] = useState(false);');
  }

  // Group animations by type
  const intersectionAnims = spec.animations.filter(
    (a) => a.type === 'intersection-observer' || a.trigger.type === 'intersection',
  );
  const scrollAnims = spec.animations.filter(
    (a) => a.type === 'scroll-listener' || a.trigger.type === 'scroll-position',
  );
  const gsapAnims = spec.animations.filter((a) => a.type === 'gsap');
  const lenisAnims = spec.animations.filter((a) => a.type === 'lenis');

  // IntersectionObserver hook (enhanced with captured IO effects - Item 1.4)
  if (intersectionAnims.length > 0) {
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const el = sectionRef.current;');
    lines.push('    if (!el) return;');
    lines.push('');
    const threshold = intersectionAnims[0].trigger.threshold ?? 0.1;
    const rootMargin = intersectionAnims[0].trigger.rootMargin ?? '0px';
    lines.push('    const observer = new IntersectionObserver(');
    lines.push('      (entries) => {');
    lines.push('        for (const entry of entries) {');
    lines.push('          if (entry.isIntersecting) {');

    // Use captured IO effects if available, otherwise fall back to generic "animate-in"
    const ioCallbackLines = buildIOCallbackLines(intersectionAnims);
    for (const line of ioCallbackLines) {
      lines.push(`            ${line}`);
    }

    lines.push('            observer.unobserve(entry.target);');
    lines.push('          }');
    lines.push('        }');
    lines.push('      },');
    lines.push(`      { threshold: ${threshold}, rootMargin: "${rootMargin}" },`);
    lines.push('    );');
    lines.push('');
    lines.push('    const targets = el.querySelectorAll("[data-animate]");');
    lines.push('    targets.forEach((target) => observer.observe(target));');
    lines.push('');
    lines.push('    return () => observer.disconnect();');
    lines.push('  }, []);');
  }

  // Scroll listener hook
  if (scrollAnims.length > 0) {
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const el = sectionRef.current;');
    lines.push('    if (!el) return;');
    lines.push('');
    lines.push('    function handleScroll() {');
    lines.push('      const rect = el!.getBoundingClientRect();');
    lines.push('      const progress = Math.max(0, Math.min(1, 1 - rect.top / window.innerHeight));');
    lines.push('      el!.style.setProperty("--scroll-progress", String(progress));');
    lines.push('    }');
    lines.push('');
    lines.push('    window.addEventListener("scroll", handleScroll, { passive: true });');
    lines.push('    handleScroll();');
    lines.push('    return () => window.removeEventListener("scroll", handleScroll);');
    lines.push('  }, []);');
  }

  // GSAP hook (enhanced with ScrollTrigger support - Item 1.3)
  if (gsapAnims.length > 0) {
    const hasScrollTrigger = gsapAnims.some((a) => a.gsapScrollTriggerConfig);

    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    const el = sectionRef.current;');
    lines.push('    if (!el) return;');
    lines.push('');

    if (hasScrollTrigger) {
      // Use dynamic imports for GSAP + ScrollTrigger
      lines.push('    async function initGsap() {');
      lines.push('      const gsap = (await import("gsap")).default;');
      lines.push('      const { ScrollTrigger } = await import("gsap/ScrollTrigger");');
      lines.push('      gsap.registerPlugin(ScrollTrigger);');
      lines.push('');

      for (const anim of gsapAnims) {
        if (anim.codeSnippet) {
          const indented = anim.codeSnippet
            .split('\n')
            .map((line) => `      ${line}`)
            .join('\n');
          lines.push(indented);
        } else if (anim.gsapScrollTriggerConfig) {
          const stLines = buildGsapScrollTriggerCode(anim);
          for (const stLine of stLines) {
            lines.push(`      ${stLine}`);
          }
        } else {
          const fromProps = anim.properties
            .map((p) => `${p.property}: "${p.from}"`)
            .join(', ');
          const toProps = anim.properties
            .map((p) => `${p.property}: "${p.to}"`)
            .join(', ');
          lines.push(
            `      gsap.fromTo(el.querySelector("${anim.elementSelector}"), { ${fromProps} }, { ${toProps}, duration: ${anim.duration / 1000}, ease: "${anim.easing}" });`,
          );
        }
      }

      lines.push('    }');
      lines.push('');
      lines.push('    initGsap();');
    } else {
      for (const anim of gsapAnims) {
        if (anim.codeSnippet) {
          const indented = anim.codeSnippet
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n');
          lines.push(indented);
        } else {
          const fromProps = anim.properties
            .map((p) => `${p.property}: "${p.from}"`)
            .join(', ');
          const toProps = anim.properties
            .map((p) => `${p.property}: "${p.to}"`)
            .join(', ');
          lines.push(
            `    gsap.fromTo(el.querySelector("${anim.elementSelector}"), { ${fromProps} }, { ${toProps}, duration: ${anim.duration / 1000}, ease: "${anim.easing}" });`,
          );
        }
      }
    }

    lines.push('  }, []);');
  }

  // Lenis hook
  if (lenisAnims.length > 0) {
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    let lenis: InstanceType<typeof import("lenis").default> | null = null;');
    lines.push('');
    lines.push('    async function initLenis() {');
    lines.push('      const Lenis = (await import("lenis")).default;');
    lines.push('      lenis = new Lenis();');
    lines.push('      function raf(time: number) {');
    lines.push('        lenis?.raf(time);');
    lines.push('        requestAnimationFrame(raf);');
    lines.push('      }');
    lines.push('      requestAnimationFrame(raf);');
    lines.push('    }');
    lines.push('');
    lines.push('    initLenis();');
    lines.push('    return () => { lenis?.destroy(); };');
    lines.push('  }, []);');
  }

  if (lines.length > 0) {
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stagger animation hooks
// ---------------------------------------------------------------------------

function buildStaggerHooks(staggerPatterns: StaggerPattern[]): string {
  if (staggerPatterns.length === 0) return '';

  const lines: string[] = [];

  for (const pattern of staggerPatterns) {
    lines.push('');
    lines.push(`  /* Stagger: ${pattern.delayIncrement}ms between ${pattern.childCount} children */`);
    lines.push('  useEffect(() => {');
    lines.push('    const container = sectionRef.current;');
    lines.push('    if (!container) return;');
    lines.push('');
    lines.push(`    const children = container.querySelectorAll('${pattern.childSelector}');`);
    lines.push('    children.forEach((child, i) => {');
    lines.push(`      const el = child as HTMLElement;`);

    if (pattern.direction === 'reverse') {
      lines.push(`      el.style.animationDelay = \`\${(children.length - 1 - i) * ${pattern.delayIncrement}}ms\`;`);
    } else {
      lines.push(`      el.style.animationDelay = \`\${i * ${pattern.delayIncrement}}ms\`;`);
    }

    lines.push('    });');
    lines.push('  }, []);');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// JSX tree builder
// ---------------------------------------------------------------------------

function buildJsxTree(
  elements: ElementSpec[],
  tokens: DesignTokens,
  depth: number,
): string {
  if (elements.length === 0) return '';

  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const el of elements) {
    const tag = mapHtmlTag(el);
    const attrs = buildAttributes(el, tokens);
    const hasChildren = el.children.length > 0 || el.textContent;

    if (!hasChildren && !el.innerHTML) {
      lines.push(`${indent}<${tag}${attrs} />`);
    } else {
      lines.push(`${indent}<${tag}${attrs}>`);
      if (el.textContent && el.children.length === 0) {
        lines.push(`${indent}  {${JSON.stringify(el.textContent)}}`);
      }
      if (el.children.length > 0) {
        const childJsx = buildJsxTree(el.children, tokens, depth + 1);
        if (childJsx) lines.push(childJsx);
      }
      lines.push(`${indent}</${tag}>`);
    }
  }

  return lines.join('\n');
}

function mapHtmlTag(el: ElementSpec): string {
  // Map img to next/image
  if (el.tag === 'img') return 'Image';
  // Map a to Link for internal hrefs
  if (el.tag === 'a') {
    const href = el.attributes['href'] ?? '';
    if (href.startsWith('/') || href.startsWith('#')) return 'Link';
  }
  return el.tag;
}

function buildAttributes(el: ElementSpec, tokens: DesignTokens): string {
  const parts: string[] = [];

  // className from Tailwind conversion + original classes
  const twClasses = stylesToTailwind(el.computedStyles, tokens);
  const hoverClasses = buildHoverClasses(el.states);
  const pseudoClasses = buildPseudoElementClasses(el);
  const allClasses = [...el.classes, ...twClasses, ...hoverClasses, ...pseudoClasses].filter(Boolean);

  if (allClasses.length > 0) {
    parts.push(`className="${allClasses.join(' ')}"`);
  }

  // Inline styles for properties that don't map to Tailwind
  const inlineStyles = stylesToInline(el.computedStyles, tokens);
  if (Object.keys(inlineStyles).length > 0) {
    const styleStr = Object.entries(inlineStyles)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    parts.push(`style={{ ${styleStr} }}`);
  }

  // Standard HTML attributes
  for (const [key, value] of Object.entries(el.attributes)) {
    if (key === 'class' || key === 'style') continue;
    const jsxKey = htmlAttrToJsx(key);
    if (jsxKey) {
      parts.push(`${jsxKey}=${JSON.stringify(value)}`);
    }
  }

  // Image-specific props (responsive-aware)
  if (el.tag === 'img' && el.media) {
    // Resolve the actual image source: prefer localPath, then src, then data-src/data-lazy
    const imgSrc = el.media.localPath ?? el.media.src ?? el.media.dataSrc ?? el.media.dataLazy ?? '';
    if (imgSrc) {
      parts.push(`src=${JSON.stringify(imgSrc)}`);
    }
    parts.push(`alt=${JSON.stringify(el.media.alt ?? '')}`);

    const w = el.media.naturalWidth || 800;
    const h = el.media.naturalHeight || 600;
    parts.push(`width={${w}}`);
    parts.push(`height={${h}}`);

    // Responsive sizes prop for next/image when srcset + sizes are available
    if (el.media.sizes) {
      parts.push(`sizes=${JSON.stringify(el.media.sizes)}`);
    }

    // Loading strategy: lazy by default, eager for above-the-fold
    if (el.media.loading === 'eager' || el.media.fetchPriority === 'high') {
      parts.push('priority');
    } else {
      parts.push('loading="lazy"');
    }
  }

  // Video-specific props
  if (el.tag === 'video' && el.media) {
    if (el.media.autoplay) parts.push('autoPlay');
    if (el.media.loop) parts.push('loop');
    if (el.media.muted) parts.push('muted');
    if (el.media.poster) parts.push(`poster=${JSON.stringify(el.media.poster)}`);
  }

  // Animation data attribute for IntersectionObserver targeting
  if (el.animations.length > 0) {
    parts.push('data-animate');
  }

  if (parts.length === 0) return '';
  return ' ' + parts.join(' ');
}

// ---------------------------------------------------------------------------
// Style → Tailwind mapping
// ---------------------------------------------------------------------------

const TAILWIND_MAP: Record<string, (value: string, tokens: DesignTokens) => string | null> = {
  display: (v) => {
    const map: Record<string, string> = {
      flex: 'flex', grid: 'grid', block: 'block',
      'inline-flex': 'inline-flex', 'inline-block': 'inline-block',
      'inline-grid': 'inline-grid', none: 'hidden', inline: 'inline',
    };
    return map[v] ?? null;
  },
  'flex-direction': (v) => {
    const map: Record<string, string> = {
      row: 'flex-row', column: 'flex-col',
      'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse',
    };
    return map[v] ?? null;
  },
  'flex-wrap': (v) => (v === 'wrap' ? 'flex-wrap' : v === 'nowrap' ? 'flex-nowrap' : null),
  'align-items': (v) => {
    const map: Record<string, string> = {
      center: 'items-center', 'flex-start': 'items-start',
      'flex-end': 'items-end', stretch: 'items-stretch', baseline: 'items-baseline',
    };
    return map[v] ?? null;
  },
  'justify-content': (v) => {
    const map: Record<string, string> = {
      center: 'justify-center', 'flex-start': 'justify-start',
      'flex-end': 'justify-end', 'space-between': 'justify-between',
      'space-around': 'justify-around', 'space-evenly': 'justify-evenly',
    };
    return map[v] ?? null;
  },
  position: (v) => {
    const map: Record<string, string> = {
      relative: 'relative', absolute: 'absolute',
      fixed: 'fixed', sticky: 'sticky', static: 'static',
    };
    return map[v] ?? null;
  },
  overflow: (v) => {
    const map: Record<string, string> = {
      hidden: 'overflow-hidden', auto: 'overflow-auto',
      scroll: 'overflow-scroll', visible: 'overflow-visible',
    };
    return map[v] ?? null;
  },
  'text-align': (v) => {
    const map: Record<string, string> = {
      center: 'text-center', left: 'text-left',
      right: 'text-right', justify: 'text-justify',
    };
    return map[v] ?? null;
  },
  'font-weight': (v) => {
    const map: Record<string, string> = {
      '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
      '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
      '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black',
    };
    return map[v] ?? null;
  },
  'white-space': (v) => {
    const map: Record<string, string> = {
      nowrap: 'whitespace-nowrap', pre: 'whitespace-pre',
      'pre-wrap': 'whitespace-pre-wrap', 'pre-line': 'whitespace-pre-line',
      normal: 'whitespace-normal',
    };
    return map[v] ?? null;
  },
  'text-decoration': (v) => {
    if (v.includes('underline')) return 'underline';
    if (v.includes('line-through')) return 'line-through';
    if (v === 'none') return 'no-underline';
    return null;
  },
  'text-transform': (v) => {
    const map: Record<string, string> = {
      uppercase: 'uppercase', lowercase: 'lowercase',
      capitalize: 'capitalize', none: 'normal-case',
    };
    return map[v] ?? null;
  },
  'font-size': (v) => mapFontSize(v),
  width: (v) => mapDimension(v, 'w'),
  height: (v) => mapDimension(v, 'h'),
  'max-width': (v) => mapDimension(v, 'max-w'),
  'min-height': (v) => mapDimension(v, 'min-h'),
  gap: (v) => mapSpacing(v, 'gap'),
  padding: (v) => mapSpacing(v, 'p'),
  'padding-top': (v) => mapSpacing(v, 'pt'),
  'padding-right': (v) => mapSpacing(v, 'pr'),
  'padding-bottom': (v) => mapSpacing(v, 'pb'),
  'padding-left': (v) => mapSpacing(v, 'pl'),
  'padding-inline': (v) => mapSpacing(v, 'px'),
  'padding-block': (v) => mapSpacing(v, 'py'),
  margin: (v) => mapSpacing(v, 'm'),
  'margin-top': (v) => mapSpacing(v, 'mt'),
  'margin-right': (v) => mapSpacing(v, 'mr'),
  'margin-bottom': (v) => mapSpacing(v, 'mb'),
  'margin-left': (v) => mapSpacing(v, 'ml'),
  'border-radius': (v) => mapBorderRadius(v),
  opacity: (v) => {
    const pct = Math.round(parseFloat(v) * 100);
    const map: Record<number, string> = {
      0: 'opacity-0', 5: 'opacity-5', 10: 'opacity-10',
      20: 'opacity-20', 25: 'opacity-25', 30: 'opacity-30',
      40: 'opacity-40', 50: 'opacity-50', 60: 'opacity-60',
      70: 'opacity-70', 75: 'opacity-75', 80: 'opacity-80',
      90: 'opacity-90', 95: 'opacity-95', 100: 'opacity-100',
    };
    return map[pct] ?? `opacity-[${v}]`;
  },
  'z-index': (v) => {
    const n = parseInt(v, 10);
    const map: Record<number, string> = {
      0: 'z-0', 10: 'z-10', 20: 'z-20', 30: 'z-30',
      40: 'z-40', 50: 'z-50',
    };
    return map[n] ?? `z-[${v}]`;
  },
  cursor: (v) => (v === 'pointer' ? 'cursor-pointer' : v === 'default' ? 'cursor-default' : null),
  'pointer-events': (v) => (v === 'none' ? 'pointer-events-none' : null),
  'object-fit': (v) => {
    const map: Record<string, string> = {
      cover: 'object-cover', contain: 'object-contain',
      fill: 'object-fill', none: 'object-none',
    };
    return map[v] ?? null;
  },
};

// ---------------------------------------------------------------------------
// Gradient → Tailwind mapping
// ---------------------------------------------------------------------------

/** Map of angle (degrees) to Tailwind gradient direction class. */
const GRADIENT_DIRECTION_MAP: Record<number, string> = {
  0: 'bg-gradient-to-t',
  45: 'bg-gradient-to-tr',
  90: 'bg-gradient-to-r',
  135: 'bg-gradient-to-br',
  180: 'bg-gradient-to-b',
  225: 'bg-gradient-to-bl',
  270: 'bg-gradient-to-l',
  315: 'bg-gradient-to-tl',
};

/** Tolerance in degrees for snapping to a Tailwind direction. */
const ANGLE_SNAP_TOLERANCE = 22;

/**
 * Attempt to map a CSS gradient value to Tailwind utility classes.
 * Returns an array of classes if mappable, or null for complex gradients
 * that must fall back to inline styles / CSS custom properties.
 */
function mapGradientToTailwind(value: string): string[] | null {
  if (!value.includes('linear-gradient')) return null;

  const angleMatch = value.match(/linear-gradient\(\s*(\d+)deg/);
  if (!angleMatch) {
    // Try keyword directions
    const dirMatch = value.match(/linear-gradient\(\s*to\s+([\w\s]+)/);
    if (dirMatch) {
      const dirMap: Record<string, string> = {
        'top': 'bg-gradient-to-t',
        'top right': 'bg-gradient-to-tr',
        'right': 'bg-gradient-to-r',
        'bottom right': 'bg-gradient-to-br',
        'bottom': 'bg-gradient-to-b',
        'bottom left': 'bg-gradient-to-bl',
        'left': 'bg-gradient-to-l',
        'top left': 'bg-gradient-to-tl',
      };
      const dir = dirMatch[1].trim().toLowerCase();
      const cls = dirMap[dir];
      if (cls) return [cls];
    }
    return null;
  }

  const angle = parseInt(angleMatch[1], 10);
  const snappedAngles = Object.keys(GRADIENT_DIRECTION_MAP).map(Number);
  const closest = snappedAngles.reduce((prev, curr) =>
    Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
  );

  if (Math.abs(closest - angle) <= ANGLE_SNAP_TOLERANCE) {
    return [GRADIENT_DIRECTION_MAP[closest]];
  }

  return null;
}

/** Properties that we handle via Tailwind and should NOT emit as inline styles. */
const TAILWIND_HANDLED_PROPS = new Set(Object.keys(TAILWIND_MAP));

/** Additional props to skip in inline styles (handled elsewhere or redundant). */
const SKIP_INLINE = new Set([
  ...TAILWIND_HANDLED_PROPS,
  'color', 'backgroundColor', 'background-color', 'borderColor', 'border-color',
  'background', 'backgroundImage', 'background-image',
  // camelCase duplicates
  'flexDirection', 'flexWrap', 'alignItems', 'justifyContent', 'textAlign',
  'fontWeight', 'whiteSpace', 'textDecoration', 'textTransform', 'fontSize',
  'maxWidth', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom',
  'paddingLeft', 'paddingInline', 'paddingBlock', 'marginTop', 'marginRight',
  'marginBottom', 'marginLeft', 'borderRadius', 'zIndex', 'pointerEvents',
  'objectFit',
]);

function stylesToTailwind(
  styles: Record<string, string>,
  tokens: DesignTokens,
): string[] {
  const classes: string[] = [];

  for (const [prop, value] of Object.entries(styles)) {
    const kebab = camelToKebab(prop);
    const mapper = TAILWIND_MAP[kebab];
    if (mapper) {
      const cls = mapper(value, tokens);
      if (cls) classes.push(cls);
    }

    // Color mapping
    if (kebab === 'color') {
      const cls = mapColorToTailwind(value, 'text', tokens);
      if (cls) classes.push(cls);
    }
    if (kebab === 'background-color') {
      const cls = mapColorToTailwind(value, 'bg', tokens);
      if (cls) classes.push(cls);
    }
    if (kebab === 'border-color') {
      const cls = mapColorToTailwind(value, 'border', tokens);
      if (cls) classes.push(cls);
    }

    // Gradient mapping for background/background-image
    if (
      (kebab === 'background' || kebab === 'background-image') &&
      value.includes('gradient')
    ) {
      const gradientClasses = mapGradientToTailwind(value);
      if (gradientClasses) {
        classes.push(...gradientClasses);
      }
      // Complex gradients that can't be mapped get a CSS variable reference
      // via the gradient token system — handled in stylesToInline below.
    }
  }

  return classes;
}

function stylesToInline(
  styles: Record<string, string>,
  tokens?: DesignTokens,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [prop, value] of Object.entries(styles)) {
    const kebab = camelToKebab(prop);
    if (SKIP_INLINE.has(prop) || SKIP_INLINE.has(kebab)) continue;

    // Only include non-trivial properties
    if (value === 'none' || value === 'normal' || value === 'auto') continue;

    // Convert kebab-case to camelCase for React style objects
    const camelProp = kebabToCamel(kebab);
    result[camelProp] = value;
  }

  // Emit complex gradients as inline backgroundImage if they couldn't map to Tailwind
  for (const gradientProp of ['background', 'backgroundImage', 'background-image'] as const) {
    const val = styles[gradientProp];
    if (val && val.includes('gradient') && !mapGradientToTailwind(val)) {
      // Check if there's a matching CSS variable from tokens
      const matchingToken = tokens?.gradients.find((g) => g.value === val);
      if (matchingToken?.cssVariable) {
        result['backgroundImage'] = `var(${matchingToken.cssVariable})`;
      } else {
        result['backgroundImage'] = val;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hover state → Tailwind classes
// ---------------------------------------------------------------------------

function buildHoverClasses(states: StateSpec[]): string[] {
  const classes: string[] = [];
  for (const state of states) {
    if (state.trigger !== 'hover') continue;
    for (const [prop, change] of Object.entries(state.styleChanges)) {
      const kebab = camelToKebab(prop);
      if (kebab === 'opacity') {
        const pct = Math.round(parseFloat(change.to) * 100);
        classes.push(`hover:opacity-[${pct / 100}]`);
      }
      if (kebab === 'transform' && change.to.includes('scale')) {
        const match = change.to.match(/scale\(([^)]+)\)/);
        if (match) classes.push(`hover:scale-[${match[1]}]`);
      }
    }
    if (state.transition) {
      classes.push('transition-all');
      const durationMatch = state.transition.match(/([\d.]+)s/);
      if (durationMatch) {
        const ms = Math.round(parseFloat(durationMatch[1]) * 1000);
        classes.push(`duration-${ms}`);
      }
    }
  }
  return classes;
}

// ---------------------------------------------------------------------------
// Pseudo-element → Tailwind classes
// ---------------------------------------------------------------------------

function buildPseudoElementClasses(el: ElementSpec): string[] {
  if (!el.pseudoStyles) return [];

  const classes: string[] = [];

  for (const [pseudo, styles] of Object.entries(el.pseudoStyles)) {
    if (!styles || Object.keys(styles).length === 0) continue;

    const prefix = pseudo === 'before' ? 'before' : pseudo === 'after' ? 'after' : null;
    if (!prefix) continue;

    // Content is required for ::before/::after to render
    const contentVal = styles['content'];
    if (contentVal) {
      const cleaned = contentVal.replace(/^["']|["']$/g, '');
      if (cleaned === '' || cleaned === 'none') {
        classes.push(`${prefix}:content-['']`);
      } else {
        // Escape spaces for Tailwind arbitrary values
        const escaped = cleaned.replace(/\s/g, '_');
        classes.push(`${prefix}:content-['${escaped}']`);
      }
    }

    if (styles['position'] === 'absolute') classes.push(`${prefix}:absolute`);
    if (styles['display'] === 'block') classes.push(`${prefix}:block`);

    // Dimensional properties
    const dimMap: Record<string, string> = {
      width: 'w', height: 'h', top: 'top', right: 'right',
      bottom: 'bottom', left: 'left',
    };
    for (const [prop, twPrefix] of Object.entries(dimMap)) {
      const val = styles[prop];
      if (val) {
        if (val === '100%') {
          classes.push(`${prefix}:${twPrefix}-full`);
        } else if (val === '0px' || val === '0') {
          classes.push(`${prefix}:${twPrefix}-0`);
        } else {
          classes.push(`${prefix}:${twPrefix}-[${val}]`);
        }
      }
    }

    // Background
    if (styles['backgroundColor'] && styles['backgroundColor'] !== 'rgba(0, 0, 0, 0)') {
      classes.push(`${prefix}:bg-[${styles['backgroundColor']}]`);
    }
    if (styles['backgroundImage']) {
      classes.push(`${prefix}:bg-[${styles['backgroundImage']}]`);
    }

    // Border radius
    if (styles['borderRadius']) {
      classes.push(`${prefix}:rounded-[${styles['borderRadius']}]`);
    }

    // Opacity
    if (styles['opacity'] && styles['opacity'] !== '1') {
      classes.push(`${prefix}:opacity-[${styles['opacity']}]`);
    }

    // Transform
    if (styles['transform'] && styles['transform'] !== 'none') {
      classes.push(`${prefix}:[transform:${styles['transform'].replace(/\s/g, '_')}]`);
    }

    // z-index
    if (styles['zIndex'] && styles['zIndex'] !== 'auto') {
      classes.push(`${prefix}:z-[${styles['zIndex']}]`);
    }
  }

  return classes;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapFontSize(value: string): string | null {
  const px = parseFloat(value);
  if (isNaN(px)) return null;
  const map: Record<number, string> = {
    10: 'text-[10px]', 12: 'text-xs', 14: 'text-sm', 16: 'text-base',
    18: 'text-lg', 20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl',
    36: 'text-4xl', 48: 'text-5xl', 60: 'text-6xl', 72: 'text-7xl',
    96: 'text-8xl', 128: 'text-9xl',
  };
  return map[px] ?? `text-[${value}]`;
}

function mapDimension(value: string, prefix: string): string | null {
  if (value === '100%') return `${prefix}-full`;
  if (value === '100vw') return `${prefix}-screen`;
  if (value === '100vh' && (prefix === 'h' || prefix === 'min-h')) return `${prefix}-screen`;
  if (value === 'auto') return `${prefix}-auto`;
  if (value === '0px') return `${prefix}-0`;
  if (value === 'fit-content') return `${prefix}-fit`;
  if (value === 'min-content') return `${prefix}-min`;
  if (value === 'max-content') return `${prefix}-max`;
  return `${prefix}-[${value}]`;
}

function mapSpacing(value: string, prefix: string): string | null {
  if (value === '0px' || value === '0') return `${prefix}-0`;
  if (value === 'auto') return prefix === 'm' ? 'm-auto' : null;

  const px = parseFloat(value);
  if (isNaN(px)) return `${prefix}-[${value}]`;

  // Tailwind spacing: 1 = 0.25rem = 4px
  if (px % 4 === 0) {
    const unit = px / 4;
    return `${prefix}-${unit}`;
  }

  return `${prefix}-[${value}]`;
}

function mapBorderRadius(value: string): string | null {
  if (value === '0px') return 'rounded-none';
  if (value === '9999px' || value === '50%') return 'rounded-full';

  const px = parseFloat(value);
  if (isNaN(px)) return `rounded-[${value}]`;

  const map: Record<number, string> = {
    2: 'rounded-sm', 4: 'rounded', 6: 'rounded-md',
    8: 'rounded-lg', 12: 'rounded-xl', 16: 'rounded-2xl', 24: 'rounded-3xl',
  };
  return map[px] ?? `rounded-[${value}]`;
}

function mapColorToTailwind(
  value: string,
  prefix: 'text' | 'bg' | 'border',
  tokens: DesignTokens,
): string | null {
  // Check if it matches a known token
  const match = tokens.colors.all.find(
    (t) => t.value.toLowerCase() === value.toLowerCase(),
  );
  if (match?.cssVariable) {
    const tokenName = match.cssVariable.replace('--color-', '');
    return `${prefix}-${tokenName}`;
  }

  // Transparent
  if (value === 'transparent' || value === 'rgba(0, 0, 0, 0)') {
    return `${prefix}-transparent`;
  }

  // White / black
  if (value === '#ffffff' || value === 'rgb(255, 255, 255)') return `${prefix}-white`;
  if (value === '#000000' || value === 'rgb(0, 0, 0)') return `${prefix}-black`;

  // Fallback to arbitrary value
  return `${prefix}-[${value}]`;
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

function htmlAttrToJsx(attr: string): string | null {
  const map: Record<string, string> = {
    href: 'href', target: 'target', rel: 'rel', id: 'id',
    role: 'role', 'aria-label': 'aria-label', 'aria-hidden': 'aria-hidden',
    tabindex: 'tabIndex', type: 'type', name: 'name', value: 'value',
    placeholder: 'placeholder', disabled: 'disabled', 'data-testid': 'data-testid',
    title: 'title',
  };
  if (attr.startsWith('aria-') || attr.startsWith('data-')) return attr;
  return map[attr] ?? null;
}

// ---------------------------------------------------------------------------
// GSAP ScrollTrigger code generation (Item 1.3)
// ---------------------------------------------------------------------------

function buildGsapScrollTriggerCode(anim: AnimationSpec): string[] {
  const stConfig = anim.gsapScrollTriggerConfig;
  if (!stConfig) return [];

  const lines: string[] = [];
  const selector = anim.elementSelector;
  const targetExpr = selector === 'unknown' ? 'el' : `el.querySelector("${selector}")`;

  // Build scrollTrigger config object
  const stParts: string[] = [];
  stParts.push('trigger: el');
  if (stConfig.pin != null) {
    stParts.push(`pin: ${JSON.stringify(stConfig.pin)}`);
  }
  if (stConfig.scrub != null) {
    stParts.push(`scrub: ${JSON.stringify(stConfig.scrub)}`);
  }
  if (stConfig.start) {
    stParts.push(`start: ${JSON.stringify(stConfig.start)}`);
  }
  if (stConfig.end) {
    stParts.push(`end: ${JSON.stringify(stConfig.end)}`);
  }
  if (stConfig.snap != null) {
    stParts.push(`snap: ${JSON.stringify(stConfig.snap)}`);
  }
  if (stConfig.toggleClass) {
    stParts.push(`toggleClass: ${JSON.stringify(stConfig.toggleClass)}`);
  }
  if (stConfig.toggleActions) {
    stParts.push(`toggleActions: ${JSON.stringify(stConfig.toggleActions)}`);
  }

  // Build animated properties
  const animProps = anim.properties
    .filter((p) => p.to !== '')
    .map((p) => `${p.property}: "${p.to}"`)
    .join(', ');

  const animPropsStr = animProps ? `, ${animProps}` : '';

  lines.push(`gsap.to(${targetExpr}, {`);
  lines.push(`  scrollTrigger: {`);
  for (const part of stParts) {
    lines.push(`    ${part},`);
  }
  lines.push(`  }${animPropsStr},`);
  lines.push(`});`);

  return lines;
}

// ---------------------------------------------------------------------------
// IO callback code generation (Item 1.4)
// ---------------------------------------------------------------------------

function buildIOCallbackLines(anims: AnimationSpec[]): string[] {
  // Check if any animation has captured IO effects
  const animWithEffects = anims.find((a) => a.ioEffects);

  if (!animWithEffects?.ioEffects) {
    // Fall back to generic "animate-in" class
    return ['entry.target.classList.add("animate-in");'];
  }

  const effects = animWithEffects.ioEffects;
  const lines: string[] = [];

  if (effects.classesAdded.length > 0) {
    const escaped = effects.classesAdded.map((c) => JSON.stringify(c)).join(', ');
    lines.push(`entry.target.classList.add(${escaped});`);
  }
  if (effects.classesRemoved.length > 0) {
    const escaped = effects.classesRemoved.map((c) => JSON.stringify(c)).join(', ');
    lines.push(`entry.target.classList.remove(${escaped});`);
  }

  // If no class changes were captured, fall back to generic
  if (lines.length === 0) {
    lines.push('entry.target.classList.add("animate-in");');
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
