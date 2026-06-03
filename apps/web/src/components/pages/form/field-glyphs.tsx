/**
 * Small inline glyphs for each form field type in the left rail. Kept here so
 * the rail stays declarative and the icons match ClickUp's field-type chips.
 */

import type { FieldKey } from './form-fields';

interface GlyphProps {
  size?: number;
  color?: string;
}

function TextGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4h10M3 8h10M3 12h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

function ParagraphGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 3.5h10M3 6.5h10M3 9.5h10M3 12.5h7" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

function PersonGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={5} r={2.6} stroke={color} strokeWidth={1.3} />
      <path d="M3.2 13c0-2.4 2.2-3.8 4.8-3.8S12.8 10.6 12.8 13" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

function FlagGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 2.5v11" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M4 3h7l-1.4 2.2L11 7.5H4z" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}

function CalendarGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x={2.5} y={3.5} width={11} height={10} rx={1.5} stroke={color} strokeWidth={1.3} />
      <path d="M2.5 6.5h11M5.5 2.2v2.4M10.5 2.2v2.4" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

function StatusGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={5} stroke={color} strokeWidth={1.4} strokeDasharray="2.6 2" />
    </svg>
  );
}

function EmailGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x={2.5} y={4} width={11} height={8} rx={1.5} stroke={color} strokeWidth={1.3} />
      <path d="M3 5l5 3.5L13 5" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}

function DropdownGlyph({ size = 14, color = 'currentColor' }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x={2.5} y={4} width={11} height={8} rx={1.5} stroke={color} strokeWidth={1.3} />
      <path d="M6 7.5l2 2 2-2" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const GLYPHS: Record<FieldKey, (props: GlyphProps) => React.ReactElement> = {
  name: TextGlyph,
  description: ParagraphGlyph,
  assignee: PersonGlyph,
  priority: FlagGlyph,
  dueDate: CalendarGlyph,
  status: StatusGlyph,
  email: EmailGlyph,
  dropdown: DropdownGlyph,
};

export function FieldGlyph({ field, size, color }: { field: FieldKey; size?: number; color?: string }) {
  const Glyph = GLYPHS[field];
  return <Glyph size={size} color={color} />;
}
