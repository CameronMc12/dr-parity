/**
 * Inline icons for each form template card on the "Create a Form" screen. Each
 * glyph is rendered inside a colour-tinted tile (see TemplateCard), so the SVGs
 * draw in `currentColor` and inherit the template's accent.
 */

import type { TemplateId } from './form-templates';

interface GlyphProps {
  size?: number;
}

/** Feedback: a survey / poll mark — vertical bars of varying height with dots. */
function SurveyGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={5} y={11} width={2.6} height={7} rx={1.3} fill="currentColor" />
      <rect x={10.7} y={7} width={2.6} height={11} rx={1.3} fill="currentColor" />
      <rect x={16.4} y={13.5} width={2.6} height={4.5} rx={1.3} fill="currentColor" />
      <circle cx={6.3} cy={7.5} r={1.3} fill="currentColor" />
      <circle cx={12} cy={4} r={1.3} fill="currentColor" />
    </svg>
  );
}

/** Project intake: a request list — stacked lines with a leading colour swatch. */
function IntakeListGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={5} y={5.5} width={4.4} height={4.4} rx={1.4} fill="currentColor" />
      <rect x={11} y={6} width={8} height={2} rx={1} fill="currentColor" opacity={0.55} />
      <rect x={11} y={9.5} width={5.5} height={1.8} rx={0.9} fill="currentColor" opacity={0.35} />
      <rect x={5} y={14} width={14} height={2} rx={1} fill="currentColor" opacity={0.55} />
      <rect x={5} y={17.4} width={10} height={1.8} rx={0.9} fill="currentColor" opacity={0.35} />
    </svg>
  );
}

/** Order: a shopping basket / cart. */
function CartGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 8h14l-1.3 7.4a1.7 1.7 0 0 1-1.7 1.4H8a1.7 1.7 0 0 1-1.7-1.4z"
        fill="currentColor"
        opacity={0.85}
      />
      <path d="M8.5 8 11 4M15.5 8 13 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M9.5 11v3M14.5 11v3" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

/** Job application: a person beside resume / text lines. */
function ApplicantGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={2.6} fill="currentColor" />
      <path d="M3.5 18c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.3z" fill="currentColor" />
      <rect x={14.5} y={6.5} width={6} height={2} rx={1} fill="currentColor" opacity={0.55} />
      <rect x={14.5} y={10} width={6} height={2} rx={1} fill="currentColor" opacity={0.4} />
      <rect x={14.5} y={13.5} width={4} height={2} rx={1} fill="currentColor" opacity={0.4} />
    </svg>
  );
}

/** IT request: a triage / priority list — stacked bars with leading dots. */
function TriageGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={6} cy={7} r={1.6} fill="currentColor" />
      <rect x={9.5} y={6} width={9.5} height={2} rx={1} fill="currentColor" opacity={0.55} />
      <circle cx={6} cy={12} r={1.6} fill="currentColor" />
      <rect x={9.5} y={11} width={7} height={2} rx={1} fill="currentColor" opacity={0.45} />
      <circle cx={6} cy={17} r={1.6} fill="currentColor" />
      <rect x={9.5} y={16} width={9.5} height={2} rx={1} fill="currentColor" opacity={0.35} />
    </svg>
  );
}

const TEMPLATE_GLYPHS: Record<Exclude<TemplateId, 'scratch'>, (p: GlyphProps) => React.ReactElement> = {
  feedback: SurveyGlyph,
  intake: IntakeListGlyph,
  order: CartGlyph,
  application: ApplicantGlyph,
  'it-request': TriageGlyph,
};

export function TemplateGlyph({ template, size }: { template: Exclude<TemplateId, 'scratch'>; size?: number }) {
  const Glyph = TEMPLATE_GLYPHS[template];
  return <Glyph size={size} />;
}

export function ScratchPlusGlyph({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
