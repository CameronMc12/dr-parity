/**
 * Emits `src/scripts/animations.ts` — a single entry that registers GSAP
 * timelines keyed by `[data-anim="<sectionId>"]` selectors.
 *
 * Strategy:
 *  - One global gsap.registerPlugin(ScrollTrigger) call if any section has
 *    scroll-driven animations (we treat scroll-position / scroll-progress /
 *    intersection triggers as scroll-driven).
 *  - For every animation in the section's AnimationSpec list, emit a small
 *    gsap.fromTo() block. Animations without explicit from/to fall back to a
 *    soft fade-up entrance.
 *  - prefers-reduced-motion gates the entire init.
 */

import type { AnimationSpec, AnimationTriggerType, SectionSpec } from '../../types/extraction';

export interface AnimationsBuildResult {
  contents: string;
  /** Whether ScrollTrigger is referenced. */
  usesScrollTrigger: boolean;
}

const SCROLL_TRIGGER_TYPES = new Set<AnimationTriggerType>([
  'scroll-position',
  'scroll-progress',
  'intersection',
]);

export function buildAnimations(sections: SectionSpec[]): AnimationsBuildResult {
  const usesScrollTrigger = sections.some((s) =>
    s.animations.some((a) => SCROLL_TRIGGER_TYPES.has(a.trigger.type)),
  );

  const lines: string[] = [
    "import gsap from 'gsap';",
  ];
  if (usesScrollTrigger) {
    lines.push("import { ScrollTrigger } from 'gsap/ScrollTrigger';");
    lines.push('');
    lines.push('gsap.registerPlugin(ScrollTrigger);');
  } else {
    lines.push('');
  }
  lines.push('');
  lines.push("const prefersReduced = typeof window !== 'undefined'");
  lines.push("  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;");
  lines.push('');
  lines.push('function init(): void {');
  lines.push('  if (prefersReduced) return;');
  lines.push('');

  let timelinesEmitted = 0;
  for (const section of sections) {
    for (const anim of section.animations) {
      lines.push(...buildAnimationBlock(section, anim));
      timelinesEmitted++;
    }
  }

  if (timelinesEmitted === 0) {
    // Fall back to a gentle fade-up on every section so the GSAP wiring is
    // exercised and the output ships with visible motion.
    for (const section of sections) {
      lines.push(`  gsap.from('[data-anim="${section.id}"]', {`);
      lines.push("    autoAlpha: 0,");
      lines.push("    y: 24,");
      lines.push("    duration: 0.6,");
      lines.push("    ease: 'power2.out',");
      lines.push('  });');
      lines.push('');
    }
  }

  lines.push('}');
  lines.push('');
  lines.push("if (document.readyState === 'loading') {");
  lines.push("  document.addEventListener('DOMContentLoaded', init);");
  lines.push('} else {');
  lines.push('  init();');
  lines.push('}');
  lines.push('');

  return { contents: lines.join('\n'), usesScrollTrigger };
}

function buildAnimationBlock(section: SectionSpec, anim: AnimationSpec): string[] {
  const selector = anim.elementSelector || `[data-anim="${section.id}"]`;
  const out: string[] = [];
  const isScroll = SCROLL_TRIGGER_TYPES.has(anim.trigger.type);

  const fromVars: string[] = [];
  const toVars: string[] = [];
  for (const p of anim.properties) {
    fromVars.push(`    ${cssToGsapKey(p.property)}: ${quoteValue(p.from)},`);
    toVars.push(`    ${cssToGsapKey(p.property)}: ${quoteValue(p.to)},`);
  }
  if (fromVars.length === 0) {
    fromVars.push('    autoAlpha: 0,', '    y: 24,');
    toVars.push('    autoAlpha: 1,', '    y: 0,');
  }

  out.push(`  // ${section.id} — ${anim.humanDescription || anim.id || 'animation'}`);
  out.push(`  gsap.fromTo(${JSON.stringify(selector)}, {`);
  out.push(...fromVars);
  out.push('  }, {');
  out.push(...toVars);
  if (anim.duration > 0) out.push(`    duration: ${(anim.duration / 1000).toFixed(3)},`);
  else out.push('    duration: 0.6,');
  if (anim.delay > 0) out.push(`    delay: ${(anim.delay / 1000).toFixed(3)},`);
  if (anim.easing) out.push(`    ease: ${JSON.stringify(mapEasing(anim.easing))},`);

  if (isScroll) {
    out.push('    scrollTrigger: {');
    out.push(`      trigger: ${JSON.stringify(selector)},`);
    if (anim.gsapScrollTriggerConfig?.start) {
      out.push(`      start: ${JSON.stringify(anim.gsapScrollTriggerConfig.start)},`);
    } else {
      out.push("      start: 'top 80%',");
    }
    if (anim.gsapScrollTriggerConfig?.end) {
      out.push(`      end: ${JSON.stringify(anim.gsapScrollTriggerConfig.end)},`);
    }
    if (anim.gsapScrollTriggerConfig?.scrub !== undefined) {
      out.push(`      scrub: ${JSON.stringify(anim.gsapScrollTriggerConfig.scrub)},`);
    }
    out.push('    },');
  }

  out.push('  });');
  out.push('');
  return out;
}

function cssToGsapKey(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function quoteValue(v: string): string {
  if (v === '' || v == null) return JSON.stringify('');
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  return JSON.stringify(v);
}

function mapEasing(easing: string): string {
  const e = easing.trim().toLowerCase();
  if (e === 'ease' || e === 'ease-in-out') return 'power2.inOut';
  if (e === 'ease-in') return 'power2.in';
  if (e === 'ease-out') return 'power2.out';
  if (e === 'linear') return 'none';
  return easing;
}
